/**
 * UnWrapped - YouTube Player Application
 * Modular, debuggable, and maintainable JavaScript
 */

// ===========================
// Configuration & Constants
// ===========================
const CONFIG = {
  AUTO_CLOSE_DELAY: 6000,
  BACKGROUND_SHUFFLE_INTERVAL: 300000, // 5 minutes
  CLOCK_UPDATE_INTERVAL: 1000,
  DEFAULT_PLAYLIST: [
    { id: 'uX5twbuJVKI', title: 'RANJHEYA VE - Anime Mix [Hindi AMV]' },
    { id: '8kfP22meDL0', title: 'Love Story - Genshin Impact' },
    { id: '3tmd-ClpJxA', title: 'Ed Sheeran - Shape of You' },
    { id: 'NNjTFXk_UC4', title: 'POV: You are up at 3AM missing someone' },
    { id: 'hT_nvWreIhg', title: 'Maroon 5 - Sugar' },
    { id: 'fRh_vgS2dFE', title: 'Justin Bieber - Sorry' }
  ],
  BACKGROUND_IMAGES: [
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1471922694622-e98a03b12b21?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1468071174046-657d9da3e3a7?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1496307042754-b4aa456c3a2d?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200&h=800&fit=crop'
  ],
  STORAGE_KEYS: {
    API_KEY: 'ytApiKey',
    PLAYLIST: 'ytPlaylist',
    BLUR_STATE: 'blurEnabled'
  }
};

// ===========================
// State Management
// ===========================
const AppState = {
  playlist: [],
  currentIndex: 0,
  apiKey: '',
  searchTimeout: null,
  isDragging: false,
  isResizing: false
};

// ===========================
// Utility Functions
// ===========================
const Utils = {
  /**
   * Safely get element by ID with error handling
   */
  getElement(id) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`Element with id "${id}" not found`);
    }
    return el;
  },

  /**
   * Format time with leading zeros
   */
  padTime(num) {
    return num < 10 ? `0${num}` : num;
  },

  /**
   * Extract YouTube video ID from URL or return as-is if already an ID
   */
  extractVideoId(input) {
    if (!input) return null;
    
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1];
    }

    return null;
  },

  /**
   * Show error message to user
   */
  showError(message, containerId = 'playlistItems') {
    const container = this.getElement(containerId);
    if (!container) return;

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    container.insertBefore(errorDiv, container.firstChild);

    setTimeout(() => errorDiv.remove(), 5000);
  },

  /**
   * Debounce function for performance
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
};

// ===========================
// Clock Module
// ===========================
const Clock = {
  elements: {},

  init() {
    this.elements = {
      hour: Utils.getElement('hour'),
      minutes: Utils.getElement('minutes'),
      seconds: Utils.getElement('seconds'),
      ampm: Utils.getElement('ampm')
    };

    if (Object.values(this.elements).some(el => !el)) {
      console.error('Clock: Missing required elements');
      return;
    }

    this.update();
  },

  update() {
    try {
      const now = new Date();
      let h = now.getHours();
      let m = now.getMinutes();
      let s = now.getSeconds();
      let ampm = h >= 12 ? 'PM' : 'AM';

      // Convert to 12-hour format
      h = h % 12 || 12;

      this.elements.hour.textContent = Utils.padTime(h);
      this.elements.minutes.textContent = Utils.padTime(m);
      this.elements.seconds.textContent = Utils.padTime(s);
      this.elements.ampm.textContent = ampm;
    } catch (error) {
      console.error('Clock update failed:', error);
    }

    setTimeout(() => this.update(), CONFIG.CLOCK_UPDATE_INTERVAL);
  }
};

// ===========================
// YouTube API Module
// ===========================
const YouTubeAPI = {
  getApiKey() {
    if (!AppState.apiKey) {
      AppState.apiKey = localStorage.getItem(CONFIG.STORAGE_KEYS.API_KEY) || '';
    }
    return AppState.apiKey;
  },

  ensureApiKey() {
    if (!this.getApiKey()) {
      const key = prompt('Enter YouTube Data API v3 key (or skip to continue without titles):');
      if (key && key.trim()) {
        AppState.apiKey = key.trim();
        localStorage.setItem(CONFIG.STORAGE_KEYS.API_KEY, AppState.apiKey);
        console.log('API key saved successfully');
      }
    }
  },

  async fetchVideoDetails(videoId) {
    const apiKey = this.getApiKey();
    if (!apiKey || !videoId) return null;

    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`YouTube API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      
      if (data.items && data.items[0] && data.items[0].snippet) {
        const snippet = data.items[0].snippet;
        return {
          title: snippet.title || 'Untitled Video',
          thumbnail: snippet.thumbnails?.default?.url || '',
          channelTitle: snippet.channelTitle || 'Unknown Channel'
        };
      }
    } catch (error) {
      console.error('Failed to fetch video details:', error);
    }

    return null;
  },

  async searchVideos(query, maxResults = 10, filters = {}) {
    this.ensureApiKey();
    const apiKey = this.getApiKey();
    
    if (!apiKey) {
      Utils.showError('API key required for search');
      return [];
    }

    if (!query.trim()) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        maxResults: String(maxResults),
        q: query,
        key: apiKey
      });

      // Apply filters
      if (filters.duration) params.set('videoDuration', filters.duration);
      if (filters.definition) params.set('videoDefinition', filters.definition);
      if (filters.order) params.set('order', filters.order);
      if (filters.publishedAfter) params.set('publishedAfter', filters.publishedAfter);

      const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        return [];
      }

      return data.items.map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.default?.url || '',
        channelTitle: item.snippet.channelTitle
      }));
    } catch (error) {
      console.error('YouTube search error:', error);
      Utils.showError(`Search failed: ${error.message}`);
      return [];
    }
  }
};

// ===========================
// Playlist Module
// ===========================
const Playlist = {
  save() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.PLAYLIST, JSON.stringify(AppState.playlist));
      console.log('Playlist saved:', AppState.playlist.length, 'videos');
    } catch (error) {
      console.error('Failed to save playlist:', error);
    }
  },

  load() {
    try {
      const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.PLAYLIST);
      
      if (saved) {
        AppState.playlist = JSON.parse(saved);
        console.log('Playlist loaded:', AppState.playlist.length, 'videos');
      }

      // Use default playlist if empty
      if (!AppState.playlist || AppState.playlist.length === 0) {
        AppState.playlist = [...CONFIG.DEFAULT_PLAYLIST];
        console.log('Using default playlist');
      }

      this.render();
      this.enhanceMissingTitles();

      if (AppState.playlist.length > 0) {
        Player.loadVideo(0);
      }
    } catch (error) {
      console.error('Failed to load playlist:', error);
      AppState.playlist = [...CONFIG.DEFAULT_PLAYLIST];
      this.render();
    }
  },

  async enhanceMissingTitles() {
    YouTubeAPI.ensureApiKey();
    if (!YouTubeAPI.getApiKey()) return;

    let hasChanges = false;

    for (let i = 0; i < AppState.playlist.length; i++) {
      const video = AppState.playlist[i];
      
      // Check if title needs enhancement
      if (!video.title || video.title.startsWith('Video ') || video.title === '') {
        const details = await YouTubeAPI.fetchVideoDetails(video.id);
        
        if (details && details.title) {
          AppState.playlist[i].title = details.title;
          AppState.playlist[i].thumbnail = details.thumbnail || video.thumbnail;
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      this.save();
      this.render();
    }
  },

  add(videoId, title = '', thumbnail = '') {
    if (!videoId) {
      Utils.showError('Invalid video ID');
      return;
    }

    // Check for duplicates
    if (AppState.playlist.some(v => v.id === videoId)) {
      Utils.showError('Video already in playlist');
      return;
    }

    AppState.playlist.push({
      id: videoId,
      title: title || `Video ${AppState.playlist.length + 1}`,
      thumbnail: thumbnail || ''
    });

    this.save();
    this.render();
    console.log('Video added:', videoId);

    // Try to fetch details if we have API key
    if (YouTubeAPI.getApiKey() && !title) {
      YouTubeAPI.fetchVideoDetails(videoId).then(details => {
        if (details) {
          const index = AppState.playlist.findIndex(v => v.id === videoId);
          if (index !== -1) {
            AppState.playlist[index].title = details.title;
            AppState.playlist[index].thumbnail = details.thumbnail;
            this.save();
            this.render();
          }
        }
      });
    }
  },

  remove(index) {
    if (AppState.playlist.length <= 1) {
      Utils.showError('Cannot remove the last video');
      return;
    }

    if (index < 0 || index >= AppState.playlist.length) {
      console.error('Invalid playlist index:', index);
      return;
    }

    AppState.playlist.splice(index, 1);

    // Adjust current index if needed
    if (AppState.currentIndex >= AppState.playlist.length) {
      AppState.currentIndex = AppState.playlist.length - 1;
    }

    this.save();
    this.render();
    Player.loadVideo(AppState.currentIndex);
    console.log('Video removed at index:', index);
  },

  render() {
    const container = Utils.getElement('playlistItems');
    if (!container) return;

    container.innerHTML = '';

    if (AppState.playlist.length === 0) {
      container.innerHTML = '<div style="color:rgba(255,255,255,0.6);padding:12px;text-align:center;">Playlist is empty</div>';
      return;
    }

    AppState.playlist.forEach((video, index) => {
      const item = document.createElement('div');
      item.className = 'playlist-item' + (index === AppState.currentIndex ? ' active' : '');
      item.setAttribute('role', 'listitem');
      item.setAttribute('data-index', index);

      const indicator = index === AppState.currentIndex ? '▶' : '○';
      const thumbHtml = video.thumbnail 
        ? `<img src="${video.thumbnail}" alt="" style="width:40px;height:24px;object-fit:cover;border-radius:3px">` 
        : '';

      item.innerHTML = `
        <span style="width:20px;flex-shrink:0">${indicator}</span>
        ${thumbHtml}
        <span class="title">${video.title || `Video ${index + 1}`}</span>
        <button class="remove" data-index="${index}" aria-label="Remove video">✕</button>
      `;

      // Click to play
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('remove')) {
          Player.loadVideo(index);
        }
      });

      container.appendChild(item);
    });

    // Attach remove button listeners
    container.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.getAttribute('data-index'), 10);
        this.remove(index);
      });
    });
  }
};

// ===========================
// Player Module
// ===========================
const Player = {
  iframe: null,

  init() {
    this.iframe = Utils.getElement('player');
    if (!this.iframe) {
      console.error('Player iframe not found');
    }
  },

  loadVideo(index) {
    if (!this.iframe || !AppState.playlist || AppState.playlist.length === 0) {
      return;
    }

    // Validate index
    index = Math.max(0, Math.min(index, AppState.playlist.length - 1));
    AppState.currentIndex = index;

    const video = AppState.playlist[index];
    this.iframe.src = `https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`;
    
    Playlist.render();
    console.log('Loading video:', video.title);
  },

  playNow(videoId) {
    if (!this.iframe || !videoId) return;

    this.iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&modestbranding=1`;
    AppState.currentIndex = -1; // Not from playlist
    Playlist.render();
    console.log('Playing video:', videoId);
  }
};

// ===========================
// Search Module
// ===========================
const Search = {
  panel: null,
  toggle: null,
  input: null,
  button: null,
  autoCloseTimer: null,

  init() {
    this.panel = Utils.getElement('topSearchPanel');
    this.toggle = Utils.getElement('searchToggle');
    this.input = Utils.getElement('topSearchInput');
    this.button = Utils.getElement('topSearchBtn');

    if (!this.panel || !this.toggle) {
      console.error('Search: Missing required elements');
      return;
    }

    this.attachEventListeners();
  },

  attachEventListeners() {
    // Toggle button
    this.toggle.addEventListener('click', () => this.togglePanel());

    // Search button
    if (this.button) {
      this.button.addEventListener('click', () => this.performSearch());
    }

    // Input keyboard handling
    if (this.input) {
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.performSearch();
        } else if (e.key === 'Escape') {
          this.closePanel();
        }
      });
    }

    // Auto-close on mouse leave
    this.panel.addEventListener('mouseenter', () => this.clearAutoClose());
    this.panel.addEventListener('mouseleave', () => this.startAutoClose());

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.panel.classList.contains('open') && 
          !this.panel.contains(e.target) && 
          e.target !== this.toggle) {
        this.closePanel();
      }
    });
  },

  togglePanel() {
    const isOpen = this.panel.classList.toggle('open');
    this.toggle.setAttribute('aria-expanded', isOpen);
    this.panel.setAttribute('aria-hidden', !isOpen);

    if (isOpen) {
      // Close playlist if open
      const playlistPanel = Utils.getElement('playlistPanel');
      const playlistBtn = Utils.getElement('playlistBtn');
      if (playlistPanel && playlistPanel.classList.contains('open')) {
        playlistPanel.classList.remove('open');
        playlistPanel.setAttribute('aria-hidden', 'true');
        if (playlistBtn) {
          playlistBtn.classList.remove('active');
          playlistBtn.setAttribute('aria-expanded', 'false');
        }
      }
      this.input?.focus();
    }

    this.clearAutoClose();
  },

  closePanel() {
    this.panel.classList.remove('open');
    this.panel.setAttribute('aria-hidden', 'true');
    this.toggle.setAttribute('aria-expanded', 'false');
    this.clearAutoClose();
  },

  startAutoClose() {
    if (!this.panel.classList.contains('open')) return;
    
    this.clearAutoClose();
    this.autoCloseTimer = setTimeout(() => {
      this.closePanel();
    }, CONFIG.AUTO_CLOSE_DELAY);
  },

  clearAutoClose() {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  },

  async performSearch() {
    const query = this.input?.value.trim();
    if (!query) return;

    const filters = this.getFilters();
    const results = await YouTubeAPI.searchVideos(query, 8, filters);
    this.renderResults(results);
    this.startAutoClose();
  },

  getFilters() {
    // Placeholder for future filter implementation
    return {};
  },

  renderResults(results) {
    const container = Utils.getElement('topSearchResults');
    if (!container) return;

    container.innerHTML = '';

    if (!results || results.length === 0) {
      container.innerHTML = '<div style="color:rgba(255,255,255,0.6);padding:8px;text-align:center;">No results found</div>';
      return;
    }

    results.forEach((result) => {
      const item = document.createElement('div');
      item.className = 'playlist-item';
      item.setAttribute('role', 'listitem');

      item.innerHTML = `
        <img src="${result.thumbnail}" alt="${result.title}" style="width:56px;height:36px;object-fit:cover;border-radius:3px;flex-shrink:0">
        <div style="display:flex;flex-direction:column;overflow:hidden;min-width:0;flex:1">
          <div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${result.title}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.6)">${result.channelTitle}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="play-result" data-id="${result.id}" style="padding:6px 8px;border-radius:4px;background:rgba(20,120,200,0.7);border:1px solid rgba(50,160,240,0.2);cursor:pointer;color:white;font-size:11px">Play</button>
          <button class="add-result" data-id="${result.id}" style="padding:6px 8px;border-radius:4px;background:rgba(0,128,0,0.6);border:1px solid rgba(0,200,0,0.2);cursor:pointer;color:white;font-size:11px">Add</button>
        </div>
      `;

      container.appendChild(item);
    });

    // Attach event listeners
    container.querySelectorAll('.play-result').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        Player.playNow(id);
        this.closePanel();
      });
    });

    container.querySelectorAll('.add-result').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        YouTubeAPI.ensureApiKey();
        
        let details = null;
        if (YouTubeAPI.getApiKey()) {
          details = await YouTubeAPI.fetchVideoDetails(id);
        }

        Playlist.add(
          id,
          details?.title || `Video ${AppState.playlist.length + 1}`,
          details?.thumbnail || ''
        );
        
        this.closePanel();
      });
    });
  }
};

// ===========================
// UI Controls Module
// ===========================
const UIControls = {
  init() {
    this.initBlurToggle();
    this.initPlaylistToggle();
    this.initAddVideo();
    this.initDrag();
  },

  initBlurToggle() {
    const blurToggle = Utils.getElement('blurToggle');
    if (!blurToggle) return;

    // Load saved state
    const blurEnabled = localStorage.getItem(CONFIG.STORAGE_KEYS.BLUR_STATE) !== 'false';
    document.documentElement.style.setProperty('--blur-enabled', blurEnabled ? '1' : '0');
    blurToggle.textContent = blurEnabled ? '🔒 Blur ON' : '🔓 Blur OFF';

    blurToggle.addEventListener('click', () => {
      const current = document.documentElement.style.getPropertyValue('--blur-enabled');
      const newState = current === '1' ? '0' : '1';
      
      document.documentElement.style.setProperty('--blur-enabled', newState);
      blurToggle.textContent = newState === '1' ? '🔒 Blur ON' : '🔓 Blur OFF';
      localStorage.setItem(CONFIG.STORAGE_KEYS.BLUR_STATE, newState === '1' ? 'true' : 'false');
    });
  },

  initPlaylistToggle() {
    const playlistBtn = Utils.getElement('playlistBtn');
    const playlistPanel = Utils.getElement('playlistPanel');
    
    if (!playlistBtn || !playlistPanel) return;

    playlistBtn.addEventListener('click', () => {
      const isOpen = playlistPanel.classList.toggle('open');
      playlistBtn.classList.toggle('active');
      playlistBtn.setAttribute('aria-expanded', isOpen);
      playlistPanel.setAttribute('aria-hidden', !isOpen);

      // Close search if open
      if (isOpen) {
        const searchPanel = Utils.getElement('topSearchPanel');
        const searchToggle = Utils.getElement('searchToggle');
        if (searchPanel && searchPanel.classList.contains('open')) {
          searchPanel.classList.remove('open');
          searchPanel.setAttribute('aria-hidden', 'true');
          if (searchToggle) {
            searchToggle.setAttribute('aria-expanded', 'false');
          }
        }
      }
    });
  },

  initAddVideo() {
    const addBtn = Utils.getElement('addVideoBtn');
    const input = Utils.getElement('videoInput');
    
    if (!addBtn || !input) return;

    const addVideo = () => {
      const value = input.value.trim();
      if (!value) return;

      const videoId = Utils.extractVideoId(value);
      if (!videoId) {
        Utils.showError('Invalid YouTube URL or Video ID');
        return;
      }

      Playlist.add(videoId);
      input.value = '';
    };

    addBtn.addEventListener('click', addVideo);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addVideo();
      }
    });
  },

  initDrag() {
    const dragHandle = Utils.getElement('dragHandle');
    const playerWrapper = Utils.getElement('playerWrapper');
    
    if (!dragHandle || !playerWrapper) return;

    let startX = 0, startY = 0, origLeft = 0, origTop = 0;

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();

      const rect = playerWrapper.getBoundingClientRect();
      
      playerWrapper.style.width = rect.width + 'px';
      playerWrapper.style.height = rect.height + 'px';
      playerWrapper.style.position = 'fixed';
      playerWrapper.style.left = rect.left + 'px';
      playerWrapper.style.top = rect.top + 'px';
      playerWrapper.style.margin = '0';

      startX = e.clientX;
      startY = e.clientY;
      origLeft = rect.left;
      origTop = rect.top;
      AppState.isDragging = true;

      dragHandle.setPointerCapture?.(e.pointerId);
      document.body.style.userSelect = 'none';
    };

    const onPointerMove = (e) => {
      if (!AppState.isDragging) return;
      e.preventDefault();

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = playerWrapper.offsetWidth;
      const h = playerWrapper.offsetHeight;

      let newLeft = Math.max(8, Math.min(origLeft + dx, vw - w - 8));
      let newTop = Math.max(8, Math.min(origTop + dy, vh - h - 8));

      playerWrapper.style.left = newLeft + 'px';
      playerWrapper.style.top = newTop + 'px';
    };

    const onPointerUp = (e) => {
      if (!AppState.isDragging) return;
      
      AppState.isDragging = false;
      try { 
        dragHandle.releasePointerCapture?.(e.pointerId); 
      } catch (err) {
        console.warn('Could not release pointer capture:', err);
      }
      document.body.style.userSelect = '';
    };

    // Double-click to reset position
    dragHandle.addEventListener('dblclick', () => {
      playerWrapper.style.position = '';
      playerWrapper.style.left = '';
      playerWrapper.style.top = '';
      playerWrapper.style.width = '';
      playerWrapper.style.height = '';
      playerWrapper.style.margin = '';
    });

    dragHandle.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    dragHandle.addEventListener('lostpointercapture', onPointerUp);
  }
};

// ===========================
// Background Module
// ===========================
const Background = {
  init() {
    this.setRandom();
    setInterval(() => this.setRandom(), CONFIG.BACKGROUND_SHUFFLE_INTERVAL);
  },

  setRandom() {
    const randomImage = CONFIG.BACKGROUND_IMAGES[
      Math.floor(Math.random() * CONFIG.BACKGROUND_IMAGES.length)
    ];
    document.documentElement.style.setProperty('--bg-url', `url('${randomImage}')`);
    console.log('Background changed');
  }
};

// ===========================
// Application Initialization
// ===========================
const App = {
  init() {
    console.log('UnWrapped - Initializing...');

    try {
      // Initialize all modules
      Clock.init();
      Player.init();
      Playlist.load();
      Search.init();
      UIControls.init();
      Background.init();

      console.log('UnWrapped - Initialized successfully');
    } catch (error) {
      console.error('Initialization failed:', error);
      Utils.showError('Failed to initialize application. Please refresh the page.');
    }
  }
};

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}