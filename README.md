<div align="center">

# ⚡ Flash Dash

**Your personal focus dashboard, vision board, and daily command center right inside your new tab.**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success?style=for-the-badge)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Privacy First](https://img.shields.io/badge/Privacy-100%25%20Local-8A2BE2?style=for-the-badge)](https://github.com/aryankun27-a11y/flash-dash)

<br />

*Every time you open a new tab, avoid digital clutter. Flash Dash transforms your new tab into an inspiring, calm, and distraction-free workspace tailored for focus and goal achievement.*

</div>

---

## 🌟 Highlights

- 🖼️ **Infinite Vision Board**: Pin goal photos, polaroids, and inspiration with full drag-and-drop, zoom, pan, and rotation.
- ⏱️ **Focus Countdown & Pomodoro**: Double-click to enter Focus Mode with customizable duration presets, streak tracking, and built-in synthesizer chimes.
- 📋 **Interactive Tasks Drawer**: Slide-out task manager featuring priorities (Low, Medium, High), live counter badges, and drag-and-drop reordering.
- 🔖 **Instant Bookmarks Access**: Search and browse your entire Chrome bookmarks directory instantly with high-speed filtering.
- 🌓 **Dynamic Dark & Light Modes**: Seamless aesthetic switching with buttery-smooth transitions and glassmorphism styling.
- 🔒 **Whiteboard Freeze & Recenter**: Lock your canvas in place to avoid unwanted shifts, or recenter with a single click.
- 🛡️ **100% Private & Offline-First**: All images and data are stored directly on your machine via `chrome.storage.local` and IndexedDB—zero tracking, zero cloud telemetry.

---

## 📸 Key Features

### 1. Freeform Infinite Whiteboard / Vision Board
- **Pan & Zoom Canvas**: Navigate smoothly across an infinite virtual board.
- **Drag-and-Drop Pinning**: Drag images directly from your desktop or paste them from your clipboard.
- **Polaroid Aesthetic**: Clean borders with realistic tilt, depth shadows, and interactive rotation handles.
- **Lock Board**: Toggle whiteboard locking (`Lock Board`) to freeze your layout and keep everything exactly where you placed it.
- **Recenter Control**: Instant 1-click snap back to the origin coordinate of your canvas.

### 2. Focus Mode & Timer
- **Quick Presets**: Jump straight into focus sessions with 10m, 25m, 30m, 45m, and 60m presets.
- **Custom Duration**: Type in any custom minute count directly into the countdown interface.
- **Streak Tracker**: Keep your daily momentum with visual streak indicators.
- **Web Audio Synthesizer**: Pleasant completion chimes and alerts synthesized dynamically in-browser—no heavy audio assets required.
- **Keyboard Shortcuts**: Quick control during deep work sessions.

### 3. Smart Tasks & To-Dos
- **Priority Categorization**: Assign High, Medium, or Low priority badges to your tasks.
- **Live Badge Counter**: Keeps track of uncompleted tasks directly in the vertical navigation dock.
- **Inline Editing**: Double-click any task label to rename or refine it on the fly.
- **Drag-and-Drop Reordering**: Organize your day by dragging tasks into your ideal order of execution.
- **Batch Cleanup**: Clear all completed tasks with one click.

### 4. Chrome Bookmarks Drawer
- **Quick-Search Filter**: Instantly look up any saved link across all your folders without opening Chrome's heavy bookmark manager.
- **Favicon Integration**: High-resolution site icons for quick visual scanning.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| **Double Click** | Canvas | Enter / Exit Focus Mode |
| **Space** | Focus Mode | Play / Pause Timer |
| **R** | Focus Mode | Reset Timer to initial duration |
| **M** | Focus Mode | Toggle audio chime mute |
| **Esc** | Drawers / Search | Close open drawer / dismiss suggestions |
| **Enter** | Creator Note / Modals | Confirm / Close |

---

## 📦 Installation & Setup

You can load Flash Dash as an unpacked extension into any Chromium-based browser (Google Chrome, Brave, Microsoft Edge, Arc, Opera, etc.):

1. **Clone or Download the Repository**:
   ```bash
   git clone https://github.com/aryankun27-a11y/flash-dash.git
   ```

2. **Open Extensions Page**:
   - In **Google Chrome**: Navigate to `chrome://extensions`
   - In **Brave**: Navigate to `brave://extensions`
   - In **Microsoft Edge**: Navigate to `edge://extensions`

3. **Enable Developer Mode**:
   - Toggle the switch labeled **"Developer mode"** in the top-right corner.

4. **Load the Extension**:
   - Click the **"Load unpacked"** button in the top-left corner.
   - Select the `flash dash` project folder containing `manifest.json`.

5. **Open a New Tab**:
   - Press `Ctrl + T` (or `Cmd + T` on macOS) to experience your new dashboard!

---

## 🏗️ Project Architecture

```
flash-dash/
├── manifest.json       # Manifest V3 extension configuration
├── newtab.html         # Main dashboard layout and semantic structure
├── style.css           # Design system tokens, light/dark themes, glassmorphism
├── script.js           # Core application logic, canvas engine, tasks, timer, storage
├── tutorial.js         # Interactive onboarding tutorial with SVG spotlight masking
├── background.js       # Background service worker (CORS proxy for search completions)
└── icons/              # Extension icons in 16x16, 48x48, and 128x128 sizes
```

### Storage Architecture
- **Queue-based Synchronization**: Prevents race conditions during simultaneous read/write operations with an asynchronous `StorageQueue`.
- **Hybrid Storage Strategy**:
  - `chrome.storage.local`: Lightweight settings, tasks, and layout coordinates.
  - `IndexedDB (FlashDashDB)`: Large media blobs and high-resolution vision board assets for reliable offline performance without storage limits.

---

## 🛡️ Privacy First

Flash Dash is built with a local-only privacy philosophy:
- **No Analytics or Trackers**: No third-party analytics, user tracking, or fingerprinting.
- **Local Persistence**: All photos, tasks, preferences, and streaks remain strictly on your local browser.
- **Minimal Permissions**: Requests only permissions essential for core utility (`storage`, `unlimitedStorage`, `bookmarks`, `search`, `topSites`).

---

## 🤝 Contributing

Contributions, feature requests, and feedback are always welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m "Add some AmazingFeature"`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 👤 Author

Crafted with care by **[Aryan](https://github.com/aryankun27-a11y)**.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
