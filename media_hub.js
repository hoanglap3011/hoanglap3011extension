// Media Hub Controller
(function() {
  'use strict';

  let mediaData = [];
  let updateInterval = null;
  let isLoading = false;        // chống chồng request khi lần quét trước chưa xong
  let activeTabId = null;       // media đang được chọn để nhận phím tắt (Space / ↑ / ↓)
  const VOLUME_STEP = 0.05;     // mỗi lần nhấn ↑/↓ tăng/giảm 5%

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
      // Trang extension (neo_anchor) — hostname là extension id, hiển thị tên thay thế
      if (urlObj.protocol === 'chrome-extension:') return 'Neo Anchor';
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }

  // Create media item HTML
  function createMediaItem(media) {
    
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
            ${media.isSpotify ? `
              <!-- Spotify controls: Previous, Play/Pause, Next, Mute + Volume % -->
              ${media.canPlayPrevious ? `
                <button class="control-btn" data-action="previous" data-tab-id="${media.tabId}" title="Previous">
                  <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                </button>
              ` : ''}

              <button class="control-btn primary" data-action="toggle" data-tab-id="${media.tabId}" title="${media.isPlaying ? 'Pause' : 'Play'}">
                ${media.isPlaying ? `
                  <svg viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                ` : `
                  <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                `}
              </button>

              ${media.canPlayNext ? `
                <button class="control-btn" data-action="next" data-tab-id="${media.tabId}" title="Next">
                  <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                </button>
              ` : ''}

              <div class="volume-control">
                <button class="control-btn" data-action="toggleMute" data-tab-id="${media.tabId}" title="${media.muted ? 'Unmute' : 'Mute'}">
                  ${media.muted ? `
                    <svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                  ` : `
                    <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                  `}
                </button>
              </div>
            ` : `
              <!-- Non-Spotify controls: Previous, Seek Back, Play/Pause, Seek Forward, Next, Mute + Volume Slider -->
              ${media.canPlayPrevious ? `
                <button class="control-btn" data-action="previous" data-tab-id="${media.tabId}" title="Previous">
                  <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                </button>
              ` : ''}
              
              <button class="control-btn" data-action="seekBackward" data-tab-id="${media.tabId}" title="Backward 10s">
                <svg viewBox="0 0 24 24"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8zm-1.1 11h-.85v-3.26l-1.01.31v-.69l1.77-.63h.09V16zm4.28-1.76c0 .32-.03.6-.1.82s-.17.42-.29.57-.28.26-.45.33-.37.1-.59.1-.41-.03-.59-.1-.33-.18-.46-.33-.23-.34-.3-.57-.11-.5-.11-.82v-.74c0-.32.03-.6.1-.82s.17-.42.29-.57.28-.26.45-.33.37-.1.59-.1.41.03.59.1.33.18.46.33.23.34.3.57.11.5.11.82v.74zm-.85-.86c0-.19-.01-.35-.04-.48s-.07-.23-.12-.31-.11-.14-.19-.17-.16-.05-.25-.05-.18.02-.25.05-.14.09-.19.17-.09.18-.12.31-.04.29-.04.48v.97c0 .19.01.35.04.48s.07.24.12.32.11.14.19.17.16.05.25.05.18-.02.25-.05.14-.09.19-.17.09-.19.11-.32.04-.29.04-.48v-.97z"/></svg>
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
                <input type="range" class="volume-slider" min="0" max="100" value="${Math.round(media.volume * 100)}" data-tab-id="${media.tabId}">
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // Update existing media item without full re-render
  function updateMediaItem(element, media) {
    // Update status text và dot
    const statusText = element.querySelector('.media-status');
    if (statusText) {
      const dot = statusText.querySelector('.status-dot');
      const text = media.isPlaying ? 'Đang phát' : 'Tạm dừng';
      statusText.innerHTML = `
        <span class="status-dot ${media.isPlaying ? 'playing' : ''}"></span>
        ${text}
      `;
    }

    // Update progress bar
    const progressFill = element.querySelector('.progress-fill');
    if (progressFill && media.duration > 0) {
      const progress = (media.currentTime / media.duration) * 100;
      progressFill.style.width = `${progress}%`;
    }

    // Update time
    const progressTime = element.querySelector('.progress-time');
    if (progressTime) {
      progressTime.innerHTML = `
        <span>${formatTime(media.currentTime)}</span>
        <span>${formatTime(media.duration)}</span>
      `;
    }

    // Update play/pause button
    const playButton = element.querySelector('[data-action="toggle"]');
    if (playButton) {
      playButton.title = media.isPlaying ? 'Pause' : 'Play';
      playButton.innerHTML = media.isPlaying ? `
        <svg viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
      ` : `
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      `;
    }

    // Update mute button icon
    const muteButton = element.querySelector('[data-action="toggleMute"]');
    if (muteButton) {
      muteButton.title = media.muted ? 'Unmute' : 'Mute';
      if (media.isSpotify) {
        muteButton.innerHTML = media.muted ? `
          <svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
        ` : `
          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        `;
      } else {
        muteButton.innerHTML = media.muted || media.volume === 0 ? `
          <svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
        ` : media.volume > 0.5 ? `
          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        ` : `
          <svg viewBox="0 0 24 24"><path d="M7 9v6h4l5 5V4l-5 5H7z"/></svg>
        `;
      }
    }

    // Update volume slider (non-Spotify only)
    if (!media.isSpotify) {
      const volumeSlider = element.querySelector('.volume-slider');
      if (volumeSlider) {
        volumeSlider.value = Math.round(media.volume * 100);
      }
    }
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

    // Kiểm tra xem có cần render lại toàn bộ không
    const existingItems = container.querySelectorAll('.media-item');
    const needsFullRender = existingItems.length !== mediaData.length ||
                           Array.from(existingItems).some((item, index) => {
                             return parseInt(item.dataset.tabId) !== mediaData[index].tabId;
                           });

    if (needsFullRender) {
      // Render toàn bộ nếu số lượng media thay đổi
      const html = mediaData.map(media => createMediaItem(media)).join('');
      container.innerHTML = `<div class="media-list">${html}</div>`;
      attachEventListeners();
    } else {
      // Chỉ update nội dung các item hiện có
      mediaData.forEach((media, index) => {
        updateMediaItem(existingItems[index], media);
      });
    }
    highlightActive();
  }

  // ===== MEDIA ĐANG CHỌN (nhận phím tắt) =====
  // Giữ media đã chọn trước đó; nếu nó không còn thì chọn media đang phát, không có thì media đầu tiên.
  function getActiveMedia() {
    if (!mediaData.length) return null;
    let media = mediaData.find(m => m.tabId === activeTabId);
    if (!media) {
      media = mediaData.find(m => m.isPlaying) || mediaData[0];
      activeTabId = media.tabId;
    }
    return media;
  }

  function highlightActive() {
    const active = getActiveMedia();
    document.querySelectorAll('.media-item').forEach(item => {
      item.classList.toggle('active', !!active && parseInt(item.dataset.tabId) === active.tabId);
    });
  }

  function setActive(tabId) {
    if (activeTabId === tabId) return;
    activeTabId = tabId;
    highlightActive();
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
      // Rê chuột vào item nào thì phím tắt áp dụng cho item đó
      item.addEventListener('mouseenter', () => setActive(parseInt(item.dataset.tabId)));
    });
  }

  // Handle control button clicks
  function handleControlClick(e) {
    e.stopPropagation();
    this.blur();   // bỏ focus khỏi nút, nếu không lần nhấn Space sau sẽ "click" lại nút này
    const action = this.dataset.action;
    const tabId = parseInt(this.dataset.tabId);
    setActive(tabId);
    
    let command = action;
    let value = null;

    if (action === 'toggleMute') {
      const media = mediaData.find(m => m.tabId === tabId);
      command = media.muted ? 'unmute' : 'mute';
    }

    // OPTIMISTIC UPDATE: Cập nhật UI ngay lập tức
    const mediaIndex = mediaData.findIndex(m => m.tabId === tabId);
    if (mediaIndex !== -1) {
      const media = mediaData[mediaIndex];
      
      // Dự đoán trạng thái mới
      if (action === 'toggle') {
        media.isPlaying = !media.isPlaying;
        media.isPaused = !media.isPaused;
      } else if (action === 'toggleMute') {
        media.muted = !media.muted;
      } else if (action === 'next' || action === 'previous') {
        // Reset thời gian về 0 khi chuyển bài
        media.currentTime = 0;
      }
      
      // Render ngay lập tức
      const container = document.getElementById('mediaContainer');
      const items = container.querySelectorAll('.media-item');
      if (items[mediaIndex]) {
        updateMediaItem(items[mediaIndex], media);
      }
    }

    // Gửi command thật
    chrome.runtime.sendMessage({
      action: 'controlMedia',
      tabId: tabId,
      command: command,
      value: value
    }, () => {
      // Refresh sau để đảm bảo sync với trạng thái thật
      const media = mediaData.find(m => m.tabId === tabId);
      const delay = media && media.isSpotify ? 400 : 200;
      setTimeout(loadMediaData, delay);
    });
  }

  // Handle volume change
  function handleVolumeChange(e) {
    e.stopPropagation();
    const tabId = parseInt(this.dataset.tabId);
    const volume = parseInt(this.value) / 100;
    setActive(tabId);

    // OPTIMISTIC UPDATE: Cập nhật UI ngay
    const mediaIndex = mediaData.findIndex(m => m.tabId === tabId);
    if (mediaIndex !== -1) {
      mediaData[mediaIndex].volume = volume;
      
      // Update visual ngay lập tức
      const container = document.getElementById('mediaContainer');
      const items = container.querySelectorAll('.media-item');
      if (items[mediaIndex]) {
        updateMediaItem(items[mediaIndex], mediaData[mediaIndex]);
      }
    }

    chrome.runtime.sendMessage({
      action: 'controlMedia',
      tabId: tabId,
      command: 'volume',
      value: volume
    }, () => {
      // Refresh sau để sync
      setTimeout(loadMediaData, 300);
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

    // OPTIMISTIC UPDATE: Cập nhật progress bar ngay
    const mediaIndex = mediaData.findIndex(m => m.tabId === tabId);
    if (mediaIndex !== -1) {
      mediaData[mediaIndex].currentTime = seekTime;
      
      const container = document.getElementById('mediaContainer');
      const items = container.querySelectorAll('.media-item');
      if (items[mediaIndex]) {
        updateMediaItem(items[mediaIndex], mediaData[mediaIndex]);
      }
    }

    chrome.runtime.sendMessage({
      action: 'controlMedia',
      tabId: tabId,
      command: 'seek',
      value: seekTime
    }, () => {
      setTimeout(loadMediaData, 200);
    });
  }

  // Handle media item click (focus tab)
// Handle media item click (focus tab)
function handleMediaItemClick(e) {
  if (e.target.closest('.control-btn, .volume-slider, .progress-bar')) return;

  const tabId = parseInt(this.dataset.tabId);
  chrome.runtime.sendMessage({
    action: 'focusTab',
    tabId: tabId
  }, () => {
    // Đã focus xong → đóng Media Hub
    window.close();
  });
}
  // Load media data from all tabs
  function loadMediaData() {
    if (isLoading) return;   // lần trước chưa xong thì bỏ qua, tránh dồn request mỗi 2s
    isLoading = true;
    chrome.runtime.sendMessage({ action: 'getMediaInfo' }, (response) => {
      isLoading = false;
      if (chrome.runtime.lastError) { /* service worker vừa thức dậy, lần sau thử lại */ }
      mediaData = (response && response.mediaInfos) ? response.mediaInfos : [];
      renderMediaList();
    });
  }

  // Quét lại từ đầu: hiện loading rồi load ngay.
  // (Trước đây gửi 'rescanMedia' tới mọi tab rồi chờ thêm 300ms — thừa, vì 'getMediaState'
  //  vốn đã gọi findPrimaryMedia() quét lại DOM mỗi lần được hỏi.)
  function forceRescanAndLoad() {
    const container = document.getElementById('mediaContainer');
    container.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Đang quét lại media...</p>
      </div>
    `;
    isLoading = false;
    loadMediaData();
  }

  // Auto refresh every 2 seconds (đủ để cập nhật progress bar)
  function startAutoRefresh() {
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(loadMediaData, 2000);
  }

  function stopAutoRefresh() {
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  }

  // ===== PHÍM TẮT =====
  // Space: play/pause | ↑: tăng âm lượng | ↓: giảm âm lượng
  // Áp dụng cho media đang chọn (viền xanh) — chỉnh volume của chính media đó, giống thanh trượt cạnh icon loa.
  function sendControl(tabId, command, value = null, delay = 300) {
    chrome.runtime.sendMessage({ action: 'controlMedia', tabId, command, value }, () => {
      if (chrome.runtime.lastError) { /* bỏ qua */ }
      setTimeout(loadMediaData, delay);
    });
  }

  function refreshItemUI(media) {
    const idx = mediaData.indexOf(media);
    const items = document.querySelectorAll('#mediaContainer .media-item');
    if (items[idx]) updateMediaItem(items[idx], media);
  }

  function changeVolume(media, delta) {
    const current = media.muted ? 0 : (media.volume || 0);
    const volume = Math.round(Math.max(0, Math.min(1, current + delta)) * 100) / 100;
    // Đang mute mà nhấn ↑ → bỏ mute để nghe được
    if (media.muted && delta > 0) {
      media.muted = false;
      sendControl(media.tabId, 'unmute', null, 0);
    }
    media.volume = volume;
    refreshItemUI(media);
    sendControl(media.tabId, 'volume', volume);
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const isSpace = e.code === 'Space';
    const isUp    = e.key === 'ArrowUp';
    const isDown  = e.key === 'ArrowDown';
    if (!isSpace && !isUp && !isDown) return;

    // Chặn hành vi mặc định: cuộn trang, "click" nút đang focus, thanh trượt tự nhảy giá trị
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();

    const media = getActiveMedia();
    if (!media) return;

    if (isSpace) {
      if (e.repeat) return;   // giữ Space không toggle liên tục
      media.isPlaying = !media.isPlaying;
      media.isPaused  = !media.isPaused;
      refreshItemUI(media);
      sendControl(media.tabId, 'toggle', null, media.isSpotify ? 400 : 200);
      return;
    }
    changeVolume(media, isUp ? VOLUME_STEP : -VOLUME_STEP);
  });

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    // Load ngay khi mở, không chờ thêm (trước đây trễ 300ms + rescan + 300ms)
    loadMediaData();
    startAutoRefresh();

    // Refresh button: quét lại toàn bộ
    document.getElementById('refreshBtn').addEventListener('click', () => {
      stopAutoRefresh();
      forceRescanAndLoad();
      startAutoRefresh();
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
