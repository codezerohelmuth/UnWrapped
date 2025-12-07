/**
 * UnWrapped - Service Worker
 * Handles offline functionality and caching
 */

const CACHE_NAME = 'unwrapped-v1.0.0';
const RUNTIME_CACHE = 'unwrapped-runtime';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json'
];

// Assets to cache on first use
const RUNTIME_CACHE_URLS = [
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png'
];

// ===========================
// Install Event - Cache Static Assets
// ===========================
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Installed successfully');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// ===========================
// Activate Event - Clean Old Caches
// ===========================
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete old caches
              return name !== CACHE_NAME && name !== RUNTIME_CACHE;
            })
            .map((name) => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activated successfully');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// ===========================
// Fetch Event - Network First with Cache Fallback
// ===========================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Chrome extensions and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip YouTube API calls (always need fresh data)
  if (url.hostname === 'www.googleapis.com' || url.hostname === 'googleapis.com') {
    return;
  }

  // Skip YouTube embeds (need live connection)
  if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com' || url.hostname === 'youtu.be') {
    return;
  }

  // Handle Unsplash images - cache them
  if (url.hostname === 'images.unsplash.com') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // For all other requests - network first, cache fallback
  event.respondWith(networkFirstStrategy(request));
});

// ===========================
// Caching Strategies
// ===========================

/**
 * Network First Strategy
 * Try network first, fall back to cache if offline
 */
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', request.url);
    
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If still no response and it's a navigation request, show offline page
    if (request.mode === 'navigate') {
      const indexCache = await caches.match('/index.html');
      if (indexCache) {
        return indexCache;
      }
    }
    
    // Return a basic offline response
    return new Response('Offline - Unable to fetch resource', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

/**
 * Cache First Strategy
 * Try cache first, fall back to network
 */
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('[Service Worker] Cache hit:', request.url);
    return cachedResponse;
  }
  
  console.log('[Service Worker] Cache miss, fetching:', request.url);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);
    
    // Return a placeholder response for images
    return new Response('', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// ===========================
// Background Sync (Optional)
// ===========================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-playlists') {
    console.log('[Service Worker] Background sync triggered');
    event.waitUntil(syncPlaylists());
  }
});

async function syncPlaylists() {
  // Placeholder for future background sync functionality
  console.log('[Service Worker] Syncing playlists...');
  // Could sync playlist data with a backend server
  return Promise.resolve();
}

// ===========================
// Push Notifications (Optional)
// ===========================
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  const title = 'UnWrapped';
  const options = {
    body: event.data ? event.data.text() : 'New update available!',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'unwrapped-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ===========================
// Notification Click Handler
// ===========================
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // If app is already open, focus it
          for (let client of clientList) {
            if (client.url.includes(self.registration.scope) && 'focus' in client) {
              return client.focus();
            }
          }
          // Otherwise open new window
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

// ===========================
// Message Handler (for communication with app)
// ===========================
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Skipping waiting...');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[Service Worker] Clearing all caches...');
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            console.log('[Service Worker] Deleting cache:', name);
            return caches.delete(name);
          })
        );
      }).then(() => {
        console.log('[Service Worker] All caches cleared');
        // Notify the client
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      })
    );
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    console.log('[Service Worker] Version requested');
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: CACHE_NAME });
    }
  }
});

// ===========================
// Update Detection
// ===========================
self.addEventListener('controllerchange', () => {
  console.log('[Service Worker] Controller changed - new version active');
});

// ===========================
// Error Handler
// ===========================
self.addEventListener('error', (event) => {
  console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});

// ===========================
// Periodic Background Sync (Experimental)
// ===========================
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-playlists') {
    console.log('[Service Worker] Periodic sync triggered');
    event.waitUntil(syncPlaylists());
  }
});

console.log('[Service Worker] Loaded and ready - Version:', CACHE_NAME);