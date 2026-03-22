/**
 * YouTube PiP Subtitles v3
 * 
 * Strategy: Fetch subtitle data from YouTube's timedtext/caption API,
 * sync with video.currentTime. NO dependency on YouTube DOM.
 * 
 * This approach works because:
 * - ytInitialPlayerResponse contains caption track URLs
 * - Subtitles can be fetched in JSON3 format from these URLs
 * - Timing is done via video.currentTime polling
 * - Video element is not moved, captureStream is not used
 */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let pipWindow     = null;
  let pipSubEl      = null;
  let syncInterval  = null;
  let captionData   = [];     // [{start, end, text}]
  let activeTrack   = null;   // selected caption track info
  let allTracks     = [];

  let settings = {
    fontSize: 16, fontFamily: 'Trebuchet MS',
    textColor: '#ffffff', bgColor: 'rgba(0,0,0,0.75)', position: 'bottom',
  };

  chrome.storage.sync.get(settings, (s) => { settings = { ...settings, ...s }; });
  chrome.storage.onChanged.addListener((changes) => {
    for (const k in changes) settings[k] = changes[k].newValue;
    applyStylesToOverlay();
  });

  // ── YouTube SPA navigation ────────────────────────────────────────────────
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      captionData = []; activeTrack = null; allTracks = [];
      setTimeout(init, 2000);
    }
  }).observe(document.body, { subtree: true, childList: true });

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1500))
    : setTimeout(init, 1500);

  // GoatCounter analytics
  const gc = (path) => fetch("https://mehmetkahya.goatcounter.com/count?p=" + path, { method: "GET", mode: "no-cors" }).catch(() => {});

  // Ping 1: extension active on YouTube video page
  if (location.pathname.startsWith("/watch")) gc("/extension-active");

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    if (!location.pathname.startsWith('/watch')) return;
    tryInjectButton();
    loadCaptionTracks();
  }

  // ── Inject Button ─────────────────────────────────────────────────────────
  // Add button to both the player toolbar and as a large floating button on the video
  function tryInjectButton() {
    injectToolbarButton();
    injectFloatingButton();
  }

  function injectToolbarButton() {
    if (document.getElementById('pip-sub-btn')) return;
    const rightControls = document.querySelector('.ytp-right-controls');
    if (!rightControls) { setTimeout(injectToolbarButton, 1000); return; }

    const btn = document.createElement('button');
    btn.id = 'pip-sub-btn';
    btn.className = 'ytp-button pip-sub-button';
    btn.title = 'PiP + Subtitles';
    btn.innerHTML = buildToolbarSVG(false);
    btn.addEventListener('click', handlePipToggle);

    const nativePip = rightControls.querySelector('.ytp-pip-button');
    nativePip ? rightControls.insertBefore(btn, nativePip) : rightControls.prepend(btn);
  }

  function injectFloatingButton() {
    if (document.getElementById('pip-sub-float')) return;
    const player = document.querySelector('#movie_player, .html5-video-player');
    if (!player) { setTimeout(injectFloatingButton, 1000); return; }

    const btn = document.createElement('button');
    btn.id = 'pip-sub-float';
    btn.textContent = '▶  PiP + Subtitles';
    btn.style.cssText = `
      position: absolute;
      top: 12px; left: 12px;
      z-index: 9999;
      background: rgba(255,0,0,0.85);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 600;
      font-family: sans-serif;
      cursor: pointer;
      letter-spacing: 0.03em;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      transition: opacity 0.2s, background 0.2s;
      opacity: 0;
    `;
    btn.addEventListener('click', handlePipToggle);

    // Show on hover
    player.addEventListener('mouseover', () => { btn.style.opacity = '1'; });
    player.addEventListener('mouseout', () => { btn.style.opacity = '0'; });

    player.style.position = 'relative';
    player.appendChild(btn);
  }

  function buildToolbarSVG(active) {
    const c = active ? '#ff4444' : 'white';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%">
      <rect x="3" y="7" width="30" height="20" rx="2.5" stroke="${c}" stroke-width="2.2" fill="none"/>
      <rect x="19" y="17" width="12" height="8" rx="1.8" fill="${c}"/>
      <text x="25" y="24.5" font-size="5" font-family="Arial" font-weight="bold"
            fill="${active ? '#fff' : '#111'}" text-anchor="middle">CC</text>
    </svg>`;
  }

  // ── Caption Track Loading ─────────────────────────────────────────────────
  function loadCaptionTracks() {
    try {
      // Read from ytInitialPlayerResponse global variable
      const pr = window.ytInitialPlayerResponse;
      if (pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        allTracks = pr.captions.playerCaptionsTracklistRenderer.captionTracks;
        console.log('[PiP-CC] Track count:', allTracks.length, allTracks.map(t => t.languageCode));
        // Prefer Turkish, then English, then first available
        activeTrack = allTracks.find(t => t.languageCode === 'tr')
                   || allTracks.find(t => t.languageCode === 'en')
                   || allTracks[0];
        if (activeTrack) prefetchCaptions(activeTrack);
        return;
      }
    } catch(e) {}

    // Retry if page hasn't loaded yet
    setTimeout(loadCaptionTracks, 2000);
  }

  async function prefetchCaptions(track) {
    try {
      const url = track.baseUrl + '&fmt=json3';
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      captionData = parseCaptionJSON3(data);
      console.log('[PiP-CC] Subtitles loaded:', captionData.length, 'cues');
    } catch (e) {
      console.warn('[PiP-CC] Failed to load subtitles:', e.message);
      captionData = [];
    }
  }

  function parseCaptionJSON3(data) {
    if (!data?.events) return [];
    return data.events
      .filter(ev => ev.segs && ev.tStartMs !== undefined)
      .map(ev => ({
        start: ev.tStartMs / 1000,
        end:   (ev.tStartMs + (ev.dDurationMs || 3000)) / 1000,
        text:  ev.segs.map(s => s.utf8 || '').join('').trim(),
      }))
      .filter(ev => ev.text && ev.text !== '\n');
  }

  // ── PiP Toggle ────────────────────────────────────────────────────────────
  async function handlePipToggle() {
    if (pipWindow && !pipWindow.closed) { pipWindow.close(); return; }

    if (!('documentPictureInPicture' in window)) {
      showToast('⚠️ Chrome 116+ required (Document PiP API)');
      return;
    }

    const video = getVideo();
    if (!video) { showToast('⚠️ Video not found'); return; }

    // Warn if no subtitles but continue
    if (captionData.length === 0) {
      console.warn('[PiP-CC] No pre-loaded subtitles, trying YouTube DOM fallback.');
    }

    try {
      const w = video.videoWidth || 1280, h = video.videoHeight || 720;
      const pipW = 480, pipH = Math.round((pipW * h) / w);

      pipWindow = await documentPictureInPicture.requestWindow({
        width: pipW, height: pipH, preferInitialWindowPlacement: true,
      });

      setupPipWindow(pipWindow, video);
      updateButtonState(true);
      gc("/pip-opened");

      const floatBtn = document.getElementById('pip-sub-float');
      if (floatBtn) floatBtn.textContent = '✕  Close PiP';

    } catch (err) {
      console.error('[PiP-CC]', err);
      showToast('❌ ' + err.message);
    }
  }

  // ── PiP Window Setup ──────────────────────────────────────────────────────
  function setupPipWindow(win, video) {
    const doc = win.document;
    doc.title = 'YouTube PiP';

    // Styles
    const style = doc.createElement('style');
    style.id = 'pip-styles';
    style.textContent = buildCSS();
    doc.head.appendChild(style);

    // Wrapper
    const wrapper = doc.createElement('div');
    wrapper.id = 'pip-wrapper';
    doc.body.appendChild(wrapper);

    // Video: try captureStream, fall back to moving element
    let streamOk = false;
    try {
      const stream = video.captureStream?.();
      if (stream?.getVideoTracks().length > 0) {
        const pv = doc.createElement('video');
        pv.autoplay = true; pv.muted = true; pv.playsInline = true;
        pv.srcObject = stream;
        pv.style.cssText = 'width:100%;height:100%;display:block;object-fit:contain;';
        wrapper.appendChild(pv);
        streamOk = true;
        console.log('[PiP-CC] captureStream OK');
      }
    } catch(e) {
      console.warn('[PiP-CC] captureStream failed:', e.message);
    }

    if (!streamOk) {
      win._origParent = video.parentNode;
      win._origNext   = video.nextSibling;
      video.style.cssText = 'width:100%;height:100%;display:block;object-fit:contain;background:#000;';
      wrapper.appendChild(video);
      console.log('[PiP-CC] Video element moved.');
    }

    // Subtitle overlay
    const overlay = doc.createElement('div');
    overlay.id = 'pip-sub-overlay';
    const subBox = doc.createElement('div');
    subBox.id = 'pip-sub-box';
    overlay.appendChild(subBox);
    wrapper.appendChild(overlay);
    pipSubEl = subBox;

    startSync(video, win, streamOk);
    win.addEventListener('pagehide', () => onPipClose(video, streamOk, win));
  }

  // ── Subtitle Synchronization ──────────────────────────────────────────────
  function startSync(video, win, streamOk) {
    // If captureStream was used, main video reference is correct,
    // if element was moved, use the video from win.document
    let lastText = '';

    syncInterval = setInterval(() => {
      if (!pipSubEl) return;

      const vid = streamOk ? video : (win.document?.querySelector('video') || video);
      const t   = vid.currentTime;
      let text  = '';

      // 1. First check prefetched caption data
      if (captionData.length > 0) {
        const matches = captionData.filter(c => t >= c.start && t < c.end);
        text = matches.map(c => c.text).join(' ').trim();
      }

      // 2. Fallback: active caption element in YouTube DOM
      if (!text) {
        const domText = getDOMCaptions();
        if (domText) text = domText;
      }

      if (text === lastText) return;
      lastText = text;

      pipSubEl.innerHTML = text
        ? text.split('\n')
            .filter(l => l.trim())
            .map(l => `<span class="pip-line">${escapeHtml(l.trim())}</span>`)
            .join('')
        : '';

    }, 100);
  }

  // YouTube DOM caption text fallback
  const SELECTORS = [
    '.ytp-caption-segment',
    '.captions-text',
    '[class*="caption-visual-line"]',
  ];

  function getDOMCaptions() {
    for (const sel of SELECTORS) {
      const els = [...document.querySelectorAll(sel)];
      const lines = els
        .filter(el => {
          const cs = getComputedStyle(el);
          return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
        })
        .map(el => el.textContent?.trim())
        .filter(Boolean);
      if (lines.length) return lines.join(' ');
    }
    return '';
  }

  // ── Track Selection (for multiple languages) ─────────────────────────────
  // When user selects a language on YouTube, mirror that selection
  function watchActiveTrack() {
    // Find YouTube's active caption track
    setInterval(() => {
      const activeSel = document.querySelector('.ytp-menuitem[aria-checked="true"] .ytp-menuitem-label');
      if (!activeSel || !allTracks.length) return;
      const label = activeSel.textContent?.trim();
      const match = allTracks.find(t =>
        t.name?.simpleText === label || t.languageCode === label?.slice(0,2).toLowerCase()
      );
      if (match && match !== activeTrack) {
        activeTrack = match;
        prefetchCaptions(match);
      }
    }, 2000);
  }

  // ── CSS ────────────────────────────────────────────────────────────────────
  function buildCSS() {
    const pos = settings.position === 'top' ? 'top:5%' : 'bottom:5%';
    return `
      *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
      html,body{width:100%;height:100%;background:#000;overflow:hidden}
      #pip-wrapper{position:relative;width:100%;height:100%}
      video{width:100%;height:100%;display:block;object-fit:contain;background:#000}
      #pip-sub-overlay{
        position:absolute;left:0;right:0;${pos};
        display:flex;justify-content:center;align-items:flex-end;
        pointer-events:none;z-index:9999;padding:0 4%
      }
      #pip-sub-box{
        display:flex;flex-direction:column;align-items:center;gap:3px;max-width:100%
      }
      .pip-line{
        display:inline-block;
        background:${settings.bgColor};
        color:${settings.textColor};
        font-size:${settings.fontSize}px;
        font-family:"${settings.fontFamily}",sans-serif;
        font-weight:500;line-height:1.5;
        padding:3px 12px 4px;border-radius:3px;
        max-width:100%;word-wrap:break-word;text-align:center;
        -webkit-font-smoothing:antialiased
      }
    `;
  }

  function applyStylesToOverlay() {
    if (!pipWindow?.document) return;
    const el = pipWindow.document.getElementById('pip-styles');
    if (el) el.textContent = buildCSS();
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  function onPipClose(video, streamOk, win) {
    clearInterval(syncInterval); syncInterval = null;
    pipSubEl = null;

    if (!streamOk) {
      const v = win.document?.querySelector('video');
      if (v && win._origParent) {
        if (win._origNext?.parentNode === win._origParent)
          win._origParent.insertBefore(v, win._origNext);
        else
          win._origParent.appendChild(v);
        v.style.cssText = '';
      }
    }

    pipWindow = null;
    updateButtonState(false);
    const floatBtn = document.getElementById('pip-sub-float');
    if (floatBtn) floatBtn.textContent = '▶  PiP + Subtitles';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getVideo() {
    return document.querySelector('video.html5-main-video')
        || document.querySelector('#movie_player video')
        || document.querySelector('video');
  }

  function updateButtonState(active) {
    const btn = document.getElementById('pip-sub-btn');
    if (btn) btn.innerHTML = buildToolbarSVG(active);
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function showToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'background:rgba(0,0,0,0.9);color:#fff;padding:10px 20px;border-radius:8px;' +
      'font-size:14px;z-index:99999;font-family:sans-serif;pointer-events:none;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // Watch for track changes
  setTimeout(watchActiveTrack, 3000);

})();
