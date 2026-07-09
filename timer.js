// ---------- Focus Mode Countdown Timer ----------
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
let timerState = 'idle'; // 'idle', 'running', 'paused', 'finished'
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
  // Ignore dblclick if inside interactive widgets
  if (e && e.type === 'dblclick') {
    if (e.target.closest('.photo') ||
      e.target.closest('.right-panel') ||
      e.target.closest('.vertical-toolbar') ||
      e.target.closest('.bookmarks-drawer') ||
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

// Optical dimness overlay updater based on timer states
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

    // Warm bell chime synthesis (fundamental C5 + harmonic G5 + C6 harmonics)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now); // G5
    gain2.gain.setValueAtTime(0.15, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1046.50, now); // C6
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

// Request Desktop Notification Permission
function requestNotificationPermission() {
  if (window.Notification && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Desktop Notification Trigger
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

    // Increment completed focus blocks session streak
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

  // Load and display Pomodoro focus session completion count (streak)
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
}

// Timer input & editing
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
  val = Math.min(999, val); // clamp to max 999 mins

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

// Global dblclick to toggle Focus Mode
document.addEventListener('dblclick', toggleFocusMode);

// Keyboard Esc shortcut to toggle Focus Mode
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }

    // Close drawers first if open
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

// Focus Keybind Listeners
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

// Sync Timer state across tabs
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

// Wire up preset buttons click listeners
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
    });
  });
}

// Expose variables globally
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
