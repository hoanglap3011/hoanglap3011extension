// Spotify Detector - Phát hiện và điều khiển Spotify Web Player
(function() {
  'use strict';

  console.log('[Spotify Detector] Script loaded');

  let lastState = null;

  // Lấy thông tin từ Spotify UI
  function getSpotifyState() {
    try {
      // Kiểm tra có đang phát không
      const playButton = document.querySelector('[data-testid="control-button-playpause"]');
      if (!playButton) {
        console.log('[Spotify Detector] Play button not found');
        return { hasMedia: false };
      }

      const ariaLabel = playButton.getAttribute('aria-label') || '';
      const isPlaying = ariaLabel.toLowerCase().includes('pause') || 
                       ariaLabel.toLowerCase().includes('tạm dừng') ||
                       playButton.querySelector('[data-icon="pause"]') !== null;

      // Lấy thông tin bài hát
      let title = 'Unknown Track';
      let thumbnail = '';

      // Lấy title từ now playing bar
      const titleElement = document.querySelector('[data-testid="context-item-link"]');
      const artistElement = document.querySelector('[data-testid="context-item-info-artist"] a');
      
      if (titleElement && artistElement) {
        title = `${titleElement.textContent.trim()} - ${artistElement.textContent.trim()}`;
      } else if (titleElement) {
        title = titleElement.textContent.trim();
      } else {
        // Fallback: lấy từ document title
        const docTitle = document.title;
        if (docTitle && !docTitle.includes('Spotify - ')) {
          title = docTitle.split(' - Spotify')[0].trim();
        }
      }

      // Lấy album art - thử nhiều selector
      const albumArtSelectors = [
        '.Root__now-playing-bar img[src*="i.scdn.co"]',
        '[data-testid="now-playing-widget"] img',
        'img[src*="mosaic.scdn.co"]',
        '.cover-art img'
      ];
      
      for (const selector of albumArtSelectors) {
        const albumArtElement = document.querySelector(selector);
        if (albumArtElement && albumArtElement.src && !albumArtElement.src.includes('placeholder')) {
          thumbnail = albumArtElement.src;
          break;
        }
      }

      // Lấy thời gian
      const timeElement = document.querySelector('[data-testid="playback-position"]');
      const durationElement = document.querySelector('[data-testid="playback-duration"]');
      
      const currentTime = timeElement ? parseSpotifyTime(timeElement.textContent) : 0;
      const duration = durationElement ? parseSpotifyTime(durationElement.textContent) : 0;

      // Lấy volume
      const volumeButton = document.querySelector('[data-testid="volume-bar-toggle-mute-button"]');
      
      const volumeAriaLabel = volumeButton?.getAttribute('aria-label')?.toLowerCase() || '';
      // Khi CHƯA mute: "Tắt tiếng" / "Mute"
      // Khi ĐÃ mute: "Bật tiếng" / "Unmute"
      let isMuted = volumeAriaLabel.includes('bật') || volumeAriaLabel.includes('unmute');
      
      let volume = 1;
      // Thử tìm volume slider với nhiều selector khác nhau
      const volumeSliderSelectors = [
        'input[data-testid="volume-bar-slider"]',
        '[data-testid="volume-bar"] input[type="range"]',
        'input[aria-label*="olume"]',
        '.volume-bar__slider'
      ];
      
      let volumeSlider = null;
      for (const selector of volumeSliderSelectors) {
        volumeSlider = document.querySelector(selector);
        if (volumeSlider) break;
      }
      
      if (volumeSlider) {
        const ariaValue = volumeSlider.getAttribute('aria-valuenow') || volumeSlider.value;
        if (ariaValue) {
          volume = parseInt(ariaValue) / 100;
        }
      }
      
      console.log('[Spotify Detector] Volume:', volume, 'Muted:', isMuted, 'Aria label:', volumeAriaLabel);

      // Kiểm tra next/previous buttons
      const nextButton = document.querySelector('[data-testid="control-button-skip-forward"]');
      const prevButton = document.querySelector('[data-testid="control-button-skip-back"]');

      const state = {
        hasMedia: true,
        isPlaying: isPlaying,
        isPaused: !isPlaying,
        currentTime: currentTime,
        duration: duration,
        volume: volume,
        muted: isMuted,
        title: title,
        thumbnail: thumbnail,
        isVideo: false,
        src: window.location.href,
        canPlayNext: nextButton && !nextButton.disabled,
        canPlayPrevious: prevButton && !prevButton.disabled,
        isSpotify: true
      };

      console.log('[Spotify Detector] State:', state);
      return state;

    } catch (error) {
      console.error('[Spotify Detector] Error getting state:', error);
      return { hasMedia: false };
    }
  }

  // Parse Spotify time format (MM:SS hoặc HH:MM:SS)
  function parseSpotifyTime(timeString) {
    if (!timeString) return 0;
    
    const parts = timeString.split(':').map(p => parseInt(p, 10));
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }

  // Điều khiển Spotify
  function controlSpotify(command, value) {
    try {
      console.log('[Spotify Detector] Control command:', command, value);

      switch (command) {
        case 'play':
        case 'pause':
        case 'toggle': {
          const playButton = document.querySelector('[data-testid="control-button-playpause"]');
          if (playButton) {
            playButton.click();
            return { success: true };
          }
          break;
        }

        case 'next': {
          const nextButton = document.querySelector('[data-testid="control-button-skip-forward"]');
          if (nextButton && !nextButton.disabled) {
            nextButton.click();
            return { success: true };
          }
          break;
        }

        case 'previous': {
          const prevButton = document.querySelector('[data-testid="control-button-skip-back"]');
          if (prevButton && !prevButton.disabled) {
            prevButton.click();
            return { success: true };
          }
          break;
        }

        case 'seek': {
          // Click vào progress bar
          const progressBar = document.querySelector('[data-testid="playback-progressbar"]');
          if (progressBar && value !== undefined) {
            const state = getSpotifyState();
            if (state.duration > 0) {
              const percent = value / state.duration;
              const rect = progressBar.getBoundingClientRect();
              const x = rect.left + (rect.width * percent);
              const y = rect.top + (rect.height / 2);
              
              progressBar.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                clientX: x,
                clientY: y
              }));
              return { success: true };
            }
          }
          break;
        }

        case 'seekForward': {
          const state = getSpotifyState();
          const newTime = Math.min(state.duration, state.currentTime + (value || 10));
          return controlSpotify('seek', newTime);
        }

        case 'seekBackward': {
          const state = getSpotifyState();
          const newTime = Math.max(0, state.currentTime - (value || 10));
          return controlSpotify('seek', newTime);
        }

        case 'mute':
        case 'unmute': {
          const volumeButton = document.querySelector('[data-testid="volume-bar-toggle-mute-button"]');
          const state = getSpotifyState();
          
          if (volumeButton) {
            const shouldMute = command === 'mute';
            if (state.muted !== shouldMute) {
              volumeButton.click();
            }
            return { success: true };
          }
          break;
        }

        case 'volume': {
          // Spotify Web Player không hỗ trợ set volume qua code
          // Chỉ có thể điều khiển qua UI thủ công hoặc Spotify Desktop app
          console.log('[Spotify Detector] Volume control not supported for Spotify Web');
          return { success: false, error: 'Volume control not supported for Spotify Web' };
        }
      }

      return { success: false, error: 'Command not supported or element not found' };

    } catch (error) {
      console.error('[Spotify Detector] Control error:', error);
      return { success: false, error: error.message };
    }
  }

  // Lắng nghe tin nhắn
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Spotify Detector] Received message:', request.action);

    if (request.action === "getMediaState") {
      const state = getSpotifyState();
      sendResponse(state);
      return true;
    }

    if (request.action === "mediaControl") {
      const result = controlSpotify(request.command, request.value);
      sendResponse(result);
      return true;
    }

    return false;
  });

  console.log('[Spotify Detector] Ready');

})();