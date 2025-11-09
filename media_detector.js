// Media Detector - Phát hiện và điều khiển media trong trang
(function() {
  'use strict';

  let currentMedia = null;
  let mediaObserver = null;
  let isReady = false;

  console.log('[Media Detector] Script loaded on:', window.location.href);

  // Hàm tìm tất cả media elements trong trang
  function findMediaElements() {
    let videos = Array.from(document.querySelectorAll('video'));
    let audios = Array.from(document.querySelectorAll('audio'));
    
    // Spotify Web Player - có nhiều cách khác nhau để tìm
    if (window.location.hostname.includes('spotify.com')) {
      console.log('[Media Detector] Searching for Spotify audio...');
      
      // Cách 1: Tìm tất cả audio trong document
      const allAudios = document.getElementsByTagName('audio');
      console.log('[Media Detector] Found audio tags:', allAudios.length);
      audios.push(...Array.from(allAudios));
      
      // Cách 2: Tìm trong iframes
      try {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          try {
            const iframeAudios = iframe.contentDocument?.querySelectorAll('audio');
            if (iframeAudios) {
              audios.push(...Array.from(iframeAudios));
              console.log('[Media Detector] Found audio in iframe:', iframeAudios.length);
            }
          } catch (e) {
            // Cross-origin iframe
          }
        });
      } catch (e) {
        console.log('[Media Detector] Cannot access iframes:', e);
      }
      
      // Cách 3: Tìm trong Shadow DOM
      try {
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.shadowRoot) {
            const shadowAudios = el.shadowRoot.querySelectorAll('audio');
            if (shadowAudios.length > 0) {
              audios.push(...Array.from(shadowAudios));
              console.log('[Media Detector] Found audio in shadow DOM:', shadowAudios.length);
            }
          }
        });
      } catch (e) {
        console.log('[Media Detector] Cannot access shadow DOM:', e);
      }
      
      console.log('[Media Detector] Total Spotify audios found:', audios.length);
    }
    
    return [...videos, ...audios];
  }

  // Hàm lấy thông tin từ media element
  function getMediaInfo(mediaElement) {
    if (!mediaElement) return null;

    const isVideo = mediaElement.tagName === 'VIDEO';
    let title = document.title || 'Unknown';
    let thumbnail = '';

    // Lấy thumbnail
    if (isVideo) {
      thumbnail = mediaElement.poster || '';
      
      // Thử lấy từ YouTube
      if (!thumbnail && window.location.hostname.includes('youtube.com')) {
        const videoId = new URLSearchParams(window.location.search).get('v');
        if (videoId) {
          thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
      }
      
      // Nếu không có poster, thử lấy từ canvas
      if (!thumbnail && mediaElement.readyState >= 2) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 120;
          canvas.height = 90;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(mediaElement, 0, 0, 120, 90);
          thumbnail = canvas.toDataURL();
        } catch (e) {
          // CORS issue, không thể lấy thumbnail
          console.log('[Media Detector] Cannot capture thumbnail:', e.message);
        }
      }
    }

    // Lấy thông tin bổ sung từ YouTube
    if (window.location.hostname.includes('youtube.com')) {
      const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string') || 
                          document.querySelector('h1.title yt-formatted-string') ||
                          document.querySelector('#container h1 yt-formatted-string');
      if (titleElement) {
        title = titleElement.textContent.trim();
      }
    }

    // Lấy thông tin từ Netflix
    if (window.location.hostname.includes('netflix.com')) {
      const titleElement = document.querySelector('.video-title');
      if (titleElement) {
        title = titleElement.textContent.trim();
      }
    }

    // Lấy thông tin từ Facebook
    if (window.location.hostname.includes('facebook.com')) {
      const titleElement = document.querySelector('[role="main"] h2') || 
                          document.querySelector('[role="article"] span[dir="auto"]');
      if (titleElement) {
        title = titleElement.textContent.trim().substring(0, 100);
      }
    }

    // Lấy thông tin từ Spotify
    if (window.location.hostname.includes('spotify.com')) {
      // Lấy tên bài hát
      const trackName = document.querySelector('[data-testid="context-item-link"]') ||
                       document.querySelector('a[href*="/track/"]') ||
                       document.querySelector('[class*="TrackListRow"] a');
      
      // Lấy nghệ sĩ
      const artistName = document.querySelector('[data-testid="context-item-info-artist"]') ||
                        document.querySelector('a[href*="/artist/"]');
      
      if (trackName && artistName) {
        title = `${trackName.textContent.trim()} - ${artistName.textContent.trim()}`;
      } else if (trackName) {
        title = trackName.textContent.trim();
      }
      
      // Lấy thumbnail từ album art
      const albumArt = document.querySelector('img[data-testid="cover-art-image"]') ||
                      document.querySelector('[class*="CoverArt"] img') ||
                      document.querySelector('img[src*="i.scdn.co"]');
      if (albumArt && albumArt.src) {
        thumbnail = albumArt.src;
      }
    }

    return {
      hasMedia: true,
      isPlaying: !mediaElement.paused && !mediaElement.ended,
      isPaused: mediaElement.paused,
      currentTime: mediaElement.currentTime,
      duration: mediaElement.duration,
      volume: mediaElement.volume,
      muted: mediaElement.muted,
      title: title,
      thumbnail: thumbnail,
      isVideo: isVideo,
      src: mediaElement.src || mediaElement.currentSrc,
      canPlayNext: hasNextVideo(),
      canPlayPrevious: hasPreviousVideo()
    };
  }

  // Kiểm tra có video tiếp theo không (YouTube)
  function hasNextVideo() {
    if (window.location.hostname.includes('youtube.com')) {
      const nextButton = document.querySelector('.ytp-next-button');
      return nextButton && !nextButton.hasAttribute('disabled') && nextButton.getAttribute('aria-disabled') !== 'true';
    }
    
    // Spotify Next
    if (window.location.hostname.includes('spotify.com')) {
      const nextButton = document.querySelector('[data-testid="control-button-skip-forward"]') ||
                        document.querySelector('button[aria-label*="Next"]');
      return !!nextButton && !nextButton.disabled;
    }
    
    return false;
  }

  // Kiểm tra có video trước đó không (YouTube)
  function hasPreviousVideo() {
    if (window.location.hostname.includes('youtube.com')) {
      const prevButton = document.querySelector('.ytp-prev-button');
      return prevButton && !prevButton.hasAttribute('disabled') && prevButton.getAttribute('aria-disabled') !== 'true';
    }
    
    // Spotify Previous
    if (window.location.hostname.includes('spotify.com')) {
      const prevButton = document.querySelector('[data-testid="control-button-skip-back"]') ||
                        document.querySelector('button[aria-label*="Previous"]');
      return !!prevButton && !prevButton.disabled;
    }
    
    return false;
  }

  // Tìm media element chính (đang active hoặc có duration lớn nhất)
  function findPrimaryMedia() {
    const mediaElements = findMediaElements();
    
    console.log('[Media Detector] Found media elements:', mediaElements.length);
    
    if (mediaElements.length === 0) return null;

    // Ưu tiên media đang phát
    const playing = mediaElements.find(m => !m.paused && !m.ended);
    if (playing) {
      console.log('[Media Detector] Found playing media');
      return playing;
    }

    // Ưu tiên media có duration hợp lệ
    const validMedia = mediaElements.filter(m => m.duration && isFinite(m.duration) && m.duration > 0);
    if (validMedia.length > 0) {
      // Lấy media có duration lớn nhất
      const selected = validMedia.reduce((prev, current) => {
        if (!prev) return current;
        return (current.duration > prev.duration) ? current : prev;
      }, null);
      console.log('[Media Detector] Found media with duration:', selected.duration);
      return selected;
    }

    // Fallback: lấy media đầu tiên
    console.log('[Media Detector] Using first media element');
    return mediaElements[0];
  }

  // Hàm điều khiển media
  function controlMedia(command, value) {
    currentMedia = findPrimaryMedia();
    if (!currentMedia) {
      console.log('[Media Detector] No media found for control');
      return { success: false, error: 'No media found' };
    }

    console.log('[Media Detector] Control command:', command);

    try {
      switch (command) {
        case 'play':
          currentMedia.play();
          break;
        case 'pause':
          currentMedia.pause();
          break;
        case 'toggle':
          if (currentMedia.paused) {
            currentMedia.play();
          } else {
            currentMedia.pause();
          }
          break;
        case 'seek':
          currentMedia.currentTime = value;
          break;
        case 'seekForward':
          currentMedia.currentTime = Math.min(currentMedia.duration, currentMedia.currentTime + (value || 10));
          break;
        case 'seekBackward':
          currentMedia.currentTime = Math.max(0, currentMedia.currentTime - (value || 10));
          break;
        case 'volume':
          currentMedia.volume = Math.max(0, Math.min(1, value));
          break;
        case 'mute':
          currentMedia.muted = true;
          break;
        case 'unmute':
          currentMedia.muted = false;
          break;
        case 'next':
          if (window.location.hostname.includes('youtube.com')) {
            const nextButton = document.querySelector('.ytp-next-button');
            if (nextButton) nextButton.click();
          } else if (window.location.hostname.includes('spotify.com')) {
            const nextButton = document.querySelector('[data-testid="control-button-skip-forward"]') ||
                              document.querySelector('button[aria-label*="Next"]');
            if (nextButton) nextButton.click();
          }
          break;
        case 'previous':
          if (window.location.hostname.includes('youtube.com')) {
            const prevButton = document.querySelector('.ytp-prev-button');
            if (prevButton) prevButton.click();
          } else if (window.location.hostname.includes('spotify.com')) {
            const prevButton = document.querySelector('[data-testid="control-button-skip-back"]') ||
                              document.querySelector('button[aria-label*="Previous"]');
            if (prevButton) prevButton.click();
          }
          break;
        default:
          return { success: false, error: 'Unknown command' };
      }
      return { success: true };
    } catch (error) {
      console.error('[Media Detector] Control error:', error);
      return { success: false, error: error.message };
    }
  }

  // Lắng nghe tin nhắn từ background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Media Detector] Received message:', request.action);

    if (request.action === "getMediaState") {
      currentMedia = findPrimaryMedia();
      const mediaInfo = currentMedia ? getMediaInfo(currentMedia) : { hasMedia: false };
      console.log('[Media Detector] Media info:', mediaInfo);
      sendResponse(mediaInfo);
      return true;
    }

    if (request.action === "mediaControl") {
      const result = controlMedia(request.command, request.value);
      sendResponse(result);
      return true;
    }

    return false;
  });

  // Theo dõi sự thay đổi của DOM để phát hiện media mới
  function startObserving() {
    console.log('[Media Detector] Starting observation');
    
    if (mediaObserver) mediaObserver.disconnect();

    mediaObserver = new MutationObserver(() => {
      const newMedia = findPrimaryMedia();
      if (newMedia !== currentMedia) {
        currentMedia = newMedia;
        console.log('[Media Detector] Media changed');
      }
    });

    mediaObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    isReady = true;
  }

  // Khởi tạo khi trang load xong
  function initialize() {
    console.log('[Media Detector] Initializing...');
    
    // Đợi một chút để đảm bảo media elements đã load
    setTimeout(() => {
      startObserving();
      currentMedia = findPrimaryMedia();
      
      if (currentMedia) {
        console.log('[Media Detector] Initial media found:', currentMedia.tagName);
      } else {
        console.log('[Media Detector] No initial media found');
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();