// ==========================================
// 1. STORAGE UTILITIES (storage.js)
// ==========================================

class StorageQueue {
  constructor() {
    this.promise = Promise.resolve();
  }
  enqueue(operation) {
    this.promise = this.promise.then(() => operation()).catch(console.error);
    return this.promise;
  }
}
const storageQueue = new StorageQueue();

const chromeStore = (window.chrome && chrome.storage && chrome.storage.local) ? chrome.storage.local : null;

const store = {
  async get(key, fallback) {
    if (chromeStore) {
      return new Promise(res => {
        try {
          chromeStore.get([key], r => {
            if (chrome.runtime && chrome.runtime.lastError) {
              res(fallback);
            } else {
              res((r && r[key] !== undefined) ? r[key] : fallback);
            }
          });
        } catch (e) {
          res(fallback);
        }
      });
    }
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  },
  async set(key, value) {
    if (chromeStore) {
      return new Promise(res => {
        try {
          chromeStore.set({ [key]: value }, () => res());
        } catch (e) { res(); }
      });
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Flash Dash Storage Error: Failed to set key "${key}" in localStorage:`, e);
    }
  },
  async setMultiple(obj) {
    if (chromeStore) {
      return new Promise(res => {
        try {
          chromeStore.set(obj, () => res());
        } catch (e) { res(); }
      });
    }
    try {
      for (const [k, v] of Object.entries(obj)) {
        localStorage.setItem(k, JSON.stringify(v));
      }
    } catch (e) {
      console.error('Flash Dash Storage Error: Failed to set multiple keys in localStorage:', e);
    }
  },
  async mutate(key, fallback, mutatorFn) {
    return storageQueue.enqueue(async () => {
      const current = await this.get(key, fallback);
      const mutated = await mutatorFn(current);
      await this.set(key, mutated);
      return mutated;
    });
  }
};

const dbName = 'FlashDashDB';
const storeName = 'AssetsStore';

function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

const largeStore = {
  async get(key, fallback) {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(storeName, 'readonly');
        const storeObj = transaction.objectStore(storeName);
        const req = storeObj.get(key);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : fallback);
        req.onerror = () => resolve(fallback);
      });
    } catch (e) {
      return fallback;
    }
  },
  async set(key, value) {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const storeObj = transaction.objectStore(storeName);
        const req = storeObj.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('IndexedDB write error:', e);
    }
  },
  async delete(key) {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const storeObj = transaction.objectStore(storeName);
        const req = storeObj.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch (e) {
      console.error('IndexedDB delete error:', e);
    }
  },
  async getAllKeys() {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(storeName, 'readonly');
        const storeObj = transaction.objectStore(storeName);
        const req = storeObj.getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  }
};

function dataURLtoBlob(dataurl) {
  try {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error('Failed to convert base64 to Blob:', e);
    return null;
  }
}

window.store = store;
window.largeStore = largeStore;
window.dataURLtoBlob = dataURLtoBlob;


// ==========================================
// 2. DIALOG & MODAL MANAGER (modal.js)
// ==========================================

const ModalManager = {
  overlay: document.getElementById('customModalOverlay'),
  content: document.getElementById('customModalContent'),
  confirmBtn: document.getElementById('customModalConfirmBtn'),
  cancelBtn: document.getElementById('customModalCancelBtn'),
  currentResolve: null,

  init() {
    this.confirmBtn.addEventListener('click', () => this.handleAction(true));
    this.cancelBtn.addEventListener('click', () => this.handleAction(false));

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.handleAction(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
        this.handleAction(false);
      }
    });
  },

  handleAction(value) {
    if (this.currentResolve) {
      this.currentResolve(value);
      this.currentResolve = null;
    }
    this.close();
  },

  close() {
    this.overlay.classList.remove('active');
    setTimeout(() => {
      this.content.innerHTML = '';
      this.confirmBtn.style.display = 'inline-block';
      this.cancelBtn.style.display = 'inline-block';
      this.confirmBtn.textContent = 'Confirm';
      this.cancelBtn.textContent = 'Cancel';
    }, 250);
  },

  async confirm(message) {
    return new Promise((resolve) => {
      this.currentResolve = resolve;
      this.content.innerHTML = `
        <div class="modal-confirm-wrapper">
          <div class="modal-icon-header">
            <div class="modal-icon-badge warning">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <h3 class="modal-title">Confirm Action</h3>
          </div>
          <div class="modal-desc">${message}</div>
        </div>
      `;
      this.confirmBtn.textContent = 'Confirm';
      this.cancelBtn.textContent = 'Cancel';
      this.overlay.classList.add('active');
    });
  },

  async alert(message) {
    return new Promise((resolve) => {
      this.currentResolve = resolve;
      this.content.innerHTML = `
        <div class="modal-confirm-wrapper">
          <div class="modal-icon-header">
            <div class="modal-icon-badge info">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </div>
            <h3 class="modal-title">Notice</h3>
          </div>
          <div class="modal-desc">${message}</div>
        </div>
      `;
      this.confirmBtn.textContent = 'OK';
      this.cancelBtn.style.display = 'none';
      this.overlay.classList.add('active');
    });
  },

  async showWelcomeModal() {
    return new Promise((resolve) => {
      this.currentResolve = resolve;
      this.content.innerHTML = `
        <h2 class="modal-welcome-title">Welcome to Flash Dash</h2>
        <p class="modal-welcome-desc">A premium, distraction-free dashboard. Here are the core features:</p>
        <ul class="modal-welcome-list">
          <li class="modal-welcome-item">
            <span class="modal-welcome-icon"></span>
            <div class="modal-welcome-text">
              <strong>Focus Countdown</strong>
              <span>Double-click the background or clock to enter Focus Mode. Select duration presets (10m, 25m, 30m, 45m, 60m) with micro-tick animations.</span>
            </div>
          </li>
          <li class="modal-welcome-item">
            <span class="modal-welcome-icon"></span>
            <div class="modal-welcome-text">
              <strong>Interactive Task List</strong>
              <span>Manage your daily schedule on the right-side task card. Drag-and-drop to reorder tasks easily, and double-click to edit inline.</span>
            </div>
          </li>
          <li class="modal-welcome-item">
            <span class="modal-welcome-icon"></span>
            <div class="modal-welcome-text">
              <strong>Chrome Bookmarks Drawer</strong>
              <span>Access all Chrome bookmarks in the slide drawer, complete with real-time text search filtering.</span>
            </div>
          </li>
          <li class="modal-welcome-item">
            <span class="modal-welcome-icon"></span>
            <div class="modal-welcome-text">
              <strong>Snapping Goal Whiteboard</strong>
              <span>Drag &amp; drop images directly. Resizing and dragging snaps borders.</span>
            </div>
          </li>
        </ul>
      `;
      this.confirmBtn.textContent = "Let's Go!";
      this.cancelBtn.style.display = 'none';
      this.overlay.classList.add('active');
    });
  }
};
ModalManager.init();
window.ModalManager = ModalManager;


// ==========================================
// 3. FOCUS TIMER CONTROLS (timer.js)
// ==========================================

const clockView = document.getElementById('clockView');
const dateEl = document.getElementById('date');
const focusNotification = document.getElementById('focusNotification');
const timerView = document.getElementById('timerView');
const timerTime = document.getElementById('timerTime');
const timerInput = document.getElementById('timerInput');
const timerDoneBtn = document.getElementById('timerDoneBtn');

let focusTimeout = null;
let timerInterval = null;
let defaultDurationMin = 25;
let timerState = 'idle';
let timerEndTimestamp = 0;
let timerRemainingMs = 25 * 60 * 1000;
let timerSoundEnabled = true;

function showFocusNotification(text) {
  if (focusTimeout) clearTimeout(focusTimeout);
  focusNotification.textContent = text;
  focusNotification.classList.add('visible');
  focusTimeout = setTimeout(() => {
    focusNotification.classList.remove('visible');
  }, 2500);
}

async function toggleFocusMode(e) {
  if (e && e.type === 'dblclick') {
    if (e.target.closest('.photo') ||
      e.target.closest('.right-panel') ||
      e.target.closest('.vertical-toolbar') ||
      e.target.closest('.slide-drawer') ||
      e.target.closest('#bgSettingsDrawer') ||
      e.target.closest('.top-right-dock') ||
      e.target.closest('#clockTodoWidget') ||
      e.target.closest('.search-wrapper') ||
      e.target.closest('#timerTime')) return;
  }

  document.body.classList.toggle('focus-mode');
  const isFocus = document.body.classList.contains('focus-mode');
  await store.set('focusMode', isFocus);
  showFocusNotification(isFocus ? "Focus Mode Active" : "All Widgets Visible");

  if (!isFocus) {
    document.body.classList.remove('timer-flash-active');
    if (timerState === 'finished') {
      await resetTimer();
    }
  }
}

async function applyDimnessState() {
  const baseDim = parseInt(await store.get('bgDim', 0));
  const extraDim = (timerState === 'running') ? 15 : 0;
  const finalDim = Math.min(100, baseDim + extraDim);
  const screenBgOverlay = document.getElementById('screenBgOverlay');
  if (screenBgOverlay) {
    screenBgOverlay.style.opacity = finalDim / 100;
  }
}

function playPremiumChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now);
    gain2.gain.setValueAtTime(0.15, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1046.50, now);
    gain3.gain.setValueAtTime(0.1, now);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 2.5);
    osc2.start(now);
    osc2.stop(now + 1.8);
    osc3.start(now);
    osc3.stop(now + 1.2);
  } catch (e) {
    console.error("Audio Context chime failed:", e);
  }
}

function requestNotificationPermission() {
  if (window.Notification && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showDesktopNotification() {
  if (window.Notification && Notification.permission === 'granted') {
    try {
      new Notification("Flash Dash", {
        body: "Time is up! Great focus session.",
        icon: "icons/icon128.png"
      });
    } catch (e) {
      console.error("Desktop notification failed to show:", e);
    }
  }
}

function updateShortcutsGuideUI() {
  const guide = document.getElementById('timerShortcutsHelp');
  if (!guide) return;
  if (timerSoundEnabled) {
    guide.textContent = "[Space] Play/Pause  •  [R] Reset  •  [M] Mute";
  } else {
    guide.textContent = "[Space] Play/Pause  •  [R] Reset  •  [M] Unmute";
  }
}

function updateTimerDisplay(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;

  const minutesEl = document.getElementById('timerMinutes');
  const secondsEl = document.getElementById('timerSeconds');
  if (minutesEl && secondsEl) {
    minutesEl.textContent = min.toString().padStart(2, '0');
    secondsEl.textContent = sec.toString().padStart(2, '0');
  } else {
    timerTime.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }
}

async function startTimer(durationMs) {
  requestNotificationPermission();
  timerState = 'running';
  timerEndTimestamp = Date.now() + durationMs;
  await store.setMultiple({
    focusTimerState: 'running',
    focusTimerEndTimestamp: timerEndTimestamp
  });

  document.body.classList.add('timer-running');
  if (timerView) timerView.className = 'timer-view running';

  await applyDimnessState();
  runTimerLoop();
}

function runTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  updateTimerLoop();
  timerInterval = setInterval(updateTimerLoop, 200);
}

function updateStreakUI(count) {
  const streakCountSpan = document.getElementById('timerStreakCount');
  if (streakCountSpan) {
    streakCountSpan.textContent = count;
  }
}

async function updateTimerLoop() {
  if (timerState !== 'running') {
    if (timerInterval) clearInterval(timerInterval);
    return;
  }

  const remaining = timerEndTimestamp - Date.now();
  if (remaining <= 0) {
    if (timerInterval) clearInterval(timerInterval);
    timerState = 'finished';
    timerRemainingMs = 0;
    updateTimerDisplay(0);

    const updatedStreak = await store.mutate('focusStreakCount', 0, (count) => count + 1);
    updateStreakUI(updatedStreak);

    await store.set('focusTimerState', 'finished');

    document.body.classList.remove('timer-running');
    if (timerView) timerView.className = 'timer-view finished';
    document.body.classList.add('timer-flash-active');

    await applyDimnessState();

    if (timerSoundEnabled) {
      playPremiumChime();
    }
    showDesktopNotification();
  } else {
    timerRemainingMs = remaining;
    updateTimerDisplay(remaining);
  }
}

async function pauseTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerState = 'paused';
  await store.setMultiple({
    focusTimerState: 'paused',
    focusTimerRemaining: timerRemainingMs
  });

  document.body.classList.remove('timer-running');
  if (timerView) timerView.className = 'timer-view paused';

  await applyDimnessState();
}

async function resetTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerState = 'idle';
  document.body.classList.remove('timer-flash-active');
  document.body.classList.remove('timer-running');

  const durationMin = await store.get('focusTimerDuration', defaultDurationMin);
  timerRemainingMs = durationMin * 60 * 1000;
  updateTimerDisplay(timerRemainingMs);

  await store.setMultiple({
    focusTimerState: 'idle',
    focusTimerRemaining: timerRemainingMs
  });

  if (timerView) timerView.className = 'timer-view paused';

  await applyDimnessState();
}

async function initFocusMode() {
  const active = await store.get('focusMode', false);
  if (active) {
    document.body.classList.add('focus-mode');
  }
  await initTimer();
}

async function initTimer() {
  if (!timerView) return;
  timerSoundEnabled = await store.get('focusTimerSoundEnabled', true);
  updateShortcutsGuideUI();

  const streakCount = await store.get('focusStreakCount', 0);
  updateStreakUI(streakCount);

  const durationMin = await store.get('focusTimerDuration', defaultDurationMin);
  timerState = await store.get('focusTimerState', 'idle');
  timerRemainingMs = durationMin * 60 * 1000;

  document.body.classList.remove('timer-flash-active');
  document.body.classList.remove('timer-running');

  if (timerState === 'running') {
    timerEndTimestamp = await store.get('focusTimerEndTimestamp', 0);
    const remaining = timerEndTimestamp - Date.now();
    if (remaining <= 0) {
      timerState = 'finished';
      timerRemainingMs = 0;
      updateTimerDisplay(0);
      timerView.className = 'timer-view finished';
      document.body.classList.add('timer-flash-active');
    } else {
      timerRemainingMs = remaining;
      updateTimerDisplay(remaining);
      timerView.className = 'timer-view running';
      document.body.classList.add('timer-running');
      runTimerLoop();
    }
  } else if (timerState === 'paused') {
    timerRemainingMs = await store.get('focusTimerRemaining', durationMin * 60 * 1000);
    updateTimerDisplay(timerRemainingMs);
    timerView.className = 'timer-view paused';
  } else if (timerState === 'finished') {
    updateTimerDisplay(0);
    timerView.className = 'timer-view finished';
    document.body.classList.add('timer-flash-active');
  } else {
    updateTimerDisplay(timerRemainingMs);
    timerView.className = 'timer-view paused';
  }

  await applyDimnessState();

  updateActivePreset(durationMin);
}

function updateActivePreset(mins) {
  const presetContainer = document.getElementById('timerPresets');
  if (!presetContainer) return;
  presetContainer.querySelectorAll('.preset-btn').forEach(btn => {
    if (parseInt(btn.dataset.min) === mins) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

if (timerTime) {
  timerTime.addEventListener('click', () => {
    if (timerState === 'finished') return;
    if (timerView.classList.contains('editing')) return;

    if (timerState === 'running') {
      pauseTimer();
    } else {
      enterTimerEditMode();
    }
  });
}

function enterTimerEditMode() {
  if (!timerView || !timerInput) return;
  timerView.classList.add('editing');

  const currentDurationMin = Math.round(timerRemainingMs / (60 * 1000));
  timerInput.value = currentDurationMin;
  timerInput.focus();
  timerInput.select();
}

async function saveTimerEditMode() {
  if (!timerView || !timerInput) return;
  timerView.classList.remove('editing');

  let val = parseInt(timerInput.value.trim());
  if (isNaN(val) || val <= 0) {
    val = defaultDurationMin;
  }
  val = Math.min(999, val);

  timerRemainingMs = val * 60 * 1000;
  updateTimerDisplay(timerRemainingMs);

  await store.setMultiple({
    focusTimerDuration: val,
    focusTimerState: 'idle',
    focusTimerRemaining: timerRemainingMs
  });

  timerState = 'idle';
  timerView.className = 'timer-view paused';
}

if (timerInput) {
  timerInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await saveTimerEditMode();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      timerInput.value = Math.round(timerRemainingMs / (60 * 1000));
      timerView.classList.remove('editing');
      timerInput.blur();
    }
  });

  timerInput.addEventListener('blur', async () => {
    await saveTimerEditMode();
  });

  timerInput.addEventListener('input', () => {
    timerInput.value = timerInput.value.replace(/[^0-9]/g, '');
  });
}

if (timerDoneBtn) {
  timerDoneBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    document.body.classList.remove('timer-flash-active');
    await resetTimer();
    toggleFocusMode();
  });
}

document.addEventListener('dblclick', toggleFocusMode);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modalOverlay = document.getElementById('customModalOverlay');
    if (modalOverlay && modalOverlay.classList.contains('active')) {
      return;
    }
    const tutorialOverlay = document.getElementById('tutorialOverlay');
    if (tutorialOverlay && tutorialOverlay.classList.contains('visible')) {
      return;
    }

    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }

    let drawerClosed = false;
    const bookmarksDrawer = document.getElementById('bookmarksDrawer');
    const bgSettingsDrawer = document.getElementById('bgSettingsDrawer');
    const todoDrawer = document.getElementById('todoDrawer');

    [bookmarksDrawer, bgSettingsDrawer, todoDrawer].forEach(drawer => {
      if (drawer && drawer.classList.contains('open')) {
        drawer.classList.remove('open');
        drawerClosed = true;
      }
    });

    if (drawerClosed) return;

    toggleFocusMode();
  }
});

document.addEventListener('keydown', async (e) => {
  const modalOverlay = document.getElementById('customModalOverlay');
  if (modalOverlay && modalOverlay.classList.contains('active')) return;

  if (!document.body.classList.contains('focus-mode')) return;

  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
    return;
  }

  if (e.key === ' ') {
    e.preventDefault();
    if (timerState === 'finished') return;

    if (timerState === 'running') {
      pauseTimer();
    } else {
      startTimer(timerRemainingMs);
    }
  } else if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    resetTimer();
  } else if (e.key === 'm' || e.key === 'M') {
    e.preventDefault();
    timerSoundEnabled = !timerSoundEnabled;
    await store.set('focusTimerSoundEnabled', timerSoundEnabled);
    updateShortcutsGuideUI();
  }
});

if (window.chrome && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' || namespace === 'sync') {
      if (changes.focusTimerState || changes.focusTimerDuration || changes.focusTimerEndTimestamp || changes.focusTimerRemaining) {
        await initTimer();
      }
      if (changes.focusTimerSoundEnabled) {
        timerSoundEnabled = changes.focusTimerSoundEnabled.newValue;
        updateShortcutsGuideUI();
      }
      if (changes.focusStreakCount) {
        updateStreakUI(changes.focusStreakCount.newValue || 0);
      }
      if (changes.focusMode) {
        const active = changes.focusMode.newValue;
        if (active) {
          document.body.classList.add('focus-mode');
        } else {
          document.body.classList.remove('focus-mode');
          document.body.classList.remove('timer-flash-active');
        }
      }
    }
  });
}

const presetContainer = document.getElementById('timerPresets');
if (presetContainer) {
  presetContainer.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const mins = parseInt(btn.dataset.min);
      if (isNaN(mins)) return;

      timerRemainingMs = mins * 60 * 1000;
      updateTimerDisplay(timerRemainingMs);

      await store.setMultiple({
        focusTimerDuration: mins,
        focusTimerState: 'idle',
        focusTimerRemaining: timerRemainingMs
      });

      timerState = 'idle';
      timerView.className = 'timer-view paused';
      document.body.classList.remove('timer-flash-active');
      document.body.classList.remove('timer-running');
      if (timerInterval) clearInterval(timerInterval);
      await applyDimnessState();
      updateActivePreset(mins);
    });
  });
}

window.initTimer = initTimer;
window.initFocusMode = initFocusMode;
Object.defineProperty(window, 'timerState', {
  get: () => timerState,
  configurable: true
});
Object.defineProperty(window, 'timerRemainingMs', {
  get: () => timerRemainingMs,
  configurable: true
});
window.resetTimer = resetTimer;
window.timerTime = timerTime;
window.timerView = timerView;
window.timerInput = timerInput;
window.timerDoneBtn = timerDoneBtn;


// ==========================================
// 4. WHITEBOARD WIDGET (whiteboard.js)
// ==========================================

const board = document.getElementById('board');
const photoInput = document.getElementById('photoInput');
const addPhotoBtn = document.getElementById('addPhotoBtn');
const clearPhotosBtn = document.getElementById('clearPhotosBtn');

let _photoZCounter = 100;
let loadedPhotos = [];
const photoObjectUrls = new Map();
let _focusedPhotoEl = null; // Tracks the last clicked photo for keyboard delete

// Infinite Canvas Transform State
let canvasPanX = 0;
let canvasPanY = 0;
let canvasScale = 1.0;
let isSpacePressed = false;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let saveCanvasTimeout = null;

// Smooth RAF State
let rafId = null;

function applyCanvasTransform(animate = false) {
  const target = document.getElementById('boardCanvas') || board;
  if (!target) return;

  canvasScale = 1.0;

  if (animate) {
    target.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => {
      target.style.transition = '';
    }, 300);
  } else {
    target.style.transition = '';
  }

  // Force GPU hardware-accelerated 3D transform for 60fps/120fps smooth panning
  const transformStr = `translate3d(${canvasPanX}px, ${canvasPanY}px, 0px)`;
  target.style.transform = transformStr;
}

function requestSmoothTransform() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    applyCanvasTransform(false);
  });
}

function debouncedSaveCanvasTransform() {
  if (saveCanvasTimeout) clearTimeout(saveCanvasTimeout);
  saveCanvasTimeout = setTimeout(saveCanvasTransform, 300);
}

async function saveCanvasTransform() {
  await store.setMultiple({
    boardPanX: canvasPanX,
    boardPanY: canvasPanY,
    boardZoomScale: 1.0
  });
}

async function initCanvasTransform() {
  canvasPanX = await store.get('boardPanX', 0);
  canvasPanY = await store.get('boardPanY', 0);
  canvasScale = 1.0;
  applyCanvasTransform(false);
}

function recenterCanvas() {
  canvasPanX = 0;
  canvasPanY = 0;
  canvasScale = 1.0;
  applyCanvasTransform(true);
  saveCanvasTransform();
  if (typeof showFocusNotification === 'function') {
    showFocusNotification("Canvas Reset to Center");
  }
}

const recenterBoardBtn = document.getElementById('recenterBoardBtn');
if (recenterBoardBtn) {
  recenterBoardBtn.addEventListener('click', recenterCanvas);
}

// Track spacebar for canvas panning
window.addEventListener('keydown', (e) => {
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) return;

  if (e.code === 'Space' && !e.repeat) {
    const modalOverlay = document.getElementById('customModalOverlay');
    if (modalOverlay && modalOverlay.classList.contains('active')) return;
    const tutorialOverlay = document.getElementById('tutorialOverlay');
    if (tutorialOverlay && tutorialOverlay.classList.contains('visible')) return;

    isSpacePressed = true;
    document.body.classList.add('space-panning');
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    isSpacePressed = false;
    document.body.classList.remove('space-panning');
    document.body.classList.remove('space-panning-active');
  }
});

// Canvas Panning Pointer Handlers (Direct 1:1 360° Freeform Panning)
window.addEventListener('pointerdown', (e) => {
  const isMiddleClick = e.button === 1;
  const isLeftClick = e.button === 0;
  const isBackgroundClick = isLeftClick &&
    !e.target.closest('.photo') &&
    !e.target.closest('.vertical-toolbar') &&
    !e.target.closest('.slide-drawer') &&
    !e.target.closest('.custom-modal-card') &&
    !e.target.closest('.creator-note-overlay') &&
    !e.target.closest('.tutorial-tour-container');

  if (isBackgroundClick) {
    clearPhotoSelection();
  }

  if (isMiddleClick || isSpacePressed || isBackgroundClick) {
    if (e.target.closest('.del')) return;
    isPanning = true;
    panStartX = e.clientX - canvasPanX;
    panStartY = e.clientY - canvasPanY;

    document.body.classList.add('space-panning');
    document.body.classList.add('space-panning-active');

    try {
      if (e.target && e.target.setPointerCapture) {
        e.target.setPointerCapture(e.pointerId);
      }
    } catch (err) { }
  }
});

window.addEventListener('pointermove', (e) => {
  if (!isPanning) return;
  canvasPanX = e.clientX - panStartX;
  canvasPanY = e.clientY - panStartY;
  requestSmoothTransform();
});

function stopCanvasPanning(e) {
  if (isPanning) {
    isPanning = false;
    document.body.classList.remove('space-panning');
    document.body.classList.remove('space-panning-active');
    try {
      if (e && e.target && e.target.releasePointerCapture) {
        e.target.releasePointerCapture(e.pointerId);
      }
    } catch (err) { }
    saveCanvasTransform();
  }
}

window.addEventListener('pointerup', stopCanvasPanning);
window.addEventListener('pointercancel', stopCanvasPanning);

// Prevent browser gesture zoom (Safari / Chrome trackpad gestures)
window.addEventListener('gesturestart', (e) => e.preventDefault());
window.addEventListener('gesturechange', (e) => e.preventDefault());
window.addEventListener('gestureend', (e) => e.preventDefault());

// Smooth 2D Canvas Panning on Mouse Wheel & Trackpad (360° Freeform Panning)
window.addEventListener('wheel', (e) => {
  if (e.target.closest('.slide-drawer') ||
    e.target.closest('.todo-list') ||
    e.target.closest('.bookmarks-list') ||
    e.target.closest('.creator-note-card') ||
    e.target.closest('.custom-modal-card')) {
    return;
  }

  const modalOverlay = document.getElementById('customModalOverlay');
  if (modalOverlay && modalOverlay.classList.contains('active')) return;
  const tutorialOverlay = document.getElementById('tutorialOverlay');
  if (tutorialOverlay && tutorialOverlay.classList.contains('visible')) return;

  e.preventDefault();

  // Pan canvas 360°
  canvasPanX -= e.deltaX;
  canvasPanY -= e.deltaY;
  requestSmoothTransform();
  debouncedSaveCanvasTransform();
}, { passive: false });

function clearPhotoSelection() {
  const canvasTarget = document.getElementById('boardCanvas') || board;
  if (canvasTarget) {
    canvasTarget.querySelectorAll('.photo.selected').forEach(p => p.classList.remove('selected'));
  }
  _focusedPhotoEl = null;
}

function bringPhotoToFront(wrap, photo, persist) {
  if (board.classList.contains('board-locked')) return;
  clearPhotoSelection();
  _photoZCounter += 1;
  photo.z = _photoZCounter;
  wrap.style.zIndex = _photoZCounter;
  wrap.classList.add('selected');
  _focusedPhotoEl = wrap;
  if (typeof persist === 'function') {
    persist();
  }
}

async function updateClearPhotosBtnState() {
  if (!clearPhotosBtn) return;
  const photos = await store.get('photos', []);
  if (photos.length === 0) {
    clearPhotosBtn.setAttribute('disabled', 'true');
  } else {
    clearPhotosBtn.removeAttribute('disabled');
  }
}

function getPhotoWorldCoords(photo) {
  if (photo.x !== undefined && photo.y !== undefined) {
    return { x: photo.x, y: photo.y };
  }
  const x = Math.round((photo.xPercent || 0.2) * window.innerWidth);
  const y = Math.round((photo.yPercent || 0.2) * window.innerHeight);
  photo.x = x;
  photo.y = y;
  return { x, y };
}

function updatePhotoPositionStyle(el, photo) {
  const { x, y } = getPhotoWorldCoords(photo);
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.width = (photo.w || 150) + 'px';
  el.style.height = (photo.h || 150) + 'px';
}

function updateAllPhotoStyles() {
  const canvasTarget = document.getElementById('boardCanvas') || board;
  const photoEls = canvasTarget.querySelectorAll('.photo');
  photoEls.forEach(el => {
    const id = el.dataset.id;
    const photo = loadedPhotos.find(p => p.id === id);
    if (photo) {
      updatePhotoPositionStyle(el, photo);
    }
  });
}
window.addEventListener('resize', updateAllPhotoStyles);

const RESIZE_BORDER = 8;
function getResizeDirection(el, clientX, clientY) {
  const rect = el.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  let dir = "";
  if (y < RESIZE_BORDER) dir += "n";
  else if (y > rect.height - RESIZE_BORDER) dir += "s";

  if (x < RESIZE_BORDER) dir += "w";
  else if (x > rect.width - RESIZE_BORDER) dir += "e";

  return dir;
}

const SNAP_THRESHOLD = 12;
const SNAP_GAP = 0;

function getOtherPhotoRects(excludeId) {
  const rects = [];
  const canvasTarget = document.getElementById('boardCanvas') || board;
  canvasTarget.querySelectorAll('.photo').forEach(el => {
    if (el.dataset.id === excludeId) return;
    const left = parseFloat(el.style.left) || el.offsetLeft;
    const top = parseFloat(el.style.top) || el.offsetTop;
    const width = parseFloat(el.style.width) || el.offsetWidth;
    const height = parseFloat(el.style.height) || el.offsetHeight;
    rects.push({ left, top, right: left + width, bottom: top + height, width, height });
  });
  return rects;
}

let _snapGuideEls = [];
function showSnapGuides(xLines, yLines) {
  clearSnapGuides();
  xLines.forEach(x => {
    const g = document.createElement('div');
    g.className = 'snap-guide snap-guide-x';
    const screenX = x + canvasPanX;
    g.style.left = screenX + 'px';
    document.body.appendChild(g);
    _snapGuideEls.push(g);
  });
  yLines.forEach(y => {
    const g = document.createElement('div');
    g.className = 'snap-guide snap-guide-y';
    const screenY = y + canvasPanY;
    g.style.top = screenY + 'px';
    document.body.appendChild(g);
    _snapGuideEls.push(g);
  });
}

function clearSnapGuides() {
  _snapGuideEls.forEach(g => g.remove());
  _snapGuideEls = [];
}

function computeSnap(dragRect, excludeId) {
  const others = getOtherPhotoRects(excludeId);
  let snapX = null, snapY = null;
  const guideXSet = new Set(), guideYSet = new Set();

  const dLeft = dragRect.left, dRight = dragRect.right, dTop = dragRect.top, dBottom = dragRect.bottom;
  const dCenterX = (dLeft + dRight) / 2, dCenterY = (dTop + dBottom) / 2;

  for (const o of others) {
    const oCenterX = (o.left + o.right) / 2, oCenterY = (o.top + o.bottom) / 2;

    if (Math.abs(dLeft - o.left) < SNAP_THRESHOLD && snapX === null) { snapX = o.left - dLeft; guideXSet.add(o.left); }
    if (Math.abs(dRight - o.right) < SNAP_THRESHOLD && snapX === null) { snapX = o.right - dRight; guideXSet.add(o.right); }
    if (Math.abs(dLeft - (o.right + SNAP_GAP)) < SNAP_THRESHOLD && snapX === null) { snapX = (o.right + SNAP_GAP) - dLeft; guideXSet.add(o.right + SNAP_GAP); }
    if (Math.abs(dRight - (o.left - SNAP_GAP)) < SNAP_THRESHOLD && snapX === null) { snapX = (o.left - SNAP_GAP) - dRight; guideXSet.add(o.left - SNAP_GAP); }
    if (Math.abs(dLeft - o.right) < SNAP_THRESHOLD && snapX === null) { snapX = o.right - dLeft; guideXSet.add(o.right); }
    if (Math.abs(dRight - o.left) < SNAP_THRESHOLD && snapX === null) { snapX = o.left - dRight; guideXSet.add(o.left); }
    if (Math.abs(dCenterX - oCenterX) < SNAP_THRESHOLD && snapX === null) { snapX = oCenterX - dCenterX; guideXSet.add(oCenterX); }

    if (Math.abs(dTop - o.top) < SNAP_THRESHOLD && snapY === null) { snapY = o.top - dTop; guideYSet.add(o.top); }
    if (Math.abs(dBottom - o.bottom) < SNAP_THRESHOLD && snapY === null) { snapY = o.bottom - dBottom; guideYSet.add(o.bottom); }
    if (Math.abs(dTop - (o.bottom + SNAP_GAP)) < SNAP_THRESHOLD && snapY === null) { snapY = (o.bottom + SNAP_GAP) - dTop; guideYSet.add(o.bottom + SNAP_GAP); }
    if (Math.abs(dBottom - (o.top - SNAP_GAP)) < SNAP_THRESHOLD && snapY === null) { snapY = (o.top - SNAP_GAP) - dBottom; guideYSet.add(o.top - SNAP_GAP); }
    if (Math.abs(dTop - o.bottom) < SNAP_THRESHOLD && snapY === null) { snapY = o.bottom - dTop; guideYSet.add(o.bottom); }
    if (Math.abs(dBottom - o.top) < SNAP_THRESHOLD && snapY === null) { snapY = o.top - dBottom; guideYSet.add(o.top); }
    if (Math.abs(dCenterY - oCenterY) < SNAP_THRESHOLD && snapY === null) { snapY = oCenterY - dCenterY; guideYSet.add(oCenterY); }
  }

  return { snapX: snapX || 0, snapY: snapY || 0, guideX: [...guideXSet], guideY: [...guideYSet] };
}

function makeResizableAndDraggable(el, photo, onChange) {
  el.addEventListener('pointermove', (e) => {
    if (board.classList.contains('board-locked')) return;
    if (e.target.closest('.del')) {
      el.style.cursor = 'pointer';
      return;
    }
    const dir = getResizeDirection(el, e.clientX, e.clientY);
    if (dir) {
      el.style.cursor = dir + '-resize';
    } else {
      el.style.cursor = 'grab';
    }
  });

  el.addEventListener('pointerdown', (e) => {
    if (board.classList.contains('board-locked')) return;
    if (e.target.closest('.del')) return;
    bringPhotoToFront(el, photo, onChange);
    e.preventDefault();

    const dir = getResizeDirection(el, e.clientX, e.clientY);
    const startX = e.clientX, startY = e.clientY;
    const origW = photo.w || 150;
    const origH = photo.h || 150;
    const { x: origX, y: origY } = getPhotoWorldCoords(photo);

    el.setPointerCapture(e.pointerId);

    if (dir) {
      function moveResize(ev) {
        const dx = (ev.clientX - startX) / canvasScale;
        const dy = (ev.clientY - startY) / canvasScale;

        let newW = origW, newH = origH, newX = origX, newY = origY;

        if (dir.includes("e")) { newW = Math.max(50, origW + dx); }
        else if (dir.includes("w")) {
          const pw = origW - dx;
          if (pw >= 50) { newW = pw; newX = origX + dx; }
        }
        if (dir.includes("s")) { newH = Math.max(50, origH + dy); }
        else if (dir.includes("n")) {
          const ph = origH - dy;
          if (ph >= 50) { newH = ph; newY = origY + dy; }
        }

        const tempRect = { left: newX, top: newY, right: newX + newW, bottom: newY + newH };
        const snap = computeSnap(tempRect, photo.id);

        if (dir.includes("e") && snap.snapX) { newW += snap.snapX; }
        if (dir.includes("s") && snap.snapY) { newH += snap.snapY; }
        if (dir.includes("w") && snap.snapX) { newX += snap.snapX; newW -= snap.snapX; }
        if (dir.includes("n") && snap.snapY) { newY += snap.snapY; newH -= snap.snapY; }

        newW = Math.max(50, newW);
        newH = Math.max(50, newH);

        photo.w = newW; photo.h = newH;
        photo.x = newX; photo.y = newY;
        photo.xPercent = newX / window.innerWidth;
        photo.yPercent = newY / window.innerHeight;

        el.style.width = newW + 'px';
        el.style.height = newH + 'px';
        el.style.left = newX + 'px';
        el.style.top = newY + 'px';

        showSnapGuides(snap.guideX, snap.guideY);
      }

      function upResize() {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch (err) { }
        el.removeEventListener('pointermove', moveResize);
        el.removeEventListener('pointerup', upResize);
        clearSnapGuides();
        onChange();
      }

      el.addEventListener('pointermove', moveResize);
      el.addEventListener('pointerup', upResize);

    } else {
      el.style.cursor = 'grabbing';
      el.classList.add('dragging');

      function moveDrag(ev) {
        const dx = (ev.clientX - startX) / canvasScale;
        const dy = (ev.clientY - startY) / canvasScale;

        let x = origX + dx;
        let y = origY + dy;

        const w = photo.w || 150, h = photo.h || 150;
        const tempRect = { left: x, top: y, right: x + w, bottom: y + h };
        const snap = computeSnap(tempRect, photo.id);
        x += snap.snapX;
        y += snap.snapY;

        photo.x = x;
        photo.y = y;
        photo.xPercent = x / window.innerWidth;
        photo.yPercent = y / window.innerHeight;

        el.style.left = x + 'px';
        el.style.top = y + 'px';

        showSnapGuides(snap.guideX, snap.guideY);
      }

      function upDrag() {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch (err) { }
        el.removeEventListener('pointermove', moveDrag);
        el.removeEventListener('pointerup', upDrag);
        el.style.cursor = 'grab';
        el.classList.remove('dragging');
        clearSnapGuides();
        onChange();
      }

      el.addEventListener('pointermove', moveDrag);
      el.addEventListener('pointerup', upDrag);
    }
  });
}

async function renderPhotoEl(photo) {
  const wrap = document.createElement('div');
  wrap.className = 'photo';
  wrap.dataset.id = photo.id;

  updatePhotoPositionStyle(wrap, photo);

  const savedZ = photo.z || 100;
  wrap.style.zIndex = savedZ;
  if (savedZ > _photoZCounter) _photoZCounter = savedZ;

  const img = document.createElement('img');

  let srcUrl = '';
  if (photo.src && photo.src.startsWith('data:')) {
    srcUrl = photo.src;
  } else {
    try {
      const blob = await largeStore.get('photo_img_' + photo.id);
      if (blob) {
        if (photoObjectUrls.has(photo.id)) {
          URL.revokeObjectURL(photoObjectUrls.get(photo.id));
        }
        srcUrl = URL.createObjectURL(blob);
        photoObjectUrls.set(photo.id, srcUrl);
      } else if (photo.src) {
        srcUrl = photo.src;
      }
    } catch (err) {
      if (photo.src) srcUrl = photo.src;
    }
  }
  img.src = srcUrl;
  img.setAttribute('draggable', 'false');
  wrap.appendChild(img);

  const del = document.createElement('div');
  del.className = 'del';
  del.textContent = '×';
  del.addEventListener('click', async (e) => {
    e.stopPropagation();

    await store.mutate('photos', [], (photos) => {
      return photos.filter(p => p.id !== photo.id);
    });

    await largeStore.delete('photo_img_' + photo.id);
    if (photoObjectUrls.has(photo.id)) {
      URL.revokeObjectURL(photoObjectUrls.get(photo.id));
      photoObjectUrls.delete(photo.id);
    }
    wrap.remove();
    updateClearPhotosBtnState();
  });
  wrap.appendChild(del);

  async function persist() {
    await store.mutate('photos', [], (photos) => {
      const idx = photos.findIndex(p => p.id === photo.id);
      if (idx > -1) {
        photos[idx] = {
          ...photos[idx],
          id: photo.id,
          x: photo.x,
          y: photo.y,
          xPercent: photo.x / window.innerWidth,
          yPercent: photo.y / window.innerHeight,
          w: photo.w || 150,
          h: photo.h || 150,
          z: photo.z,
          caption: photo.caption || "",
          src: photos[idx].src || photo.src || ""
        };
      }
      return photos;
    });
  }

  const canvasTarget = document.getElementById('boardCanvas') || board;
  canvasTarget.appendChild(wrap);

  wrap.addEventListener('pointerdown', () => {
    bringPhotoToFront(wrap, photo, persist);
  });

  // Also set focused on mouseenter so hovering and pressing Delete works
  wrap.addEventListener('mouseenter', () => {
    _focusedPhotoEl = wrap;
  });

  makeResizableAndDraggable(wrap, photo, persist);
}

async function renderBoard() {
  loadedPhotos = await store.get('photos', []);
  updateClearPhotosBtnState();

  const canvasTarget = document.getElementById('boardCanvas') || board;
  const existingEls = new Map();
  canvasTarget.querySelectorAll('.photo').forEach(el => {
    existingEls.set(el.dataset.id, el);
  });

  const activeIds = new Set();
  for (const photo of loadedPhotos) {
    activeIds.add(photo.id);
    const el = existingEls.get(photo.id);
    if (!el) {
      await renderPhotoEl(photo);
    } else {
      updatePhotoPositionStyle(el, photo);
      el.style.zIndex = photo.z || 2;
    }
  }

  existingEls.forEach((el, id) => {
    if (!activeIds.has(id)) {
      el.remove();
      if (photoObjectUrls.has(id)) {
        URL.revokeObjectURL(photoObjectUrls.get(id));
        photoObjectUrls.delete(id);
      }
    }
  });
}

if (addPhotoBtn && photoInput) {
  addPhotoBtn.addEventListener('click', () => {
    const bookmarksDrawer = document.getElementById('bookmarksDrawer');
    const todoDrawer = document.getElementById('todoDrawer');
    if (bookmarksDrawer) bookmarksDrawer.classList.remove('open');
    if (todoDrawer) todoDrawer.classList.remove('open');
    photoInput.click();
  });
}

if (clearPhotosBtn) {
  clearPhotosBtn.addEventListener('click', async () => {
    const photos = await store.get('photos', []);
    if (photos.length === 0) return;

    const confirmed = await ModalManager.confirm(`Remove all ${photos.length} photo${photos.length === 1 ? '' : 's'} from the board?`);
    if (!confirmed) return;

    photoObjectUrls.forEach(url => URL.revokeObjectURL(url));
    photoObjectUrls.clear();

    for (const photo of photos) {
      await largeStore.delete('photo_img_' + photo.id);
    }

    await store.set('photos', []);
    renderBoard();
  });
}

function downscaleAndGetSize(file, maxSide = 1200) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ blob: file, w: 150, h: 150 });
      return;
    }

    const img = new Image();
    const tempUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(tempUrl);
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      if (w <= maxSide && h <= maxSide) {
        resolve({ blob: file, w, h });
        return;
      }

      let newW, newH;
      if (w >= h) {
        newW = maxSide;
        newH = Math.round(maxSide * (h / w));
      } else {
        newH = maxSide;
        newW = Math.round(maxSide * (w / h));
      }

      const canvas = document.createElement('canvas');
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, newW, newH);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve({ blob, w: newW, h: newH });
        } else {
          resolve({ blob: file, w, h });
        }
      }, file.type || 'image/jpeg', 0.88);
    };
    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      resolve({ blob: file, w: 150, h: 150 });
    };
    img.src = tempUrl;
  });
}

function computeAutoGridPosition(existingPhotos, w, h, dropCoords) {
  if (dropCoords) {
    return { x: dropCoords.x, y: dropCoords.y };
  }

  const GRID_GAP = 16;
  const START_X = 100;
  const START_Y = 30;
  const MAX_X = window.innerWidth - 280;

  if (existingPhotos.length === 0) {
    return { x: START_X, y: START_Y };
  }

  const last = existingPhotos[existingPhotos.length - 1];
  const { x: lastX, y: lastY } = getPhotoWorldCoords(last);
  const lastW = last.w || 150;
  const lastH = last.h || 150;

  let nextX = lastX + lastW + GRID_GAP;
  let nextY = lastY;

  if (nextX + w > lastX + 600) {
    nextX = START_X;
    let rowMaxBottom = lastY + lastH;
    for (const p of existingPhotos) {
      const { x: pX, y: pY } = getPhotoWorldCoords(p);
      const pH = p.h || 150;
      if (Math.abs(pY - lastY) < 10) {
        rowMaxBottom = Math.max(rowMaxBottom, pY + pH);
      }
    }
    nextY = rowMaxBottom + GRID_GAP;
  }

  return { x: nextX, y: nextY };
}

async function addPhotos(files, dropCoords = null) {
  const photos = await store.get('photos', []);
  const existingSnapshot = [...photos];

  for (let i = 0; i < files.length; i++) {
    const rawFile = files[i];
    if (!rawFile.type.startsWith('image/')) continue;

    const { blob, w: natW, h: natH } = await downscaleAndGetSize(rawFile);

    const MAX_SIDE = 150;
    let w, h;
    if (natW >= natH) {
      w = MAX_SIDE;
      h = Math.round(MAX_SIDE * (natH / natW));
    } else {
      h = MAX_SIDE;
      w = Math.round(MAX_SIDE * (natW / natH));
    }

    let worldX = 0, worldY = 0;

    if (dropCoords && dropCoords.isWorld) {
      worldX = dropCoords.x + (i * 15);
      worldY = dropCoords.y + (i * 15);
    } else if (dropCoords) {
      worldX = (dropCoords.x - canvasPanX) / canvasScale - w / 2 + (i * 15);
      worldY = (dropCoords.y - canvasPanY) / canvasScale - h / 2 + (i * 15);
    } else {
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;
      const fallbackX = (screenCenterX - canvasPanX) / canvasScale - w / 2 + (i * 15);
      const fallbackY = (screenCenterY - canvasPanY) / canvasScale - h / 2 + (i * 15);
      const gridPos = computeAutoGridPosition(existingSnapshot, w, h, null);
      worldX = gridPos.x + (i * 15);
      worldY = gridPos.y + (i * 15);
    }

    _photoZCounter += 1;
    const photoId = Date.now() + Math.random().toString(36).slice(2);

    await largeStore.set('photo_img_' + photoId, blob);

    const dataUrl = await new Promise(res => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.onerror = () => res('');
      reader.readAsDataURL(blob);
    });

    const photo = {
      id: photoId,
      x: worldX,
      y: worldY,
      xPercent: worldX / window.innerWidth,
      yPercent: worldY / window.innerHeight,
      w: w,
      h: h,
      z: _photoZCounter,
      caption: "",
      src: dataUrl
    };
    photos.push(photo);
    existingSnapshot.push(photo);
  }

  await store.set('photos', photos);
  await renderBoard();
}

photoInput.addEventListener('change', async (e) => {
  const files = [...e.target.files];
  await addPhotos(files);
  photoInput.value = '';
});

let dragCounter = 0;
document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  const bgSettingsDrawer = document.getElementById('bgSettingsDrawer');
  if (bgSettingsDrawer && bgSettingsDrawer.classList.contains('open')) return;
  dragCounter++;
  if (e.dataTransfer.types.includes('Files')) {
    document.getElementById('dragOverlay').classList.add('active');
  }
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
});

document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  const bgSettingsDrawer = document.getElementById('bgSettingsDrawer');
  if (bgSettingsDrawer && bgSettingsDrawer.classList.contains('open')) return;
  dragCounter--;
  if (dragCounter === 0) {
    document.getElementById('dragOverlay').classList.remove('active');
  }
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  const bgSettingsDrawer = document.getElementById('bgSettingsDrawer');
  if (bgSettingsDrawer && bgSettingsDrawer.classList.contains('open')) return;
  dragCounter = 0;
  document.getElementById('dragOverlay').classList.remove('active');

  const files = [...e.dataTransfer.files];
  if (files.length > 0) {
    const dropCoords = { x: e.clientX, y: e.clientY };
    await addPhotos(files, dropCoords);
  }
});

window.renderBoard = renderBoard;
window.addPhotos = addPhotos;

let _copiedPhoto = null; // Internal store for copied photo object and blob

// Helper to get targeted photo element (selected, hovered, or single photo)
function getTargetPhotoElement() {
  if (_focusedPhotoEl && document.body.contains(_focusedPhotoEl)) {
    return _focusedPhotoEl;
  }
  const canvasTarget = document.getElementById('boardCanvas') || board;
  if (!canvasTarget) return null;
  const selected = canvasTarget.querySelector('.photo.selected');
  if (selected) return selected;
  const allPhotos = canvasTarget.querySelectorAll('.photo');
  if (allPhotos.length === 1) return allPhotos[0];
  return null;
}

// Keyboard shortcuts for Whiteboard: Ctrl+C (Copy), Ctrl+V (Paste), Delete, Backspace
document.addEventListener('keydown', async (e) => {
  const isCmdOrCtrl = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  // Don't fire if typing in an input, textarea, or editable element
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) return;

  // Don't fire if a modal or tutorial is open
  const modalOverlay = document.getElementById('customModalOverlay');
  if (modalOverlay && modalOverlay.classList.contains('active')) return;
  const tutorialOverlay = document.getElementById('tutorialOverlay');
  if (tutorialOverlay && tutorialOverlay.classList.contains('visible')) return;

  // Don't fire if board is locked
  if (board && board.classList.contains('board-locked')) return;

  // Handle Ctrl+C / Cmd+C (Copy Photo)
  if (isCmdOrCtrl && key === 'c') {
    const targetEl = getTargetPhotoElement();
    if (!targetEl) return;
    const photoId = targetEl.dataset.id;
    const photo = loadedPhotos.find(p => p.id === photoId);
    if (!photo) return;

    e.preventDefault();

    let blob = await largeStore.get('photo_img_' + photoId);
    if (!blob && photo.src) {
      blob = dataURLtoBlob(photo.src);
    }

    _copiedPhoto = {
      photo: { ...photo },
      blob: blob
    };

    // Write to browser system clipboard
    if (blob && navigator.clipboard && window.ClipboardItem) {
      try {
        const mimeType = blob.type || 'image/png';
        const item = new ClipboardItem({ [mimeType]: blob });
        await navigator.clipboard.write([item]);
      } catch (err) {
        // Ignored if permissions restrict clipboard write
      }
    }

    // Visual feedback
    targetEl.classList.remove('photo-lifted');
    void targetEl.offsetWidth; // trigger reflow
    targetEl.classList.add('photo-lifted');
    if (typeof showFocusNotification === 'function') {
      showFocusNotification("Photo Copied to Clipboard");
    }
    return;
  }

  // Handle Ctrl+V / Cmd+V (Paste Photo/Image via Keydown)
  if (isCmdOrCtrl && key === 'v') {
    let pastedSystemImage = false;

    // Try reading system clipboard directly if available
    if (navigator.clipboard && navigator.clipboard.read) {
      try {
        const items = await navigator.clipboard.read();
        const files = [];
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const b = await item.getType(type);
              if (b) files.push(b);
            }
          }
        }
        if (files.length > 0) {
          e.preventDefault();
          pastedSystemImage = true;
          await addPhotos(files);
          if (typeof showFocusNotification === 'function') {
            showFocusNotification("Pasted Image from Clipboard");
          }
          return;
        }
      } catch (err) {
        // Ignored if clipboard read permission not granted
      }
    }

    // Fallback to internal _copiedPhoto
    if (!pastedSystemImage && _copiedPhoto && _copiedPhoto.blob) {
      e.preventDefault();

      const prevX = _copiedPhoto.photo.x !== undefined ? _copiedPhoto.photo.x : 100;
      const prevY = _copiedPhoto.photo.y !== undefined ? _copiedPhoto.photo.y : 100;
      const newX = prevX + 30;
      const newY = prevY + 30;

      _copiedPhoto.photo.x = newX;
      _copiedPhoto.photo.y = newY;

      const dropCoords = { x: newX, y: newY, isWorld: true };
      await addPhotos([_copiedPhoto.blob], dropCoords);

      if (typeof showFocusNotification === 'function') {
        showFocusNotification("Pasted Photo onto Whiteboard");
      }
    }
    return;
  }

  // Handle Delete / Backspace (Delete Photo)
  if (key === 'delete' || key === 'backspace') {
    const targetEl = getTargetPhotoElement();
    if (!targetEl) return;
    const delBtn = targetEl.querySelector('.del');
    if (delBtn) {
      e.preventDefault();
      delBtn.click();
      _focusedPhotoEl = null;
    }
    return;
  }
});

// Clipboard Paste Event Handler for Whiteboard Images (Ctrl+V / Cmd+V or context menu paste)
document.addEventListener('paste', async (e) => {
  // Don't fire if typing in an input, textarea, or editable element
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) return;

  // Don't fire if a modal or tutorial is open
  const modalOverlay = document.getElementById('customModalOverlay');
  if (modalOverlay && modalOverlay.classList.contains('active')) return;
  const tutorialOverlay = document.getElementById('tutorialOverlay');
  if (tutorialOverlay && tutorialOverlay.classList.contains('visible')) return;

  // Don't fire if board is locked
  if (board && board.classList.contains('board-locked')) return;

  // 1. Check system clipboard items for image files
  const clipboardItems = e.clipboardData ? e.clipboardData.items : [];
  const imageFiles = [];

  if (clipboardItems && clipboardItems.length > 0) {
    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
  }

  if (imageFiles.length > 0) {
    e.preventDefault();
    await addPhotos(imageFiles);
    if (typeof showFocusNotification === 'function') {
      showFocusNotification("Pasted Image onto Whiteboard");
    }
    return;
  }

  // 2. Fallback to internal copied photo
  if (_copiedPhoto && _copiedPhoto.blob) {
    e.preventDefault();

    const prevX = _copiedPhoto.photo.x !== undefined ? _copiedPhoto.photo.x : 100;
    const prevY = _copiedPhoto.photo.y !== undefined ? _copiedPhoto.photo.y : 100;
    const newX = prevX + 30;
    const newY = prevY + 30;

    _copiedPhoto.photo.x = newX;
    _copiedPhoto.photo.y = newY;

    const dropCoords = { x: newX, y: newY, isWorld: true };
    await addPhotos([_copiedPhoto.blob], dropCoords);

    if (typeof showFocusNotification === 'function') {
      showFocusNotification("Pasted Photo onto Whiteboard");
    }
  }
});


// ==========================================
// 5. USER INTERFACE FLOW & INITIALIZATION (ui.js)
// ==========================================

function getDragAfterElement(container, y, selector) {
  const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}


function faviconUrl(url) {
  try {
    if (window.chrome && chrome.runtime && chrome.runtime.id) {
      return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=64`;
    }
    return '';
  } catch (e) { return ''; }
}

const bookmarksToggle = document.getElementById('bookmarksToggle');
const bookmarksDrawer = document.getElementById('bookmarksDrawer');
const closeBookmarks = document.getElementById('closeBookmarks');
const bookmarksList = document.getElementById('bookmarksList');
const bookmarkSearchInput = document.getElementById('bookmarkSearchInput');

let cachedBookmarks = [];

bookmarksToggle.addEventListener('click', () => {
  const bgSettingsDrawer = document.getElementById('bgSettingsDrawer');
  const todoDrawer = document.getElementById('todoDrawer');
  if (bgSettingsDrawer) bgSettingsDrawer.classList.remove('open');
  if (todoDrawer) todoDrawer.classList.remove('open');
  bookmarksDrawer.classList.toggle('open');
  if (bookmarksDrawer.classList.contains('open')) {
    bookmarkSearchInput.value = '';
    loadBookmarks();
  }
});

closeBookmarks.addEventListener('click', () => {
  bookmarksDrawer.classList.remove('open');
});

document.addEventListener('click', (e) => {
  const bgSettingsDrawer = document.getElementById('bgSettingsDrawer');
  const bgSettingsToggleBtn = document.getElementById('bgSettingsToggleBtn');
  const todoDrawer = document.getElementById('todoDrawer');
  const todoToggle = document.getElementById('todoToggle');

  if (bookmarksDrawer && !bookmarksDrawer.contains(e.target) && bookmarksToggle && !bookmarksToggle.contains(e.target)) {
    bookmarksDrawer.classList.remove('open');
  }
  if (bgSettingsDrawer && !bgSettingsDrawer.contains(e.target) && bgSettingsToggleBtn && !bgSettingsToggleBtn.contains(e.target)) {
    bgSettingsDrawer.classList.remove('open');
  }
  if (todoDrawer && !todoDrawer.contains(e.target) && todoToggle && !todoToggle.contains(e.target)) {
    todoDrawer.classList.remove('open');
  }
});

async function loadBookmarks() {
  bookmarksList.innerHTML = '';

  if (window.chrome && chrome.bookmarks && chrome.bookmarks.getTree) {
    chrome.bookmarks.getTree((tree) => {
      const flat = [];
      function traverse(nodes) {
        nodes.forEach(node => {
          if (node.url) {
            flat.push(node);
          }
          if (node.children) {
            traverse(node.children);
          }
        });
      }
      traverse(tree);
      cachedBookmarks = flat;
      filterAndRenderBookmarks();
    });
  } else {
    const mock = [
      { title: 'Google', url: 'https://google.com' },
      { title: 'Brave Search', url: 'https://search.brave.com' },
      { title: 'GitHub', url: 'https://github.com' },
      { title: 'Hacker News', url: 'https://news.ycombinator.com' },
      { title: 'YouTube', url: 'https://youtube.com' }
    ];
    cachedBookmarks = mock;
    filterAndRenderBookmarks();
  }
}

function filterAndRenderBookmarks() {
  const query = bookmarkSearchInput.value.toLowerCase().trim();
  if (!query) {
    renderBookmarksList(cachedBookmarks);
    return;
  }
  const filtered = cachedBookmarks.filter(bm => {
    const titleMatch = bm.title && bm.title.toLowerCase().includes(query);
    const urlMatch = bm.url && bm.url.toLowerCase().includes(query);
    return titleMatch || urlMatch;
  });
  renderBookmarksList(filtered);
}

bookmarkSearchInput.addEventListener('input', filterAndRenderBookmarks);

function renderBookmarksList(bookmarks) {
  bookmarksList.innerHTML = '';
  if (bookmarks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'bookmark-empty';
    empty.textContent = 'No bookmarks found.';
    bookmarksList.appendChild(empty);
    return;
  }

  bookmarks.forEach((bm, index) => {
    const a = document.createElement('a');
    a.className = 'bookmark-item';
    a.style.setProperty('--item-index', index);
    a.href = bm.url;
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.button === 1) {
        return;
      }
      e.preventDefault();
      window.location.href = bm.url;
    });

    const img = document.createElement('img');
    img.className = 'bookmark-icon';
    img.src = faviconUrl(bm.url);
    img.alt = '';
    img.onerror = () => {
      img.remove();
      const initial = document.createElement('div');
      initial.className = 'bookmark-fallback-icon';
      initial.textContent = bm.title ? bm.title.trim().slice(0, 1).toUpperCase() : 'B';
      a.insertBefore(initial, a.firstChild);
    };
    img.setAttribute('draggable', 'false');
    a.appendChild(img);

    const title = document.createElement('span');
    title.className = 'bookmark-title';
    title.textContent = bm.title || bm.url;
    title.title = bm.title || bm.url;
    a.appendChild(title);

    bookmarksList.appendChild(a);
  });
}

// ==========================================
// 6. TASKS / TO-DO LIST (todo.js)
// ==========================================

const todoToggle = document.getElementById('todoToggle');
const todoDrawer = document.getElementById('todoDrawer');
const closeTodo = document.getElementById('closeTodo');
const todoInput = document.getElementById('todoInput');
const todoPriority = document.getElementById('todoPriority');
const addTodoBtn = document.getElementById('addTodoBtn');
const todoListEl = document.getElementById('todoList');
const todoCountEl = document.getElementById('todoCount');
const todoBadge = document.getElementById('todoBadge');
const clearCompletedTodoBtn = document.getElementById('clearCompletedTodo');

let todos = [];

if (todoToggle) {
  todoToggle.addEventListener('click', () => {
    const bgSettingsDrawer = document.getElementById('bgSettingsDrawer');
    const bookmarksDrawer = document.getElementById('bookmarksDrawer');
    if (bgSettingsDrawer) bgSettingsDrawer.classList.remove('open');
    if (bookmarksDrawer) bookmarksDrawer.classList.remove('open');

    todoDrawer.classList.toggle('open');
    if (todoDrawer.classList.contains('open')) {
      todoInput.focus();
    }
  });
}

if (closeTodo) {
  closeTodo.addEventListener('click', () => {
    todoDrawer.classList.remove('open');
  });
}

function makeWidgetDraggable(widgetEl, storageKeyPrefix) {
  if (!widgetEl) return;

  async function restorePosition() {
    const savedPos = await store.get(storageKeyPrefix + 'Pos', null);
    if (savedPos && savedPos.left !== undefined && savedPos.top !== undefined) {
      widgetEl.style.left = savedPos.left + 'px';
      widgetEl.style.top = savedPos.top + 'px';
      widgetEl.style.right = 'auto';
      widgetEl.style.bottom = 'auto';
    }
  }
  restorePosition();

  let isDragging = false;
  let startX = 0, startY = 0;
  let initialLeft = 0, initialTop = 0;

  widgetEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || e.target.closest('.clock-todo-checkbox') || e.target.closest('a') || e.target.closest('input')) {
      return;
    }
    e.preventDefault();
    isDragging = true;
    widgetEl.classList.add('dragging');

    const rect = widgetEl.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    startX = e.clientX;
    startY = e.clientY;

    widgetEl.setPointerCapture(e.pointerId);

    function onPointerMove(ev) {
      if (!isDragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const margin = 10;
      newLeft = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, newLeft));
      newTop = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, newTop));

      widgetEl.style.left = newLeft + 'px';
      widgetEl.style.top = newTop + 'px';
      widgetEl.style.right = 'auto';
      widgetEl.style.bottom = 'auto';
    }

    async function onPointerUp() {
      if (!isDragging) return;
      isDragging = false;
      widgetEl.classList.remove('dragging');
      try {
        widgetEl.releasePointerCapture(e.pointerId);
      } catch (err) { }

      widgetEl.removeEventListener('pointermove', onPointerMove);
      widgetEl.removeEventListener('pointerup', onPointerUp);

      const rectAfter = widgetEl.getBoundingClientRect();
      await store.set(storageKeyPrefix + 'Pos', {
        left: Math.round(rectAfter.left),
        top: Math.round(rectAfter.top)
      });
    }

    widgetEl.addEventListener('pointermove', onPointerMove);
    widgetEl.addEventListener('pointerup', onPointerUp);
  });
}

async function initTodos() {
  todos = await store.get('todos', []);
  renderTodos();
}

async function saveTodos() {
  await store.set('todos', todos);
}


function renderTodos() {
  if (!todoListEl) return;
  todoListEl.innerHTML = '';

  const activeCount = todos.filter(t => !t.completed).length;
  todoCountEl.textContent = `${activeCount} task${activeCount === 1 ? '' : 's'} left`;

  if (todoBadge) {
    todoBadge.textContent = activeCount;
    if (activeCount > 0) {
      todoBadge.classList.remove('hidden');
    } else {
      todoBadge.classList.add('hidden');
    }
  }

  if (todos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'bookmark-empty';
    empty.textContent = 'No tasks found. Add one above!';
    todoListEl.appendChild(empty);
    return;
  }

  todos.forEach((todo, index) => {
    const li = document.createElement('li');
    li.className = 'todo-item';
    li.style.setProperty('--item-index', index);
    if (todo.completed) li.classList.add('completed');
    li.dataset.id = todo.id;
    li.setAttribute('draggable', 'true');

    // Drag handlers
    li.addEventListener('dragstart', (e) => {
      li.classList.add('dragging');
      e.dataTransfer.setData('text/plain', todo.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    li.addEventListener('dragend', async () => {
      li.classList.remove('dragging');
      const itemElements = [...todoListEl.querySelectorAll('.todo-item')];
      const newOrder = itemElements.map(el => {
        const id = el.dataset.id;
        return todos.find(t => t.id === id);
      }).filter(Boolean);
      todos = newOrder;
      await saveTodos();
    });

    // Checkbox
    const cbContainer = document.createElement('div');
    cbContainer.className = 'todo-checkbox-container';
    const checkbox = document.createElement('div');
    checkbox.className = 'todo-checkbox';
    checkbox.addEventListener('click', async (e) => {
      e.stopPropagation();
      todo.completed = !todo.completed;
      await saveTodos();
      renderTodos();
    });
    cbContainer.appendChild(checkbox);
    li.appendChild(cbContainer);

    // Content (Text & Badges)
    const content = document.createElement('div');
    content.className = 'todo-content';

    const textSpan = document.createElement('span');
    textSpan.className = 'todo-text';
    textSpan.textContent = todo.text;
    textSpan.title = 'Double-click to edit';

    // Double-click edit handler
    textSpan.addEventListener('dblclick', (e) => {
      if (todo.completed) return;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'todo-edit-input';
      input.value = todo.text;
      input.maxLength = 120;
      input.spellcheck = false;

      const saveEdit = async () => {
        const val = input.value.trim();
        if (val && val !== todo.text) {
          todo.text = val;
          await saveTodos();
        }
        renderTodos();
      };

      input.addEventListener('keydown', async (ev) => {
        if (ev.key === 'Enter') {
          await saveEdit();
        } else if (ev.key === 'Escape') {
          renderTodos();
        }
      });

      input.addEventListener('blur', async () => {
        await saveEdit();
      });

      textSpan.replaceWith(input);
      input.focus();
      input.select();
    });

    content.appendChild(textSpan);

    // Metadata Row
    const metaRow = document.createElement('div');
    metaRow.className = 'todo-meta';

    // Priority Badge
    const priorityBadge = document.createElement('span');
    priorityBadge.className = `priority-badge priority-${todo.priority}`;
    priorityBadge.textContent = todo.priority;
    metaRow.appendChild(priorityBadge);

    content.appendChild(metaRow);
    li.appendChild(content);

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.className = 'todo-delete';
    delBtn.innerHTML = '&times;';
    delBtn.title = 'Delete Task';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      todos = todos.filter(t => t.id !== todo.id);
      await saveTodos();
      renderTodos();
    });
    li.appendChild(delBtn);

    todoListEl.appendChild(li);
  });

  renderClockWidgetTodos();
}

function renderClockWidgetTodos() {
  const clockTodoList = document.getElementById('clockTodoList');
  if (!clockTodoList) return;

  clockTodoList.innerHTML = '';

  const pendingTodos = todos.filter(t => !t.completed);

  if (pendingTodos.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'clock-todo-empty';
    empty.textContent = 'All caught up!';
    clockTodoList.appendChild(empty);
  } else {
    const MAX_VISIBLE = 4;
    const visible = pendingTodos.slice(0, MAX_VISIBLE);

    visible.forEach(todo => {
      const li = document.createElement('li');
      li.className = 'clock-todo-item';

      const checkbox = document.createElement('div');
      checkbox.className = 'clock-todo-checkbox';
      checkbox.title = 'Complete task';
      checkbox.addEventListener('click', async (e) => {
        e.stopPropagation();
        todo.completed = true;
        await saveTodos();
        renderTodos();
      });

      const text = document.createElement('span');
      text.className = 'clock-todo-text';
      text.textContent = todo.text;
      text.title = todo.text;

      const dot = document.createElement('span');
      dot.className = `clock-todo-dot priority-${todo.priority || 'medium'}`;
      dot.title = `${todo.priority || 'medium'} priority`;

      li.appendChild(checkbox);
      li.appendChild(text);
      li.appendChild(dot);

      clockTodoList.appendChild(li);
    });
  }

  const overflow = pendingTodos.length - 4;
  const moreBtn = document.getElementById('clockTodoOpenDrawerBtn');
  if (moreBtn) {
    if (overflow > 0) {
      moreBtn.textContent = `+${overflow} more`;
    } else {
      moreBtn.textContent = 'View All';
    }
  }
}

const clockTodoOpenDrawerBtn = document.getElementById('clockTodoOpenDrawerBtn');
if (clockTodoOpenDrawerBtn) {
  clockTodoOpenDrawerBtn.addEventListener('click', () => {
    const todoDrawer = document.getElementById('todoDrawer');
    const bgSettingsDrawer = document.getElementById('bgSettingsDrawer');
    const bookmarksDrawer = document.getElementById('bookmarksDrawer');
    if (bgSettingsDrawer) bgSettingsDrawer.classList.remove('open');
    if (bookmarksDrawer) bookmarksDrawer.classList.remove('open');
    if (todoDrawer) {
      todoDrawer.classList.add('open');
      const todoInput = document.getElementById('todoInput');
      if (todoInput) todoInput.focus();
    }
  });
}

async function handleAddTodo() {
  const text = todoInput.value.trim();
  if (!text) return;

  const priority = todoPriority.value;

  const newTodo = {
    id: 'todo_' + Date.now() + Math.random().toString(36).slice(2),
    text: text,
    completed: false,
    priority: priority
  };

  todos.push(newTodo);
  await saveTodos();
  renderTodos();

  // Reset inputs
  todoInput.value = '';
  todoPriority.value = 'medium';
}

if (addTodoBtn) {
  addTodoBtn.addEventListener('click', handleAddTodo);
}
if (todoInput) {
  todoInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleAddTodo();
    }
  });
}

if (clearCompletedTodoBtn) {
  clearCompletedTodoBtn.addEventListener('click', async () => {
    const completedCount = todos.filter(t => t.completed).length;
    if (completedCount === 0) return;

    const confirmed = await ModalManager.confirm(`Clear all ${completedCount} completed task${completedCount === 1 ? '' : 's'}?`);
    if (!confirmed) return;

    todos = todos.filter(t => !t.completed);
    await saveTodos();
    renderTodos();
  });
}

if (todoListEl) {
  todoListEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    const draggingEl = todoListEl.querySelector('.todo-item.dragging');
    if (!draggingEl) return;
    const afterElement = getDragAfterElement(todoListEl, e.clientY, '.todo-item');
    if (afterElement == null) {
      todoListEl.appendChild(draggingEl);
    } else {
      todoListEl.insertBefore(draggingEl, afterElement);
    }
  });
}

const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'light') {
    themeIcon.innerHTML = '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>';
  } else {
    themeIcon.innerHTML = '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>';
  }
}

async function initTheme() {
  const theme = await store.get('theme', 'dark');
  applyTheme(theme);
}

themeToggle.addEventListener('click', async () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  await store.set('theme', next);
});


const lockBoardBtn = document.getElementById('lockBoardBtn');
const lockIcon = document.getElementById('lockIcon');
let boardIsLocked = false;

async function applyLockState(locked) {
  boardIsLocked = locked;
  const boardEl = document.getElementById('board');
  if (locked) {
    boardEl.classList.add('board-locked');
    lockBoardBtn.classList.add('active');
    lockIcon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
  } else {
    boardEl.classList.remove('board-locked');
    lockBoardBtn.classList.remove('active');
    lockIcon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>';
  }
}

async function initLockState() {
  const locked = await store.get('boardLocked', false);
  applyLockState(locked);
}

lockBoardBtn.addEventListener('click', async () => {
  const next = !boardIsLocked;
  applyLockState(next);
  await store.set('boardLocked', next);
});

async function initBackground() {
  // Background image feature removed
}

async function migrateLegacyData() {
  const photos = await store.get('photos', []);
  let needsSave = false;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];

    if (photo.src && photo.src.startsWith('data:')) {
      const blob = dataURLtoBlob(photo.src);
      if (blob) {
        await largeStore.set('photo_img_' + photo.id, blob);
        delete photo.src;
        needsSave = true;
      }
    }

    if (photo.wPercent !== undefined && photo.w === undefined) {
      photo.w = Math.round(photo.wPercent * window.innerWidth);
      photo.h = Math.round(photo.hPercent * window.innerHeight);
      delete photo.wPercent;
      delete photo.hPercent;
      needsSave = true;
    }

    if (photo.xPercent === undefined) {
      const w = photo.w || 150;
      const h = photo.h || 150;
      const x = photo.x || (window.innerWidth / 2 - w / 2);
      const y = photo.y || (window.innerHeight / 2 - h / 2);

      photo.xPercent = x / window.innerWidth;
      photo.yPercent = y / window.innerHeight;
      photo.w = w;
      photo.h = h;

      delete photo.x;
      delete photo.y;
      needsSave = true;
    }
  }

  if (needsSave) {
    await store.set('photos', photos);
  }
}

function initMagneticToolbarButtons() {
  const buttons = document.querySelectorAll('.vertical-toolbar .task-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      btn.style.transform = `translate(${dx * 0.28}px, ${dy * 0.28}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0px, 0px)';
    });
  });
}

async function startupInit() {
  try { await migrateLegacyData(); } catch (e) { console.error("startupInit migrateLegacyData:", e); }
  try { await initCanvasTransform(); } catch (e) { console.error("startupInit initCanvasTransform:", e); }
  try { await initBackground(); } catch (e) { console.error("startupInit initBackground:", e); }
  try { await initTheme(); } catch (e) { console.error("startupInit initTheme:", e); }
  try { await initClock(); } catch (e) { console.error("startupInit initClock:", e); }

  try {
    if (typeof initFocusMode === 'function') {
      await initFocusMode();
    }
  } catch (e) { console.error("startupInit initFocusMode:", e); }

  try { await initLockState(); } catch (e) { console.error("startupInit initLockState:", e); }
  try { await initTodos(); } catch (e) { console.error("startupInit initTodos:", e); }
  try { initMagneticToolbarButtons(); } catch (e) { console.error("startupInit initMagneticToolbarButtons:", e); }

  try {
    if (typeof renderBoard === 'function') {
      await renderBoard();
    }
  } catch (e) { console.error("startupInit renderBoard:", e); }
}

let is24HourClock = false;

async function initClock() {
  const clockView = document.getElementById('clockView');
  if (!clockView) return;
  is24HourClock = await store.get('clock24HourFormat', false);
  clockView.addEventListener('click', async () => {
    is24HourClock = !is24HourClock;
    await store.set('clock24HourFormat', is24HourClock);
    tickClock();
    if (typeof showFocusNotification === 'function') {
      showFocusNotification(is24HourClock ? "24-Hour Format Active" : "12-Hour Format Active");
    }
  });
  tickClock();
}

function tickClock() {
  const hoursEl = document.getElementById('clockHours');
  const minutesEl = document.getElementById('clockMinutes');
  if (!hoursEl || !minutesEl) return;
  const now = new Date();
  const rawHours = now.getHours();
  let h = rawHours;
  const m = now.getMinutes().toString().padStart(2, '0');
  let ampmStr = '';

  if (is24HourClock) {
    ampmStr = '';
  } else {
    ampmStr = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
  }

  hoursEl.textContent = is24HourClock ? rawHours.toString().padStart(2, '0') : h.toString().padStart(2, '0');
  minutesEl.textContent = m;

  const ampmSpan = document.getElementById('ampm');
  if (ampmSpan) {
    ampmSpan.textContent = ampmStr;
    ampmSpan.style.display = ampmStr ? 'inline' : 'none';
  }

  // Full date: "Friday, July 31"
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const dateEl = document.getElementById('date');
  if (dateEl) dateEl.textContent = dateStr;
}

function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const suggestionsContainer = document.getElementById('suggestionsContainer');
  const searchWrapper = document.getElementById('searchWrapper');

  if (!searchInput || !suggestionsContainer) return;

  let debounceTimer = null;
  let suggestions = [];
  let selectedIndex = -1;

  function executeSearch(query) {
    if (!query) return;
    if (window.chrome && chrome.search && chrome.search.query) {
      chrome.search.query({
        text: query,
        disposition: 'CURRENT_TAB'
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Chrome search API error:", chrome.runtime.lastError);
          window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        }
      });
    } else {
      window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }
  }

  function fallbackMockTopSites() {
    suggestions = [
      { title: "Google", url: "https://google.com", type: "topsite" },
      { title: "YouTube", url: "https://youtube.com", type: "topsite" },
      { title: "GitHub", url: "https://github.com", type: "bookmark" },
      { title: "Gmail", url: "https://mail.google.com", type: "topsite" },
      { title: "ChatGPT", url: "https://chatgpt.com", type: "topsite" }
    ];
    renderSuggestions();
  }

  async function fetchSuggestions(query) {
    if (!query) {
      if (window.chrome && chrome.topSites && chrome.topSites.get) {
        chrome.topSites.get((topSites) => {
          suggestions = (topSites || []).slice(0, 6).map(t => ({
            title: t.title || t.url,
            url: t.url,
            type: 'topsite'
          }));
          renderSuggestions();
        });
      } else {
        fallbackMockTopSites();
      }
      return;
    }

    const getBookmarks = () => {
      return new Promise((resolve) => {
        if (window.chrome && chrome.bookmarks && chrome.bookmarks.search) {
          chrome.bookmarks.search(query, (bookmarks) => {
            resolve((bookmarks || [])
              .filter(b => b.url)
              .map(b => ({
                title: b.title || b.url,
                url: b.url,
                type: 'bookmark'
              }))
            );
          });
        } else {
          resolve([]);
        }
      });
    };

    const getTopSites = () => {
      return new Promise((resolve) => {
        if (window.chrome && chrome.topSites && chrome.topSites.get) {
          chrome.topSites.get((topSites) => {
            resolve((topSites || [])
              .map(t => ({
                title: t.title || t.url,
                url: t.url,
                type: 'topsite'
              }))
              .filter(t => {
                const q = query.toLowerCase();
                return t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q);
              })
            );
          });
        } else {
          resolve([]);
        }
      });
    };

    const getGoogleSuggestions = () => {
      return new Promise((resolve) => {
        if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'fetchSuggestions', query }, (response) => {
            if (response && response.success && response.data && Array.isArray(response.data[1])) {
              resolve(response.data[1].map(text => ({
                title: text,
                url: `https://www.google.com/search?q=${encodeURIComponent(text)}`,
                type: 'search'
              })));
            } else {
              resolve([]);
            }
          });
        } else {
          resolve([]);
        }
      });
    };

    Promise.all([getBookmarks(), getTopSites(), getGoogleSuggestions()]).then(([bookmarks, topSites, googleQueries]) => {
      if (searchInput.value.trim() !== query) return;

      let combined = [...bookmarks, ...topSites, ...googleQueries];
      let seen = new Set();
      suggestions = combined.filter(item => {
        const key = item.type === 'search' ? `search:${item.title.toLowerCase()}` : item.url.replace(/\/$/, "").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 6);

      renderSuggestions();
    });
  }

  function renderSuggestions() {
    suggestionsContainer.innerHTML = '';
    if (suggestions.length === 0) {
      hideSuggestions();
      return;
    }

    suggestions.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      if (index === selectedIndex) {
        div.classList.add('selected');
      }

      let host = "";
      let iconHtml = "";
      let tagText = "";

      if (item.type === 'search') {
        host = "Google Search";
        tagText = "";
        iconHtml = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-dim);">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        `;
      } else {
        try {
          host = new URL(item.url).hostname;
        } catch (e) {
          host = item.url;
        }
        tagText = item.type === 'bookmark' ? '★' : '↗';
        const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(item.url)}`;
        iconHtml = `<img src="${faviconUrl}" onerror="this.style.display='none';" />`;
      }

      div.innerHTML = `
        <span class="suggestion-icon">
          ${iconHtml}
        </span>
        <span class="suggestion-text-container">
          <span class="suggestion-title">${escapeHtml(item.title)}</span>
          <span class="suggestion-url">${escapeHtml(host)}</span>
        </span>
        <span class="suggestion-tag">${escapeHtml(tagText)}</span>
      `;

      div.addEventListener('click', () => {
        window.location.href = item.url;
        hideSuggestions();
      });

      suggestionsContainer.appendChild(div);
    });

    suggestionsContainer.classList.add('visible');
  }

  function hideSuggestions() {
    suggestionsContainer.classList.remove('visible');
    suggestions = [];
    selectedIndex = -1;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim();
    selectedIndex = -1;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchSuggestions(val);
    }, 150);
  });

  searchInput.addEventListener('focus', () => {
    document.body.classList.add('search-focused');
    const val = searchInput.value.trim();
    fetchSuggestions(val);
  });

  searchInput.addEventListener('blur', () => {
    document.body.classList.remove('search-focused');
    setTimeout(() => {
      if (document.activeElement !== searchInput) {
        hideSuggestions();
      }
    }, 200);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        selectedIndex = (selectedIndex + 1) % suggestions.length;
        renderSuggestions();
        searchInput.value = suggestions[selectedIndex].title;
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        selectedIndex = (selectedIndex - 1 + suggestions.length) % suggestions.length;
        renderSuggestions();
        searchInput.value = suggestions[selectedIndex].title;
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideSuggestions();
      searchInput.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        window.location.href = suggestions[selectedIndex].url;
      } else {
        const finalQuery = searchInput.value.trim();
        executeSearch(finalQuery);
      }
      hideSuggestions();
    }
  });

  const searchOverlay = document.getElementById('searchOverlay');
  if (searchOverlay) {
    searchOverlay.addEventListener('mousedown', (e) => {
      e.preventDefault();
      hideSuggestions();
      searchInput.blur();
    });
  }
}

if (document.getElementById('clockHours')) {
  tickClock();
  setInterval(tickClock, 1000);
}

initSearch();
startupInit();
