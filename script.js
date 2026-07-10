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
        chromeStore.get([key], r => res(r[key] !== undefined ? r[key] : fallback));
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
        chromeStore.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            console.error(`Flash Dash Storage Error: Failed to set key "${key}":`, chrome.runtime.lastError);
          }
          res();
        });
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
        chromeStore.set(obj, () => {
          if (chrome.runtime.lastError) {
            console.error('Flash Dash Storage Error: Failed to set multiple keys:', chrome.runtime.lastError, obj);
          }
          res();
        });
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
      this.content.innerHTML = `<div style="font-size: 14px; line-height: 1.5; font-weight: 500; text-align: center; margin: 10px 0;">${message}</div>`;
      this.confirmBtn.textContent = 'Confirm';
      this.cancelBtn.textContent = 'Cancel';
      this.overlay.classList.add('active');
    });
  },

  async alert(message) {
    return new Promise((resolve) => {
      this.currentResolve = resolve;
      this.content.innerHTML = `<div style="font-size: 14px; line-height: 1.5; font-weight: 500; text-align: center; margin: 10px 0;">${message}</div>`;
      this.confirmBtn.textContent = 'OK';
      this.cancelBtn.style.display = 'none';
      this.overlay.classList.add('active');
    });
  },

  async promptShortcut() {
    return new Promise((resolve) => {
      this.content.innerHTML = `
        <div class="modal-welcome-title" style="font-size: 18px; margin-bottom: 12px;">Add Shortcut</div>
        <div class="modal-form-group">
          <label for="shortcutTitleInput">Name (Max 15 chars)</label>
          <input type="text" id="shortcutTitleInput" class="modal-input" placeholder="e.g. Google" maxlength="15" autocomplete="off" />
        </div>
        <div class="modal-form-group" style="margin-top: 12px;">
          <label for="shortcutUrlInput">URL</label>
          <input type="text" id="shortcutUrlInput" class="modal-input" placeholder="e.g. google.com" autocomplete="off" />
        </div>
      `;
      this.confirmBtn.textContent = 'Add';
      this.cancelBtn.textContent = 'Cancel';
      this.overlay.classList.add('active');

      const titleInput = document.getElementById('shortcutTitleInput');
      const urlInput = document.getElementById('shortcutUrlInput');
      
      setTimeout(() => titleInput.focus(), 50);

      const handleKey = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.confirmBtn.click();
        }
      };
      titleInput.addEventListener('keydown', handleKey);
      urlInput.addEventListener('keydown', handleKey);

      this.currentResolve = (confirmed) => {
        if (confirmed) {
          const title = titleInput.value.trim();
          let url = urlInput.value.trim();
          if (title && url) {
            resolve({ title, url });
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
    });
  },

  async showWelcomeModal() {
    return new Promise((resolve) => {
      this.currentResolve = resolve;
      this.content.innerHTML = `
        <h2 class="modal-welcome-title">⚡ Welcome to Flash Dash!</h2>
        <p class="modal-welcome-desc">A premium, distraction-free dashboard. Here are the core features:</p>
        <ul class="modal-welcome-list">
          <li class="modal-welcome-item">
            <span class="modal-welcome-icon">🕐</span>
            <div class="modal-welcome-text">
              <strong>Focus Countdown</strong>
              <span>Double-click the background or clock to enter Focus Mode. Select duration presets (10m, 25m, 30m, 45m, 60m) with micro-tick animations.</span>
            </div>
          </li>
          <li class="modal-welcome-item">
            <span class="modal-welcome-icon">✅</span>
            <div class="modal-welcome-text">
              <strong>Interactive Task List</strong>
              <span>Manage your daily schedule on the right-side task card. Drag-and-drop to reorder tasks easily, and double-click to edit inline.</span>
            </div>
          </li>
          <li class="modal-welcome-item">
            <span class="modal-welcome-icon">🔖</span>
            <div class="modal-welcome-text">
              <strong>Chrome Bookmarks Drawer</strong>
              <span>Access all Chrome bookmarks in the slide drawer, complete with real-time text search filtering.</span>
            </div>
          </li>
          <li class="modal-welcome-item">
            <span class="modal-welcome-icon">🖼️</span>
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
  }, 1500);
}

async function toggleFocusMode(e) {
  if (e && e.type === 'dblclick') {
    if (e.target.closest('.photo') ||
      e.target.closest('.right-panel') ||
      e.target.closest('.vertical-toolbar') ||
      e.target.closest('.slide-drawer') ||
      e.target.closest('#bgSettingsDrawer') ||
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
        body: "Time is up! Great focus session. ⚡",
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
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }

    let drawerClosed = false;
    const bookmarksDrawer = document.getElementById('bookmarksDrawer');
    const bgSettingsDrawer = document.getElementById('bgSettingsDrawer');

    [bookmarksDrawer, bgSettingsDrawer].forEach(drawer => {
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

let _photoZCounter = 10;
let loadedPhotos = [];
const photoObjectUrls = new Map();

async function updateClearPhotosBtnState() {
  if (!clearPhotosBtn) return;
  const photos = await store.get('photos', []);
  if (photos.length === 0) {
    clearPhotosBtn.setAttribute('disabled', 'true');
  } else {
    clearPhotosBtn.removeAttribute('disabled');
  }
}

function updatePhotoPositionStyle(el, photo) {
  el.style.left = (photo.xPercent * window.innerWidth) + 'px';
  el.style.top = (photo.yPercent * window.innerHeight) + 'px';
  el.style.width = (photo.w || 150) + 'px';
  el.style.height = (photo.h || 150) + 'px';
}

function updateAllPhotoStyles() {
  const photoEls = board.querySelectorAll('.photo');
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
const SNAP_GAP = 16;

function getOtherPhotoRects(excludeId) {
  const rects = [];
  board.querySelectorAll('.photo').forEach(el => {
    if (el.dataset.id === excludeId) return;
    const r = el.getBoundingClientRect();
    rects.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
  });
  return rects;
}

let _snapGuideEls = [];
function showSnapGuides(xLines, yLines) {
  clearSnapGuides();
  xLines.forEach(x => {
    const g = document.createElement('div');
    g.className = 'snap-guide snap-guide-x';
    g.style.left = x + 'px';
    document.body.appendChild(g);
    _snapGuideEls.push(g);
  });
  yLines.forEach(y => {
    const g = document.createElement('div');
    g.className = 'snap-guide snap-guide-y';
    g.style.top = y + 'px';
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
    e.preventDefault();

    const dir = getResizeDirection(el, e.clientX, e.clientY);
    const startX = e.clientX, startY = e.clientY;
    const origW = photo.w || 150;
    const origH = photo.h || 150;
    const origX = photo.xPercent * window.innerWidth;
    const origY = photo.yPercent * window.innerHeight;

    el.setPointerCapture(e.pointerId);

    if (dir) {
      function moveResize(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

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
        photo.xPercent = newX / window.innerWidth;
        photo.yPercent = newY / window.innerHeight;

        el.style.width = newW + 'px';
        el.style.height = newH + 'px';
        el.style.left = newX + 'px';
        el.style.top = newY + 'px';

        showSnapGuides(snap.guideX, snap.guideY);
      }

      function upResize() {
        el.removeEventListener('pointermove', moveResize);
        el.removeEventListener('pointerup', upResize);
        clearSnapGuides();
        onChange();
      }

      el.addEventListener('pointermove', moveResize);
      el.addEventListener('pointerup', upResize);

    } else {
      el.style.cursor = 'grabbing';

      function moveDrag(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        let x = origX + dx;
        let y = origY + dy;

        const margin = 20;
        x = Math.max(margin, Math.min(window.innerWidth - (photo.w || 150) - margin, x));
        y = Math.max(margin, Math.min(window.innerHeight - (photo.h || 150) - margin, y));

        const w = photo.w || 150, h = photo.h || 150;
        const tempRect = { left: x, top: y, right: x + w, bottom: y + h };
        const snap = computeSnap(tempRect, photo.id);
        x += snap.snapX;
        y += snap.snapY;

        photo.xPercent = x / window.innerWidth;
        photo.yPercent = y / window.innerHeight;

        el.style.left = x + 'px';
        el.style.top = y + 'px';

        showSnapGuides(snap.guideX, snap.guideY);
      }

      function upDrag() {
        el.removeEventListener('pointermove', moveDrag);
        el.removeEventListener('pointerup', upDrag);
        el.style.cursor = 'grab';
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

  const savedZ = photo.z || 2;
  wrap.style.zIndex = savedZ;
  if (savedZ > _photoZCounter) _photoZCounter = savedZ;

  const img = document.createElement('img');

  let srcUrl = '';
  if (photo.src && photo.src.startsWith('data:')) {
    srcUrl = photo.src;
  } else {
    const blob = await largeStore.get('photo_img_' + photo.id);
    if (blob) {
      if (photoObjectUrls.has(photo.id)) {
        URL.revokeObjectURL(photoObjectUrls.get(photo.id));
      }
      srcUrl = URL.createObjectURL(blob);
      photoObjectUrls.set(photo.id, srcUrl);
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
          id: photo.id,
          xPercent: photo.xPercent,
          yPercent: photo.yPercent,
          w: photo.w || 150,
          h: photo.h || 150,
          z: photo.z,
          caption: photo.caption || ""
        };
      }
      return photos;
    });
  }

  board.appendChild(wrap);

  wrap.addEventListener('pointerdown', () => {
    if (board.classList.contains('board-locked')) return;
    _photoZCounter += 1;
    photo.z = _photoZCounter;
    wrap.style.zIndex = _photoZCounter;
    wrap.classList.add('photo-lifted');
    setTimeout(() => wrap.classList.remove('photo-lifted'), 350);
    persist();
  });

  makeResizableAndDraggable(wrap, photo, persist);
}

async function renderBoard() {
  loadedPhotos = await store.get('photos', []);
  updateClearPhotosBtnState();

  const existingEls = new Map();
  board.querySelectorAll('.photo').forEach(el => {
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

addPhotoBtn.addEventListener('click', () => {
  const bookmarksDrawer = document.getElementById('bookmarksDrawer');
  const bgSettingsDrawer = document.getElementById('bgSettingsDrawer');
  if (bookmarksDrawer) bookmarksDrawer.classList.remove('open');
  if (bgSettingsDrawer) bgSettingsDrawer.classList.remove('open');
  photoInput.click();
});

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
    return { x: dropCoords.x - w / 2, y: dropCoords.y - h / 2 };
  }

  const GRID_GAP = 16;
  const START_X = 100;
  const START_Y = 30;
  const MAX_X = window.innerWidth - 280;

  if (existingPhotos.length === 0) {
    return { x: START_X, y: START_Y };
  }

  const last = existingPhotos[existingPhotos.length - 1];
  const lastX = (last.xPercent || 0) * window.innerWidth;
  const lastY = (last.yPercent || 0) * window.innerHeight;
  const lastW = last.w || 150;
  const lastH = last.h || 150;

  let nextX = lastX + lastW + GRID_GAP;
  let nextY = lastY;

  if (nextX + w > MAX_X) {
    nextX = START_X;
    let rowMaxBottom = lastY + lastH;
    for (const p of existingPhotos) {
      const pX = (p.xPercent || 0) * window.innerWidth;
      const pY = (p.yPercent || 0) * window.innerHeight;
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

    const coords = dropCoords
      ? { x: dropCoords.x - w / 2 + (i * 15), y: dropCoords.y - h / 2 + (i * 15) }
      : null;

    const { x, y } = computeAutoGridPosition(existingSnapshot, w, h, coords);

    const margin = 20;
    const clampedX = Math.max(margin, Math.min(window.innerWidth - w - margin, x));
    const clampedY = Math.max(margin, Math.min(window.innerHeight - h - margin, y));

    _photoZCounter += 1;
    const photoId = Date.now() + Math.random().toString(36).slice(2);

    await largeStore.set('photo_img_' + photoId, blob);

    const photo = {
      id: photoId,
      xPercent: clampedX / window.innerWidth,
      yPercent: clampedY / window.innerHeight,
      w: w,
      h: h,
      z: _photoZCounter,
      caption: ""
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

function getDragAfterShortcut(container, x) {
  const draggableElements = [...container.querySelectorAll('.shortcut-item:not(.dragging):not(.add-shortcut-btn)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = x - box.left - box.width / 2;
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
  if (bgSettingsDrawer) bgSettingsDrawer.classList.remove('open');
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

  if (bookmarksDrawer && !bookmarksDrawer.contains(e.target) && bookmarksToggle && !bookmarksToggle.contains(e.target)) {
    bookmarksDrawer.classList.remove('open');
  }
  if (bgSettingsDrawer && !bgSettingsDrawer.contains(e.target) && bgSettingsToggleBtn && !bgSettingsToggleBtn.contains(e.target)) {
    bgSettingsDrawer.classList.remove('open');
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

  bookmarks.forEach(bm => {
    const a = document.createElement('a');
    a.className = 'bookmark-item';
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

const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const taskCount = document.getElementById('taskCount');

function renderTasks(tasks) {
  taskList.innerHTML = '';
  if (tasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'task-empty';
    empty.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
    <span>All clear! Add your first task below.</span>`;
    taskList.appendChild(empty);
  }
  tasks.forEach((task, idx) => {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.setAttribute('draggable', 'false');
    li.dataset.index = idx;

    li.addEventListener('dragstart', (e) => {
      li.classList.add('dragging');
      e.dataTransfer.setData('text/plain', idx);
      e.dataTransfer.effectAllowed = 'move';
    });

    li.addEventListener('dragend', async () => {
      li.classList.remove('dragging');
      li.setAttribute('draggable', 'false');
      const items = [...taskList.querySelectorAll('.task-item')];

      await store.mutate('tasks', [], (current) => {
        return items.map(item => {
          const index = parseInt(item.dataset.index);
          return current[index];
        });
      });

      const updatedTasks = await store.get('tasks', []);
      updateCount(updatedTasks);
      renderTasks(updatedTasks);
    });

    const dragHandle = document.createElement('div');
    dragHandle.className = 'task-drag-handle';
    dragHandle.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/></svg>`;

    dragHandle.addEventListener('mousedown', () => li.setAttribute('draggable', 'true'));
    dragHandle.addEventListener('mouseup', () => li.setAttribute('draggable', 'false'));
    dragHandle.addEventListener('touchstart', () => li.setAttribute('draggable', 'true'));
    dragHandle.addEventListener('touchend', () => li.setAttribute('draggable', 'false'));

    const check = document.createElement('div');
    check.className = 'task-check' + (task.done ? ' done' : '');
    check.setAttribute('role', 'checkbox');
    check.setAttribute('aria-checked', task.done ? 'true' : 'false');
    check.setAttribute('tabindex', '0');

    const toggleDone = async () => {
      const current = await store.mutate('tasks', [], (tasks) => {
        tasks[idx].done = !tasks[idx].done;
        return tasks;
      });
      renderTasks(current);
      updateCount(current);
    };

    check.addEventListener('click', toggleDone);
    check.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleDone();
      }
    });

    const text = document.createElement('span');
    text.className = 'task-text' + (task.done ? ' done' : '');
    text.textContent = task.text;

    text.addEventListener('dblclick', (e) => {
      if (task.done) return;
      e.stopPropagation();

      const editInput = document.createElement('input');
      editInput.type = 'text';
      editInput.className = 'task-edit-input';
      editInput.value = task.text;

      li.replaceChild(editInput, text);
      editInput.focus();
      editInput.select();

      editInput.addEventListener('mousedown', (ev) => ev.stopPropagation());
      editInput.addEventListener('click', (ev) => ev.stopPropagation());
      editInput.addEventListener('dblclick', (ev) => ev.stopPropagation());

      let finished = false;
      async function finishEdit() {
        if (finished) return;
        finished = true;
        const newText = editInput.value.trim();
        if (newText && newText !== task.text) {
          task.text = newText;
          text.textContent = newText;
          li.replaceChild(text, editInput);

          await store.mutate('tasks', [], (tasks) => {
            tasks[idx].text = newText;
            return tasks;
          });
        } else {
          li.replaceChild(text, editInput);
        }
      }

      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finishEdit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          li.replaceChild(text, editInput);
          finished = true;
        }
      });

      editInput.addEventListener('blur', finishEdit);
    });

    const del = document.createElement('span');
    del.className = 'task-del';
    del.textContent = '×';
    del.addEventListener('click', async () => {
      const current = await store.mutate('tasks', [], (tasks) => {
        tasks.splice(idx, 1);
        return tasks;
      });
      renderTasks(current);
      updateCount(current);
    });

    li.appendChild(dragHandle);
    li.appendChild(check);
    li.appendChild(text);
    li.appendChild(del);
    taskList.appendChild(li);
  });
}

taskList.addEventListener('dragover', (e) => {
  e.preventDefault();
  const draggingEl = taskList.querySelector('.task-item.dragging');
  if (!draggingEl) return;
  const afterElement = getDragAfterElement(taskList, e.clientY, '.task-item');
  if (afterElement == null) {
    taskList.appendChild(draggingEl);
  } else {
    taskList.insertBefore(draggingEl, afterElement);
  }
});

function updateCount(tasks) {
  const left = tasks.filter(t => !t.done).length;
  taskCount.textContent = `${left} left`;
}

async function initTasks() {
  const tasks = await store.get('tasks', []);
  renderTasks(tasks);
  updateCount(tasks);
}

taskInput.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const text = taskInput.value.trim();
  if (!text) return;

  const current = await store.mutate('tasks', [], (tasks) => {
    tasks.push({ text, done: false });
    return tasks;
  });
  taskInput.value = '';
  renderTasks(current);
  updateCount(current);
});

const clearCompletedBtn = document.getElementById('clearCompletedBtn');
clearCompletedBtn.addEventListener('click', async () => {
  const current = await store.get('tasks', []);
  const incomplete = current.filter(t => !t.done);
  if (current.length === incomplete.length) return;

  await store.set('tasks', incomplete);
  renderTasks(incomplete);
  updateCount(incomplete);
});

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

const ghostGrid = document.getElementById('ghostGrid');

const defaultShortcuts = [
  { title: "Google", url: "https://google.com" },
  { title: "GitHub", url: "https://github.com" },
  { title: "YouTube", url: "https://youtube.com" }
];

async function loadShortcuts() {
  const list = await store.get('shortcuts', defaultShortcuts);
  renderShortcuts(list);
}

function renderShortcuts(shortcuts) {
  if (!ghostGrid) return;
  ghostGrid.innerHTML = '';

  shortcuts.forEach((sc, idx) => {
    const item = document.createElement('a');
    item.className = 'shortcut-item';
    item.href = sc.url;
    item.title = sc.title;
    item.setAttribute('draggable', 'true');
    item.dataset.index = idx;

    item.addEventListener('dragstart', (e) => {
      item.classList.add('dragging');
      e.dataTransfer.setData('text/plain', idx);
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', async () => {
      item.classList.remove('dragging');
      const items = [...ghostGrid.querySelectorAll('.shortcut-item:not(.add-shortcut-btn)')];

      await store.mutate('shortcuts', defaultShortcuts, (current) => {
        return items.map(el => {
          const index = parseInt(el.dataset.index);
          return current[index];
        });
      });

      const updatedShortcuts = await store.get('shortcuts', []);
      renderShortcuts(updatedShortcuts);
    });

    item.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.button === 1) {
        return;
      }
      e.preventDefault();
      window.location.href = sc.url;
    });

    const tile = document.createElement('div');
    tile.className = 'shortcut-tile';

    const img = document.createElement('img');
    img.className = 'shortcut-icon';
    img.src = faviconUrl(sc.url);
    img.alt = '';

    img.onerror = () => {
      img.remove();
      const fallback = document.createElement('div');
      fallback.className = 'shortcut-fallback';
      fallback.textContent = sc.title ? sc.title.slice(0, 1).toUpperCase() : 'S';
      tile.appendChild(fallback);
    };

    img.setAttribute('draggable', 'false');
    tile.appendChild(img);

    const del = document.createElement('span');
    del.className = 'shortcut-del';
    del.innerHTML = '&times;';
    del.title = 'Delete Shortcut';
    del.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const confirmed = await ModalManager.confirm(`Delete shortcut for ${sc.title}?`);
      if (!confirmed) return;

      const current = await store.mutate('shortcuts', defaultShortcuts, (shortcuts) => {
        shortcuts.splice(idx, 1);
        return shortcuts;
      });
      renderShortcuts(current);
    });
    tile.appendChild(del);

    item.appendChild(tile);

    const label = document.createElement('span');
    label.className = 'shortcut-label';
    label.textContent = sc.title;
    item.appendChild(label);

    ghostGrid.appendChild(item);
  });

  if (shortcuts.length < 8) {
    const addBtn = document.createElement('div');
    addBtn.className = 'shortcut-item add-shortcut-btn';
    addBtn.setAttribute('tabindex', '0');
    addBtn.setAttribute('role', 'button');
    addBtn.setAttribute('aria-label', 'Add Shortcut');

    const tile = document.createElement('div');
    tile.className = 'shortcut-tile';
    tile.innerHTML = '<span style="font-size: 18px; font-weight: 500;">+</span>';
    addBtn.appendChild(tile);

    const label = document.createElement('span');
    label.className = 'shortcut-label';
    label.textContent = 'Add shortcut';
    addBtn.appendChild(label);

    const triggerAdd = async () => {
      const shortcut = await ModalManager.promptShortcut();
      if (!shortcut) return;

      let { title, url } = shortcut;
      url = url.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }

      const current = await store.mutate('shortcuts', defaultShortcuts, (shortcuts) => {
        shortcuts.push({ title: title.slice(0, 15), url });
        return shortcuts;
      });
      renderShortcuts(current);
    };

    addBtn.addEventListener('click', triggerAdd);
    addBtn.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        triggerAdd();
      }
    });

    ghostGrid.appendChild(addBtn);
  }
}

if (ghostGrid) {
  ghostGrid.addEventListener('dragover', (e) => {
    e.preventDefault();
    const draggingEl = ghostGrid.querySelector('.shortcut-item.dragging');
    if (!draggingEl) return;
    const afterElement = getDragAfterShortcut(ghostGrid, e.clientX);
    const addShortcutBtn = ghostGrid.querySelector('.add-shortcut-btn');
    if (afterElement == null) {
      if (addShortcutBtn) {
        ghostGrid.insertBefore(draggingEl, addShortcutBtn);
      } else {
        ghostGrid.appendChild(draggingEl);
      }
    } else {
      ghostGrid.insertBefore(draggingEl, afterElement);
    }
  });
}

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

const bgSettingsToggleBtn = document.getElementById('bgSettingsToggleBtn');
const bgSettingsDrawer = document.getElementById('bgSettingsDrawer');
const closeBgSettings = document.getElementById('closeBgSettings');
const bgDropZone = document.getElementById('bgDropZone');
const bgFileInput = document.getElementById('bgFileInput');
const bgDimSlider = document.getElementById('bgDimSlider');
const bgDimValue = document.getElementById('bgDimValue');
const bgBlurSlider = document.getElementById('bgBlurSlider');
const bgBlurValue = document.getElementById('bgBlurValue');
const clearBgBtn = document.getElementById('clearBgBtn');
const screenBgContainer = document.getElementById('screenBgContainer');
const screenBgOverlay = document.getElementById('screenBgOverlay');

bgSettingsToggleBtn.addEventListener('click', () => {
  bookmarksDrawer.classList.remove('open');
  bgSettingsDrawer.classList.toggle('open');
});

closeBgSettings.addEventListener('click', () => {
  bgSettingsDrawer.classList.remove('open');
});

bgDropZone.addEventListener('click', () => {
  bgFileInput.click();
});

bgDropZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  e.stopPropagation();
  bgDropZone.classList.add('dragover');
});

bgDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  bgDropZone.classList.add('dragover');
});

bgDropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  bgDropZone.classList.remove('dragover');
});

bgDropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  bgDropZone.classList.remove('dragover');

  const files = [...e.dataTransfer.files];
  if (files.length > 0) {
    await processAndSetBackground(files[0]);
  }
});

bgFileInput.addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (files.length > 0) {
    await processAndSetBackground(files[0]);
  }
  bgFileInput.value = '';
});

async function downscaleBgImage(file, maxSide = 1600) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const img = new Image();
    const tempUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(tempUrl);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w <= maxSide && h <= maxSide) {
        resolve(file);
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
          resolve(new File([blob], file.name, { type: file.type || 'image/jpeg' }));
        } else {
          resolve(file);
        }
      }, file.type || 'image/jpeg', 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      resolve(file);
    };
    img.src = tempUrl;
  });
}

async function processAndSetBackground(rawFile) {
  if (!rawFile.type.startsWith('image/')) return;

  const file = await downscaleBgImage(rawFile);

  await largeStore.set('bgImage', file);
  await store.set('bgImage', 'MIGRATED');
  applyBgImage(file);
}

let bgObjectUrl = null;
function applyBgImage(src) {
  if (bgObjectUrl) {
    URL.revokeObjectURL(bgObjectUrl);
    bgObjectUrl = null;
  }
  if (src) {
    if (src instanceof Blob) {
      bgObjectUrl = URL.createObjectURL(src);
      screenBgContainer.style.backgroundImage = `url(${bgObjectUrl})`;
    } else {
      screenBgContainer.style.backgroundImage = `url(${src})`;
    }
    clearBgBtn.removeAttribute('disabled');
  } else {
    screenBgContainer.style.backgroundImage = 'none';
    clearBgBtn.setAttribute('disabled', 'true');
  }
}

bgDimSlider.addEventListener('input', (e) => {
  const val = e.target.value;
  bgDimValue.textContent = `${val}%`;
  const extraDim = (typeof timerState !== 'undefined' && timerState === 'running') ? 15 : 0;
  const finalDim = Math.min(100, parseInt(val) + extraDim);
  if (screenBgOverlay) {
    screenBgOverlay.style.opacity = finalDim / 100;
  }
});

bgDimSlider.addEventListener('change', async (e) => {
  await store.set('bgDim', e.target.value);
});

bgBlurSlider.addEventListener('input', async (e) => {
  const val = e.target.value;
  bgBlurValue.textContent = `${val}px`;
  screenBgContainer.style.filter = val > 0 ? `blur(${val}px)` : 'none';
});

bgBlurSlider.addEventListener('change', async (e) => {
  await store.set('bgBlur', e.target.value);
});

clearBgBtn.addEventListener('click', async () => {
  const confirmed = await ModalManager.confirm('Remove the screen background?');
  if (!confirmed) return;

  await store.setMultiple({
    bgImage: null,
    bgDim: 0,
    bgBlur: 0
  });
  await largeStore.delete('bgImage');

  applyBgImage(null);

  bgDimSlider.value = 0;
  bgDimValue.textContent = '0%';
  screenBgOverlay.style.opacity = 0;

  bgBlurSlider.value = 0;
  bgBlurValue.textContent = '0px';
  screenBgContainer.style.filter = 'none';
});

async function initBackground() {
  let src = await store.get('bgImage', null);

  if (src === 'MIGRATED') {
    src = await largeStore.get('bgImage', null);
  } else if (src && typeof src === 'string' && src.startsWith('data:')) {
    const blob = dataURLtoBlob(src);
    if (blob) {
      await largeStore.set('bgImage', blob);
      await store.set('bgImage', 'MIGRATED');
      src = blob;
    }
  }

  const dim = await store.get('bgDim', 0);
  const blur = await store.get('bgBlur', 0);

  applyBgImage(src);

  bgDimSlider.value = dim;
  bgDimValue.textContent = `${dim}%`;

  if (typeof applyDimnessState === 'function') {
    await applyDimnessState();
  } else {
    screenBgOverlay.style.opacity = dim / 100;
  }

  bgBlurSlider.value = blur;
  bgBlurValue.textContent = `${blur}px`;
  screenBgContainer.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
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

async function startupInit() {
  await migrateLegacyData();
  await initBackground();

  const currentTasks = await store.get('tasks', []);
  const onboardingTexts = [
    "Welcome to Flash Dash!",
    "Double-click the clock",
    "Hover under the clock",
    "Drag & drop image files"
  ];
  const filteredTasks = currentTasks.filter(t => !onboardingTexts.some(ot => t.text.includes(ot)));
  if (filteredTasks.length !== currentTasks.length) {
    await store.set('tasks', filteredTasks);
  }

  await initTasks();
  await initTheme();

  if (typeof initFocusMode === 'function') {
    await initFocusMode();
  }

  await loadShortcuts();
  await initLockState();

  if (typeof renderBoard === 'function') {
    await renderBoard();
  }

  const onboardingCompleted = await store.get('onboardingCompleted', false);
  if (!onboardingCompleted) {
    await ModalManager.showWelcomeModal();
    await store.set('onboardingCompleted', true);
  }
}

function tickClock() {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;

  const hoursEl = document.getElementById('clockHours');
  const minutesEl = document.getElementById('clockMinutes');
  if (hoursEl && minutesEl) {
    hoursEl.textContent = h.toString().padStart(2, '0');
    minutesEl.textContent = m;
  } else {
    const timeSpan = document.getElementById('time');
    if (timeSpan) timeSpan.textContent = `${h.toString().padStart(2, '0')}:${m}`;
  }

  const ampmSpan = document.getElementById('ampm');
  if (ampmSpan) ampmSpan.textContent = ampm;

  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const dateEl = document.getElementById('date');
  if (dateEl) dateEl.textContent = dateStr;
}

tickClock();
setInterval(tickClock, 1000);

startupInit();
