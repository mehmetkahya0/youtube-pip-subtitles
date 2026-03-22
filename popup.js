/**
 * YouTube PiP Subtitles - Popup Script
 * Reads, updates, and saves settings to chrome.storage.sync.
 */

// GoatCounter: increment counter every time popup is opened
fetch('https://mehmetkahya.goatcounter.com/count?p=/popup-opened', {
  method: 'GET', mode: 'no-cors'
}).catch(() => {});

const defaults = {
  fontSize: 16,
  fontFamily: 'Trebuchet MS',
  textColor: '#ffffff',
  bgOpacity: 75,
  position: 'bottom',
};

// Elements
const fontSizeInput   = document.getElementById('font-size');
const fontSizeVal     = document.getElementById('font-size-val');
const fontFamilyInput = document.getElementById('font-family');
const textColorInput  = document.getElementById('text-color');
const bgOpacityInput  = document.getElementById('bg-opacity');
const bgOpacityVal    = document.getElementById('bg-opacity-val');
const previewText     = document.getElementById('preview-text');
const saveIndicator   = document.getElementById('save-indicator');
const resetBtn        = document.getElementById('reset-btn');
const statusDot       = document.getElementById('status-dot');
const statusText      = document.getElementById('status-text');
const posButtons      = document.querySelectorAll('.toggle-btn[data-pos]');

let saveTimer = null;

// ─── Load ────────────────────────────────────────────────────────────────────
chrome.storage.sync.get(defaults, (saved) => {
  fontSizeInput.value   = saved.fontSize;
  fontSizeVal.textContent = saved.fontSize + 'px';
  fontFamilyInput.value = saved.fontFamily;
  textColorInput.value  = saved.textColor;
  bgOpacityInput.value  = saved.bgOpacity;
  bgOpacityVal.textContent = saved.bgOpacity + '%';
  setActivePosition(saved.position);
  updatePreview(saved);
});

// ─── Event Listeners ─────────────────────────────────────────────────────────
fontSizeInput.addEventListener('input', () => {
  fontSizeVal.textContent = fontSizeInput.value + 'px';
  saveAndPreview();
});

fontFamilyInput.addEventListener('change', saveAndPreview);
textColorInput.addEventListener('input', saveAndPreview);

bgOpacityInput.addEventListener('input', () => {
  bgOpacityVal.textContent = bgOpacityInput.value + '%';
  saveAndPreview();
});

posButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setActivePosition(btn.dataset.pos);
    saveAndPreview();
  });
});

resetBtn.addEventListener('click', () => {
  fontSizeInput.value    = defaults.fontSize;
  fontSizeVal.textContent = defaults.fontSize + 'px';
  fontFamilyInput.value  = defaults.fontFamily;
  textColorInput.value   = defaults.textColor;
  bgOpacityInput.value   = defaults.bgOpacity;
  bgOpacityVal.textContent = defaults.bgOpacity + '%';
  setActivePosition(defaults.position);
  saveAndPreview();
});

// ─── Save & Preview ──────────────────────────────────────────────────────────
function saveAndPreview() {
  const current = getCurrentSettings();
  updatePreview(current);

  // Save with debounce
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // Build bgColor as string
    const opacity = (current.bgOpacity / 100).toFixed(2);
    const toSave = {
      ...current,
      bgColor: `rgba(0,0,0,${opacity})`,
    };
    chrome.storage.sync.set(toSave, () => {
      flashSaved();
    });
  }, 400);
}

function getCurrentSettings() {
  const activePos = document.querySelector('.toggle-btn.active');
  return {
    fontSize:   parseInt(fontSizeInput.value),
    fontFamily: fontFamilyInput.value,
    textColor:  textColorInput.value,
    bgOpacity:  parseInt(bgOpacityInput.value),
    position:   activePos ? activePos.dataset.pos : 'bottom',
  };
}

function updatePreview(s) {
  const opacity = ((s.bgOpacity ?? 75) / 100).toFixed(2);
  previewText.style.fontSize   = (s.fontSize || 16) + 'px';
  previewText.style.fontFamily = `"${s.fontFamily || 'Trebuchet MS'}", sans-serif`;
  previewText.style.color      = s.textColor || '#ffffff';
  previewText.style.background = `rgba(0,0,0,${opacity})`;
}

function setActivePosition(pos) {
  posButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.pos === pos);
  });
}

function flashSaved() {
  saveIndicator.classList.add('show');
  setTimeout(() => saveIndicator.classList.remove('show'), 1800);
}

// ─── PiP Status Check ────────────────────────────────────────────────────────
// Query the active YouTube tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]) return;
  const url = tabs[0].url || '';
  if (url.includes('youtube.com/watch')) {
    statusDot.classList.add('active');
    statusText.textContent = 'Active on YouTube video page';
  } else if (url.includes('youtube.com')) {
    statusText.textContent = 'Go to a video page';
  } else {
    statusText.textContent = 'Works on YouTube';
  }
});
