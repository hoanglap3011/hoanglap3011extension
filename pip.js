(() => {
  if (!('documentPictureInPicture' in window)) {
    alert('Document Picture-in-Picture is not supported in this browser.');
    return;
  }

  // Guard: avoid adding multiple launch buttons if user clicks extension twice.
  if (window.__pipLauncherAdded) return;
  window.__pipLauncherAdded = true;

  // A tiny launcher button inside the page to obtain a real user gesture.
  const btn = document.createElement('button');
  Object.assign(btn.style, {
    position: 'fixed', top: '16px', right: '16px', zIndex: 2147483647,
    padding: '8px 12px', font: '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    borderRadius: '10px', border: '1px solid #999', background: 'white', cursor: 'pointer'
  });
  btn.textContent = 'Open On-Top PiP';
  document.documentElement.appendChild(btn);

  btn.addEventListener('click', async () => {
    btn.remove();
    try {
      const pip = await documentPictureInPicture.requestWindow({ width: 360, height: 240 });

      const d = pip.document;
      d.head.appendChild(Object.assign(d.createElement('meta'), { name: 'viewport', content: 'width=device-width, initial-scale=1' }));
      const style = d.createElement('style');
      style.textContent = `
        :root { color-scheme: light dark; }
        * { box-sizing: border-box; }
        body {
          margin: 0; height: 100vh;
          font: 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          background: Canvas; color: CanvasText;
        }
        .app {
          display: grid; grid-template: 1fr / 1fr; width: 100%; height: 100%;
        }
        .wrapper {
          justify-self: center; align-self: center;
          transition: transform .18s ease, opacity .18s ease,
                     justify-self .18s ease, align-self .18s ease;
          max-width: 100%;
        }
        body.hover .wrapper {
          justify-self: end; align-self: end; /* slides to bottom-right */
          transform: translate(-8px, -8px);  /* small inset */
          opacity: .98;
        }
        .card {
          background: var(--card-bg, color-mix(in oklab, Canvas 92%, CanvasText 8%));
          border: 1px solid color-mix(in oklab, CanvasText 20%, transparent);
          border-radius: 12px; padding: 10px; min-width: 220px;
          box-shadow: 0 6px 18px rgba(0,0,0,.15);
        }
        .toolbar {
          position: absolute; top: 8px; right: 8px; display: flex; gap: 6px;
        }
        button.ui {
          all: unset; padding: 6px 10px; border-radius: 10px; cursor: pointer;
          border: 1px solid color-mix(in oklab, CanvasText 30%, transparent);
          background: ButtonFace; color: ButtonText;
        }
        button.ui:active { transform: translateY(1px); }
        .hint { position: absolute; bottom: 8px; right: 10px; font-size: 12px; opacity: .7; }
      `;
      d.head.appendChild(style);

      d.body.innerHTML = `
        <div class="app">
          <div class="toolbar">
            <button id="snap" class="ui" title="Resize smaller">Snap smaller</button>
            <button id="close" class="ui" title="Close">Close</button>
          </div>
          <div class="wrapper">
            <div class="card">
              <strong>Always-on-Top Popup</strong>
              <p>Hover over this window and the UI docks to the corner.</p>
              <p><button id="tick" class="ui">Tick</button> <span id="out"></span></p>
            </div>
          </div>
          <div class="hint">Tip: drag this window to any screen corner.</div>
        </div>
      `;

      // Hover -> add/remove class to "dock" content inside the PiP.
      const onEnter = () => d.body.classList.add('hover');
      const onLeave = () => d.body.classList.remove('hover');
      d.body.addEventListener('pointerenter', onEnter);
      d.body.addEventListener('pointerleave', onLeave);

      // Demo logic
      let n = 0;
      d.getElementById('tick').onclick = () => d.getElementById('out').textContent = ` ${++n}`;

      // Click-based resize (requires a user gesture). Not all environments allow programmatic resize; catch failures.
      d.getElementById('snap').onclick = () => {
        try { pip.resizeTo(320, 200); } catch (e) { console.warn('Resize not allowed:', e); }
      };

      d.getElementById('close').onclick = () => pip.close();

      // Optional: focus the PiP window.
      try { pip.focus(); } catch {}
    } catch (err) {
      alert('Failed to open PiP: ' + (err?.message || err));
      console.error(err);
    }
  }, { once: true });
})();