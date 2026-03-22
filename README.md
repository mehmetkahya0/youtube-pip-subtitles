<div align="center">

# 📺 YouTube PiP Subtitles

**A Chrome extension that shows subtitles inside the Picture-in-Picture window — the way it should have always worked.**

[![Chrome](https://img.shields.io/badge/Chrome-116%2B-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://www.google.com/chrome/)
[![Manifest](https://img.shields.io/badge/Manifest-V3-orange?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## The Problem

When you pop a YouTube video into Picture-in-Picture mode, subtitles vanish. They keep running on the black bar back on the main page — completely useless.

YouTube renders subtitles as an HTML overlay on top of the video player. When the browser's native PiP grabs the `<video>` element, it leaves all the HTML behind. Nobody fixed this. So here we are.

## How It Works

Instead of fighting with YouTube's DOM, this extension fetches the subtitle data directly from YouTube's internal timedtext API (`ytInitialPlayerResponse`), parses the JSON3 caption format, and syncs it against `video.currentTime` at 100ms intervals. The result is displayed as a clean overlay inside a [Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture/) window — which unlike native PiP, can contain actual HTML.

```
YouTube timedtext API
        ↓
  Parse JSON3 captions  →  [{start, end, text}, ...]
        ↓
  video.currentTime sync (100ms)
        ↓
  Overlay inside Document PiP window  ✓
```

## Features

- ✅ Subtitles rendered inside the PiP window, in sync with the video
- ✅ All languages supported — whichever track you select on YouTube
- ✅ Customizable font size, font family, text color, background opacity, position
- ✅ Works with auto-generated captions
- ✅ DOM fallback if timedtext API is unavailable
- ✅ YouTube SPA navigation support (works when switching between videos)

## Installation

> **Requires Chrome 116 or later** — earlier versions don't support the Document Picture-in-Picture API.

### From source

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the project folder
5. Done — the extension is now active on all YouTube pages

## Usage

1. Open any YouTube video
2. Enable subtitles using YouTube's **CC button** and select your language
3. Hover over the video — click the red **▶ PiP + Subtitle** button in the top-left corner
   *(or use the small CC icon in the player's bottom-right controls)*
4. A PiP window opens with your video — subtitles appear inside it

To close, click the button again or simply close the PiP window.

## Customization

Click the extension icon in Chrome's toolbar to open the settings panel:

| Setting | Options |
|---|---|
| Font Size | 10px – 32px |
| Font Family | Trebuchet MS, Arial, Georgia, Verdana, Courier New, Impact |
| Text Color | Any color via color picker |
| Background Opacity | 0% – 100% |
| Position | Bottom / Top |

Settings are saved via `chrome.storage.sync` and apply instantly to the active PiP window.

## Technical Notes

**Why not `captureStream()`?**
YouTube's media pipeline triggers security restrictions on `captureStream()` for many videos. Even when it succeeds, moving the video element breaks YouTube's caption engine entirely. The timedtext API approach sidesteps both issues.

**Why Document PiP instead of native PiP?**
The native `requestPictureInPicture()` API only supports the raw `<video>` element with no HTML overlay capability. `documentPictureInPicture.requestWindow()` (Chrome 116+) opens a full browsing context where arbitrary HTML can be rendered — which is exactly what subtitle overlays need.

**Caption sync accuracy**
Captions are synced every 100ms against `video.currentTime`. YouTube's JSON3 format provides millisecond-level timing per cue event, so sync is accurate to within one polling interval.

## Browser Compatibility

| Browser | Support |
|---|---|
| Chrome 116+ | ✅ Full support |
| Chrome < 116 | ❌ Document PiP API unavailable |
| Firefox | ❌ No Document PiP API support yet |
| Edge 116+ | ✅ Should work (Chromium-based) |

## Contributing

Issues and pull requests are welcome. The main areas worth improving:

- **Netflix / Prime Video support** — similar approach, different caption format
- **In-PiP language switcher** — change subtitle track without going back to the main page
- **Subtitle delay adjustment** — manual offset for out-of-sync cases
- **Dual subtitles** — show two languages simultaneously

## License

MIT — do whatever you want with it.

---

<div align="center">
<sub>Built because YouTube should have shipped this years ago.</sub>
</div>
