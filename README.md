# ⚡ Flash Dash

> A beautiful, distraction-free new tab extension for Chrome. Big clock, goal photos, tasks, and bookmarks — all in one sleek dashboard.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blueviolet?style=flat-square)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![No Build Step](https://img.shields.io/badge/Build-None-success?style=flat-square)

---

## Features

| Feature | Description |
|---|---|
| 🕐 **Clock & Focus Timer** | Large time display with AM/PM and date. Double-click the clock/background or press `Esc` to toggle **Focus Mode**, which activates a customizable countdown timer with interactive controls, progress-based background dimming, warm bell chime synthesis, and desktop notification alerts. |
| 🖼️ **Photo Board** | Drag, resize, and layer goal/inspiration images, or drag-and-drop image files directly from your desktop. Features smart snapping to align centers and edges with nearby photos, and an interface lock. |
| 🫥 **Ghost Grid Pinned Shortcuts** | Hover beneath the clock to reveal a hidden shortcut tile grid. Pin up to 8 custom web links with automatic favicon fetching. |
| ✅ **Tasks** | Lightweight persistent to-do list on the right panel with dedicated grab handles for drag-and-drop reordering, and inline double-click editing. |
| 🔖 **Bookmarks** | Slide-out bookmarks drawer with real-time text searching to quickly access all your Chrome bookmarks. |
| 🌙 **Theme & Styling** | Sleek glassmorphic aesthetics. Dark / light mode toggle persisted across tabs. |

---

## Gestures & Keyboard Shortcuts

### 🖱️ Gestures
* **Double-click** background or clock to toggle Focus Mode.
* **Hover** under the clock to reveal your Ghost Grid shortcuts.
* **Drag & drop** image files from your computer to pin them directly to the whiteboard.
* **Drag/Resize** whiteboard photos to align them. Edges and centers automatically snap to neighboring photos within a 12px range.

### ⌨️ Keybinds
* <kbd>Esc</kbd> — Toggle Focus Mode (when inputs aren't focused) or close open drawers.
* <kbd>Enter</kbd> — Save inline task edits or add a new task.
* **Timer Shortcuts (Focus Mode Active)**:
  * <kbd>Space</kbd> — Play / Pause the countdown.
  * <kbd>R</kbd> — Reset the timer.
  * <kbd>M</kbd> — Mute / Unmute completion sound.

---

## Installation

> No build step required — Flash Dash is pure HTML, CSS, and JavaScript.

### 1. Download the files

### 2. Open Chrome Extensions

Navigate to `chrome://extensions` in your browser.

### 3. Enable Developer Mode

Toggle **Developer mode** in the top-right corner of the extensions page.

### 4. Load the extension

Click **Load unpacked** and select the `flash-dash/` folder (the one containing `manifest.json`).

### 5. Open a new tab

Press `Ctrl+T` — Flash Dash replaces the default new tab page.

---

## Permissions

The extension requests only the minimum permissions needed:

| Permission | Why it's needed |
|---|---|
| `storage` | Persists tasks, theme preference, whiteboard layout locks, shortcuts, and background settings |
| `unlimitedStorage` | Allows the database to save high-resolution background and whiteboard photos without browser storage limits |
| `bookmarks` | Reads your Chrome bookmarks to populate the bookmarks drawer |
| `tabs` | Required to query and navigate current tabs when you open a bookmark |

---

## Project Structure

```
flash-dash/
├── manifest.json       # Chrome Extension Manifest V3 config
├── newtab.html         # New tab page markup (loaded by Chrome on Ctrl+T)
├── style.css           # All styles — design tokens, layout, components
├── script.js           # All dashboard runtime logic — clock, photos, tasks, etc.
├── icons/
│   ├── icon16.png      # Toolbar icon (16×16)
│   ├── icon48.png      # Extensions page icon (48×48)
│   └── icon128.png     # Chrome Web Store icon (128×128)
└── README.md           # This file
```

---

## Development

### No build tooling needed

Open any file directly in your editor. Changes are reflected immediately after reloading the extension:

1. Edit a file
2. Go to `chrome://extensions`
3. Click the **↺ refresh** icon on the Flash Dash card
4. Open a new tab

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
| `photos` | `Array<{id, xPercent, yPercent, w, h, z}>` | Whiteboard layout coordinates (in screen percentages), dimensions, and z-index layering |
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

| What | Details |
|---|---|
| **Local storage only** | All configurations, shortcuts, and tasks are stored exclusively in `chrome.storage.local` on your own device |
| **No servers** | Flash Dash has no backend, no analytics, no telemetry, and no accounts |
| **No tracking** | No cookies, no fingerprinting, no usage tracking of any kind |
| **Photos stay local** | Images you add to the board and background are stored locally as binary Blobs in IndexedDB — they are never uploaded anywhere |
| **Bookmarks** | The extension reads your bookmarks locally via the Chrome API to display them in the drawer. They are never transmitted externally |

This extension is designed to be fully auditable — the entire codebase is plain HTML, CSS, and JavaScript with no minification or obfuscation.
