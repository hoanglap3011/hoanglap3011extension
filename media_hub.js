// Media Hub Controller
(function() {
  'use strict';

  let mediaData = [];
  let updateInterval = null;

  // Format time (seconds to MM:SS)
  function formatTime(seconds) {
    if (!isFinite(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Get domain name from URL
  function getDomainName(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }

  // Create media item HTML
  function createMediaItem(media) {
    console.log('[Media Hub] Creating item for:', media.title, 'isSpotify:', media.isSpotify);
    
    const statusText = media.isPlaying ? 'Đang phát' : 'Tạm dừng';
    const statusClass = media.isPlaying ? 'playing' : '';
    const progress = media.duration > 0 ? (media.currentTime / media.duration) * 100 : 0;
    
    let thumbnailHtml;
    if (media.thumbnail) {
      thumbnailHtml = `<img src="${media.thumbnail}" alt="Thumbnail">`;
    } else if (media.isVideo) {
      thumbnailHtml = `<div class="thumbnail-placeholder">🎬</div>`;
    } else {
      thumbnailHtml = `<div class="thumbnail-placeholder">🎵</div>`;
    }

    return `
      <div class="media-item" data-tab-id="${media.tabId}">
        <div class="thumbnail">
          ${thumbnailHtml}
        </div>
        <div class="media-info">
          <div class="media-header">
            <div class="media-title">${media.title}</div>
            <div class="media-status">
              <span class="status-dot ${statusClass}"></span>
              ${statusText}
            </div>
          </div>
          <div class="media-source">${getDomainName(media.tabUrl)}</div>
          
          <div class="progress-container">
            <div class="progress-time">
              <span>${formatTime(media.currentTime)}</span>
              <span>${formatTime(media.duration)}</span>
            </div>
            <div class="progress-bar" data-tab-id="${media.tabId}">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
          </div>

          <div class="controls">
            ${media.canPlayPrevious ? `
              <button class="control-btn" data-action="previous" data-tab-id="${media.tabId}" title="Previous">
                <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              </button>
            ` : ''}
            
            <button class="control-btn" data-action="seekBackward" data-tab-id="${media.tabId}" title="Backward 10s">
              <svg viewBox="0 0 24 24"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8zm-1.1 11h-.85v-3.26l-1.01.31v-.69l1.77-.63h.09V16zm4.28-1.76c0 .32-.03.6-.1.82s-.17.42-.29.57-.28.26-.45.33-.37.1-.59.10-.41-.03-.59-.1-.33-.18-.46-.33-.23-.34-.3-.57-.11-.5-.11-.82v-.74c0-.32.03-.6.1-.82s.17-.42.29-.57.28-.26.45-.33.37-.1.59-.1.41.03.59.1.33.18.46.33.23.34.3.57.11.5.11.82v.74zm-.85-.86c0-.19-.01-.35-.04-.48s-.07-.23-.12-.31-.11-.14-.19-.17-.16-.05-.25-.05-.18.02-.25.05-.14.09-.19.17-.09.18-.12.31-.04.29-.04.48v.97c0 .19.01.35.04.48s.07.24.12.32.11.14.19.17.16.05.25.05.18-.02.25-.05.14-.09.19-.17.09-.19.11-.32.04-.29.04-.48v-.97z"/></svg>
            </button>

            <button class="control-btn primary" data-action="toggle" data-tab-id="${media.tabId}" title="${media.isPlaying ? 'Pause' : 'Play'}">
              ${media.isPlaying ? `
                <svg viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
              ` : `
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              `}
            </button>

            <button class="control-btn" data-action="seekForward" data-tab-id="${media.tabId}" title="Forward 10s">
              <svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8zm-.03 11h-.85v-3.26l-1.01.31v-.69l1.77-.63h.09V16zm3.43-1.76c0 .32-.03.6-.1.82s-.17.42-.29.57-.28.26-.45.33-.37.1-.59.1-.41-.03-.59-.1-.33-.18-.46-.33-.23-.34-.3-.57-.11-.5-.11-.82v-.74c0-.32.03-.6.1-.82s.17-.42.29-.57.28-.26.45-.33.37-.1.59-.1.41.03.59.1.33.18.46.33.23.34.3.57.11.5.11.82v.74zm-.85-.86c0-.19-.01-.35-.04-.48s-.07-.23-.12-.31-.11-.14-.19-.17-.16-.05-.25-.05-.18.02-.25.05-.14.09-.19.17-.09.18-.12.31-.04.29-.04.48v.97c0 .19.01.35.04.48s.07.24.12.32.11.14.19.17.16.05.25.05.18-.02.25-.05.14-.09.19-.17.09-.19.11-.32.04-.29.04-.48v-.97z"/></svg>
            </button>

            ${media.canPlayNext ? `
              <button class="control-btn" data-action="next" data-tab-id="${media.tabId}" title="Next">
                <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </button>
            ` : ''}

            <div class="volume-control">
              <button class="control-btn" data-action="toggleMute" data-tab-id="${media.tabId}" title="${media.muted ? 'Unmute' : 'Mute'}">
                ${media.muted || media.volume === 0 ? `
                  <svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                ` : media.volume > 0.5 ? `
                  <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                ` : `
                  <svg viewBox="0 0 24 24"><path d="M7 9v6h4l5 5V4l-5 5H7z"/></svg>
                `}
              </button>
              ${!media.isSpotify ? `
                <input type="range" class="volume-slider" min="0" max="100" value="${Math.round(media.volume * 100)}" data-tab-id="${media.tabId}">
              ` : `
                <div style="font-size: 11px; color: #9aa0a6; margin-left: 8px;">${Math.round(media.volume * 100)}%</div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Render media list
  function renderMediaList() {
    const container = document.getElementById('mediaContainer');
    
    if (mediaData.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
          </svg>
          <h2>Không tìm thấy media</h2>
          <p>Hãy mở một trang web có video hoặc audio và thử lại</p>
        </div>
      `;
      return;
    }

    const html = mediaData.map(media => createMediaItem(media)).join('');
    container.innerHTML = `<div class="media-list">${html}</div>`;
    
    attachEventListeners();
  }

  // Attach event listeners to controls
  function attachEventListeners() {
    // Control buttons
    document.querySelectorAll('.control-btn').forEach(btn => {
      btn.addEventListener('click', handleControlClick);
    });

    // Volume sliders
    document.querySelectorAll('.volume-slider').forEach(slider => {
      slider.addEventListener('input', handleVolumeChange);
    });

    // Progress bars
    document.querySelectorAll('.progress-bar').forEach(bar => {
      bar.addEventListener('click', handleProgressClick);
    });

    // Media items (for focus tab)
    document.querySelectorAll('.media-item').forEach(item => {
      item.addEventListener('click', handleMediaItemClick);
    });
  }

  // Handle control button clicks
  function handleControlClick(e) {
    e.stopPropagation();
    const action = this.dataset.action;
    const tabId = parseInt(this.dataset.tabId);
    
    let command = action;
    let value = null;

    if (action === 'toggleMute') {
      const media = mediaData.find(m => m.tabId === tabId);
      command = media.muted ? 'unmute' : 'mute';
    }

    chrome.runtime.sendMessage({
      action: 'controlMedia',
      tabId: tabId,
      command: command,
      value: value
    }, () => {
      // Đợi lâu hơn cho Spotify để UI cập nhật
      const media = mediaData.find(m => m.tabId === tabId);
      const delay = media && media.isSpotify ? 800 : 500;
      setTimeout(loadMediaData, delay);
    });
  }

  // Handle volume change
  function handleVolumeChange(e) {
    e.stopPropagation();
    const tabId = parseInt(this.dataset.tabId);
    const volume = parseInt(this.value) / 100;

    chrome.runtime.sendMessage({
      action: 'controlMedia',
      tabId: tabId,
      command: 'volume',
      value: volume
    }, () => {
      // Refresh ngay để cập nhật UI
      setTimeout(loadMediaData, 500);
    });
  }

  // Handle progress bar click
  function handleProgressClick(e) {
    e.stopPropagation();
    const tabId = parseInt(this.dataset.tabId);
    const media = mediaData.find(m => m.tabId === tabId);
    if (!media || !media.duration) return;

    const rect = this.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const seekTime = percent * media.duration;

    chrome.runtime.sendMessage({
      action: 'controlMedia',
      tabId: tabId,
      command: 'seek',
      value: seekTime
    }, () => {
      setTimeout(loadMediaData, 300);
    });
  }

  // Handle media item click (focus tab)
  function handleMediaItemClick(e) {
    if (e.target.closest('.control-btn, .volume-slider, .progress-bar')) return;
    
    const tabId = parseInt(this.dataset.tabId);
    chrome.runtime.sendMessage({
      action: 'focusTab',
      tabId: tabId
    });
  }

  // Load media data from all tabs
  function loadMediaData() {
    console.log('[Media Hub] Loading media data...');
    chrome.runtime.sendMessage({ action: 'getMediaInfo' }, (response) => {
      console.log('[Media Hub] Response:', response);
      if (response && response.mediaInfos) {
        mediaData = response.mediaInfos;
        console.log('[Media Hub] Media data:', mediaData);
        renderMediaList();
      } else {
        console.log('[Media Hub] No response or empty mediaInfos');
        mediaData = [];
        renderMediaList();
      }
    });
  }

  // Auto refresh every 1 second (nhanh hơn để cập nhật UI real-time)
  function startAutoRefresh() {
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(loadMediaData, 1000);
  }

  function stopAutoRefresh() {
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Media Hub] Initializing...');
    
    // Đợi một chút để đảm bảo content scripts đã sẵn sàng
    setTimeout(() => {
      loadMediaData();
      startAutoRefresh();
    }, 500);

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
      console.log('[Media Hub] Manual refresh');
      loadMediaData();
    });

    // Stop refresh when page is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopAutoRefresh();
      } else {
        startAutoRefresh();
      }
    });
  });

  // Cleanup on unload
  window.addEventListener('beforeunload', stopAutoRefresh);

})();