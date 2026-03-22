/**
 * YouTube PiP Subtitles - Popup Script
 * Ayarları okur, günceller, chrome.storage.sync'e kaydeder.
 */

const defaults = {
  fontSize: 16,
  fontFamily: 'Trebuchet MS',
  textColor: '#ffffff',
  bgOpacity: 75,
  position: 'bottom',
};

// Elementler
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

// ─── Yükle ───────────────────────────────────────────────────────────────────
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

// ─── Kaydet & Önizle ─────────────────────────────────────────────────────────
function saveAndPreview() {
  const current = getCurrentSettings();
  updatePreview(current);

  // Debounce ile kaydet
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // bgColor string olarak oluştur
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

// ─── PiP Durum Kontrolü ──────────────────────────────────────────────────────
// Aktif YouTube sekmesini sorgula
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]) return;
  const url = tabs[0].url || '';
  if (url.includes('youtube.com/watch')) {
    statusDot.classList.add('active');
    statusText.textContent = 'YouTube video sayfasında aktif';
  } else if (url.includes('youtube.com')) {
    statusText.textContent = 'Bir video sayfasına git';
  } else {
    statusText.textContent = 'YouTube\'da çalışır';
  }
});
