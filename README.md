# ⚡ Flash Dash

> A premium, distraction-free new tab extension for Chrome. Glassmorphic cards, tasks lists, bookmarks drawers, whiteboard, and a typographic Focus Countdown timer.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blueviolet?style=flat-square)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![No Build Step](https://img.shields.io/badge/Build-None-success?style=flat-square)

---

## Premium Core Features

| Feature | Description |
|---|---|
| 🕐 **Focus Countdown** | Premium geometric display using `Plus Jakarta Sans` thin numerals. Double-click the background or clock to enter **Focus Mode**. Choose logically ordered presets (**5m, 10m, 25m, 50m**) that sync active states automatically. Includes a scale-down micro-tick animation on each second. |
| 🖼️ **Goal Whiteboard** | Drag, resize, and layer inspiration images, or drag-and-drop image files directly from your desktop. Snaps alignment to screen margins. Toolbar overlays automatically hide during resizing/dragging to stay out of your way. |
| 🫥 **Ghost Grid Shortcuts** | Hover beneath the date to reveal a hidden grid of quick web links with automatic favicon fetching. |
| ✅ **Tasks & Bookmarks Drawer** | Slide-out panels with real-time text searching for Chrome bookmarks and a drag-and-drop to-do manager for tasks. |
| 🌙 **Theme Toggle** | Persistent light and dark theme mode toggle in the toolbar. |

---

## Gestures & Keyboard Shortcuts

### 🖱️ Gestures
* **Double-click** background or clock to toggle Focus Mode.
* **Hover Under Clock** to reveal the Ghost Grid shortcuts.
* **Drag & drop** image files from your computer to pin them directly to the whiteboard.
* **Drag/Resize** photos; toolbars hide automatically and edge snaps align items seamlessly.

### ⌨️ Keybinds
* <kbd>Esc</kbd> — Toggle Focus Mode (when inputs aren't focused) or close open drawers.
* <kbd>Enter</kbd> — Save inline task edits or add a new task.
* **Timer Shortcuts (Focus Mode Active)**:
  * <kbd>Space</kbd> — Play / Pause the countdown.
  * <kbd>R</kbd> — Reset the timer.
  * <kbd>M</kbd> — Mute / Unmute completion chime sound.

---

## Project Structure

No build step required — Flash Dash is pure HTML, CSS, and modular JavaScript.

```
flash-dash/
├── manifest.json       # Chrome Extension Manifest V3 config
├── newtab.html         # Onboarding cards, layouts, and DOM structure
├── style.css           # Glassmorphic tokens, transitions, and layout
├── storage.js          # IndexedDB wrapper and chrome.storage sync loops
├── ui.js               # Background images upload, dim/blur sliders, and theme manager
├── whiteboard.js       # Drag, resize, photo snap calculations, and overlay freeze hooks
├── timer.js            # Focus session states, presets, and tick animations
├── modal.js            # Interactive onboarding modal card manager
└── icons/
    ├── icon16.png      # Toolbar icon (16×16)
    ├── icon48.png      # Extensions page icon (48×48)
    └── icon128.png     # Chrome Web Store icon (128×128)
```

---

## Storage & Database Architecture

Flash Dash uses a hybrid local storage system to optimize performance and prevent storage quota limits:

### 1. IndexedDB (`FlashDashDB`)
Large binary assets are stored as raw `Blob` objects under `AssetsStore`:
* `bgImage`: The screen-wide custom background image file.
* `photo_img_<photoId>`: Pinned whiteboard images.

### 2. Chrome Storage (`chrome.storage.local`)
Lightweight configuration states and JSON objects. Key reference:

| Key | Type | Description |
|---|---|---|
| `theme` | `"dark" \| "light"` | Current colour theme |
| `tasks` | `Array<{text, done}>` | Task list |
| `photos` | `Array<{id, xPercent, yPercent, w, h, z}>` | Whiteboard layout coordinates, dimensions, and layering |
| `boardLocked` | `boolean` | Whether the photo whiteboard is locked |
| `bgImage` | `"MIGRATED" \| null` | Migration state sentinel for background image |
| `bgDim` | `number` | Overlay dimness percentage (0–90) |
| `bgBlur` | `number` | Background blur value in pixels (0–20) |
| `shortcuts` | `Array<{title, url}>` | List of pinned Ghost Grid shortcuts |
| `focusMode` | `boolean` | Focus Mode active state |
| `focusTimerState` | `"idle" \| "running" \| "paused" \| "finished"` | Focus timer state |
| `focusTimerEndTimestamp` | `number` | Target end timestamp for running timer |
| `focusTimerRemaining` | `number` | Remaining milliseconds on pause/idle |
| `focusTimerDuration` | `number` | Default timer duration (minutes) |
| `focusTimerSoundEnabled` | `boolean` | Play synthesizer sound on timer finish |

---

## Privacy

**Flash Dash collects zero personal data.**

* **Local storage only**: All configurations, shortcuts, and tasks are stored exclusively in local storage on your own device.
* **No data portability exports/imports**: No data is packed or sent elsewhere.
* **No servers**: Flash Dash has no backend, no analytics, no telemetry, and no tracking.
* **Photos stay local**: Images you add to the board and background are stored locally as binary Blobs in IndexedDB — they are never uploaded anywhere.
