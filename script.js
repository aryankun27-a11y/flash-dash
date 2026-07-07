// ---------- drag-and-drop position helper ----------
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

// ---------- storage helper (chrome.storage with localStorage fallback) ----------
const store = {
  async get(key, fallback) {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      return new Promise(res => {
        chrome.storage.local.get([key], r => res(r[key] !== undefined ? r[key] : fallback));
      });
    }
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  },
  async set(key, value) {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      return new Promise(res => {
        chrome.storage.local.set({ [key]: value }, res);
      });
    }
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { }
  },
  async setMultiple(obj) {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      return new Promise(res => {
        chrome.storage.local.set(obj, res);
      });
    }
    try {
      for (const [k, v] of Object.entries(obj)) {
        localStorage.setItem(k, JSON.stringify(v));
      }
    } catch (e) { }
  }
};

// ---------- IndexedDB Storage Helper for Large Binary Blobs ----------
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
        req.onsuccess = () => {
          resolve(req.result !== undefined ? req.result : fallback);
        };
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
  }
};

// Helper: Convert Base64/DataURL to Blob
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

// ---------- clock ----------
function tickClock() {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  document.getElementById('time').textContent = `${h}:${m}`;
  document.getElementById('ampm').textContent = ampm;

  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('date').textContent = dateStr;
}
tickClock();
setInterval(tickClock, 1000);

// ---------- favicon helper ----------
function faviconUrl(url) {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?sz=64&domain=${u.hostname}`;
  } catch (e) { return ''; }
}

// ---------- bookmarks drawer ----------
const bookmarksToggle = document.getElementById('bookmarksToggle');
const bookmarksDrawer = document.getElementById('bookmarksDrawer');
const closeBookmarks = document.getElementById('closeBookmarks');
const bookmarksList = document.getElementById('bookmarksList');
const bookmarkSearchInput = document.getElementById('bookmarkSearchInput');

let cachedBookmarks = [];

bookmarksToggle.addEventListener('click', () => {
  if (typeof bgSettingsDrawer !== 'undefined') bgSettingsDrawer.classList.remove('open');
  if (typeof helpDrawer !== 'undefined') helpDrawer.classList.remove('open');
  bookmarksDrawer.classList.toggle('open');
  if (bookmarksDrawer.classList.contains('open')) {
    bookmarkSearchInput.value = '';
    loadBookmarks();
  }
});

closeBookmarks.addEventListener('click', () => {
  bookmarksDrawer.classList.remove('open');
});

// ---------- help overlay drawer ----------
const helpToggleBtn = document.getElementById('helpToggleBtn');
const helpDrawer = document.getElementById('helpDrawer');
const closeHelp = document.getElementById('closeHelp');

if (helpToggleBtn && helpDrawer) {
  helpToggleBtn.addEventListener('click', () => {
    bookmarksDrawer.classList.remove('open');
    if (typeof bgSettingsDrawer !== 'undefined') bgSettingsDrawer.classList.remove('open');
    helpDrawer.classList.toggle('open');
  });
}
if (closeHelp && helpDrawer) {
  closeHelp.addEventListener('click', () => {
    helpDrawer.classList.remove('open');
  });
}

// Close drawers if clicking outside of them
document.addEventListener('click', (e) => {
  if (bookmarksDrawer && !bookmarksDrawer.contains(e.target) && bookmarksToggle && !bookmarksToggle.contains(e.target)) {
    bookmarksDrawer.classList.remove('open');
  }
  if (bgSettingsDrawer && !bgSettingsDrawer.contains(e.target) && bgSettingsToggleBtn && !bgSettingsToggleBtn.contains(e.target)) {
    bgSettingsDrawer.classList.remove('open');
  }
  if (helpDrawer && !helpDrawer.contains(e.target) && helpToggleBtn && !helpToggleBtn.contains(e.target)) {
    helpDrawer.classList.remove('open');
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
    // Fallback mock bookmarks for non-extension testing
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
        return; // default new tab/background window redirection
      }
      e.preventDefault();
      if (window.chrome && chrome.tabs) {
        chrome.tabs.getCurrent((tab) => {
          if (tab) chrome.tabs.update(tab.id, { url: bm.url });
          else window.location.href = bm.url;
        });
      } else {
        window.location.href = bm.url;
      }
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
    a.appendChild(img);

    const title = document.createElement('span');
    title.className = 'bookmark-title';
    title.textContent = bm.title || bm.url;
    title.title = bm.title || bm.url;
    a.appendChild(title);

    bookmarksList.appendChild(a);
  });
}

// ---------- tasks ----------
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const taskCount = document.getElementById('taskCount');

function renderTasks(tasks) {
  taskList.innerHTML = '';
  if (tasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'task-empty';
    empty.textContent = 'Nothing yet.';
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
      const current = await store.get('tasks', []);
      const reordered = items.map(item => {
        const index = parseInt(item.dataset.index);
        return current[index];
      });
      await store.set('tasks', reordered);
      updateCount(reordered);
      renderTasks(reordered);
    });

    // dedicated visual drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'task-drag-handle';
    dragHandle.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/></svg>`;
    
    // Toggle draggable state on grab handle interaction
    dragHandle.addEventListener('mousedown', () => {
      li.setAttribute('draggable', 'true');
    });
    dragHandle.addEventListener('mouseup', () => {
      li.setAttribute('draggable', 'false');
    });
    dragHandle.addEventListener('touchstart', () => {
      li.setAttribute('draggable', 'true');
    });
    dragHandle.addEventListener('touchend', () => {
      li.setAttribute('draggable', 'false');
    });

    const check = document.createElement('div');
    check.className = 'task-check' + (task.done ? ' done' : '');
    check.setAttribute('role', 'checkbox');
    check.setAttribute('aria-checked', task.done ? 'true' : 'false');
    check.setAttribute('tabindex', '0');

    const toggleDone = async () => {
      const current = await store.get('tasks', []);
      current[idx].done = !current[idx].done;
      await store.set('tasks', current);
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

    // Double-click inline editing
    text.addEventListener('dblclick', (e) => {
      if (task.done) return;
      e.stopPropagation();

      const editInput = document.createElement('input');
      editInput.type = 'text';
      editInput.className = 'task-edit-input';
      editInput.value = task.text;

      li.replaceChild(editInput, text);
      editInput.focus();
      editInput.select(); // Auto-select text for easier replacement

      // Prevent input interactions from triggering drag-and-drop or select on parent
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

          const current = await store.get('tasks', []);
          current[idx].text = newText;
          await store.set('tasks', current);
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
      const current = await store.get('tasks', []);
      current.splice(idx, 1);
      await store.set('tasks', current);
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
initTasks();

taskInput.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const text = taskInput.value.trim();
  if (!text) return;
  const current = await store.get('tasks', []);
  current.push({ text, done: false });
  await store.set('tasks', current);
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

// ---------- theme ----------
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // sun for light, moon for dark
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
initTheme();

themeToggle.addEventListener('click', async () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  await store.set('theme', next);
});

// ---------- Gallery of Goals (Glassmorphic Polaroid) ----------
const board = document.getElementById('board');
const photoInput = document.getElementById('photoInput');
const addPhotoBtn = document.getElementById('addPhotoBtn');
const clearPhotosBtn = document.getElementById('clearPhotosBtn');

// Updates the disabled state of the Clear Whiteboard Photos button
async function updateClearPhotosBtnState() {
  if (!clearPhotosBtn) return;
  const photos = await store.get('photos', []);
  if (photos.length === 0) {
    clearPhotosBtn.setAttribute('disabled', 'true');
  } else {
    clearPhotosBtn.removeAttribute('disabled');
  }
}

// Tracks the highest z-index used so far so we can always bring one more to front
let _photoZCounter = 10;
let loadedPhotos = [];
const photoObjectUrls = new Map(); // photoId -> ObjectURL string

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

function makeResizableAndDraggable(el, photo, onChange) {
  // Update mouse cursor on hover near borders/corners
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
      // Edge resizing mode
      function moveResize(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        
        let newW = origW;
        let newH = origH;
        let newX = origX;
        let newY = origY;
        
        if (dir.includes("e")) {
          newW = Math.max(50, origW + dx);
        } else if (dir.includes("w")) {
          const possibleW = origW - dx;
          if (possibleW >= 50) {
            newW = possibleW;
            newX = origX + dx;
          }
        }
        
        if (dir.includes("s")) {
          newH = Math.max(50, origH + dy);
        } else if (dir.includes("n")) {
          const possibleH = origH - dy;
          if (possibleH >= 50) {
            newH = possibleH;
            newY = origY + dy;
          }
        }
        
        photo.w = newW;
        photo.h = newH;
        photo.xPercent = newX / window.innerWidth;
        photo.yPercent = newY / window.innerHeight;
        
        el.style.width = newW + 'px';
        el.style.height = newH + 'px';
        el.style.left = newX + 'px';
        el.style.top = newY + 'px';
      }
      
      function upResize() {
        el.removeEventListener('pointermove', moveResize);
        el.removeEventListener('pointerup', upResize);
        onChange();
      }
      
      el.addEventListener('pointermove', moveResize);
      el.addEventListener('pointerup', upResize);
      
    } else {
      // General dragging mode
      el.style.cursor = 'grabbing';
      
      function moveDrag(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        
        const x = origX + dx;
        const y = origY + dy;
        
        const margin = 20;
        const clampedX = Math.max(margin, Math.min(window.innerWidth - (photo.w || 150) - margin, x));
        const clampedY = Math.max(margin, Math.min(window.innerHeight - (photo.h || 150) - margin, y));
        
        photo.xPercent = clampedX / window.innerWidth;
        photo.yPercent = clampedY / window.innerHeight;
        
        el.style.left = clampedX + 'px';
        el.style.top = clampedY + 'px';
      }
      
      function upDrag() {
        el.removeEventListener('pointermove', moveDrag);
        el.removeEventListener('pointerup', upDrag);
        el.style.cursor = 'grab';
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

  // Apply persisted z-index
  const savedZ = photo.z || 2;
  wrap.style.zIndex = savedZ;
  if (savedZ > _photoZCounter) _photoZCounter = savedZ;

  const img = document.createElement('img');
  
  // Load image blob
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
  wrap.appendChild(img);

  const del = document.createElement('div');
  del.className = 'del';
  del.textContent = '×';
  del.addEventListener('click', async () => {
    const photos = await store.get('photos', []);
    const filtered = photos.filter(p => p.id !== photo.id);
    await store.set('photos', filtered);
    
    // Cleanup IndexedDB and URL caching
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
    const photos = await store.get('photos', []);
    const idx = photos.findIndex(p => p.id === photo.id);
    if (idx > -1) {
      photos[idx] = {
        id: photo.id,
        xPercent: photo.xPercent,
        yPercent: photo.yPercent,
        w: photo.w || 150,
        h: photo.h || 150,
        z: photo.z
      };
      await store.set('photos', photos);
    }
  }

  board.appendChild(wrap);

  // Click (not drag) → bring this photo to the front
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
  board.innerHTML = '';
  updateClearPhotosBtnState();
  loadedPhotos.forEach(renderPhotoEl);
}

addPhotoBtn.addEventListener('click', () => {
  // Close drawers before opening the file picker
  bookmarksDrawer.classList.remove('open');
  if (typeof bgSettingsDrawer !== 'undefined') bgSettingsDrawer.classList.remove('open');
  photoInput.click();
});

clearPhotosBtn.addEventListener('click', async () => {
  const photos = await store.get('photos', []);
  if (photos.length === 0) return;

  const confirmed = confirm(`Remove all ${photos.length} photo${photos.length === 1 ? '' : 's'} from the board?`);
  if (!confirmed) return;

  // Revoke all URL references
  photoObjectUrls.forEach(url => URL.revokeObjectURL(url));
  photoObjectUrls.clear();

  // Delete all photos from storage
  for (const photo of photos) {
    await largeStore.delete('photo_img_' + photo.id);
  }

  await store.set('photos', []);
  renderBoard();
});

async function addPhotos(files, dropCoords = null) {
  const photos = await store.get('photos', []);
  const existingSnapshot = [...photos];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith('image/')) continue;

    // Detect natural aspect ratio using temporary Object URL
    const { natW, natH } = await new Promise((res) => {
      const img = new Image();
      const tempUrl = URL.createObjectURL(file);
      img.onload = () => {
        res({ natW: img.naturalWidth, natH: img.naturalHeight });
        URL.revokeObjectURL(tempUrl);
      };
      img.onerror = () => {
        res({ natW: 1, natH: 1 });
        URL.revokeObjectURL(tempUrl);
      };
      img.src = tempUrl;
    });

    const MAX_SIDE = 150;
    let w, h;
    if (natW >= natH) {
      w = MAX_SIDE;
      h = Math.round(MAX_SIDE * (natH / natW));
    } else {
      h = MAX_SIDE;
      w = Math.round(MAX_SIDE * (natW / natH));
    }

    let x, y;
    if (dropCoords) {
      const offset = i * 15;
      x = dropCoords.x - w / 2 + offset;
      y = dropCoords.y - h / 2 + offset;
    } else if (existingSnapshot.length > 0) {
      const anchor = existingSnapshot[Math.floor(Math.random() * existingSnapshot.length)];
      const anchorX = (anchor.xPercent || 0.5) * window.innerWidth;
      const anchorY = (anchor.yPercent || 0.5) * window.innerHeight;

      const minOff = 100, maxOff = 200;
      const randOff = () => (minOff + Math.random() * (maxOff - minOff)) * (Math.random() < 0.5 ? 1 : -1);

      x = anchorX + randOff();
      y = anchorY + randOff();
    } else {
      x = window.innerWidth  / 2 - w / 2;
      y = window.innerHeight / 2 - h / 2;
    }

    const margin = 20;
    x = Math.max(margin, Math.min(window.innerWidth  - w - margin, x));
    y = Math.max(margin, Math.min(window.innerHeight - h - margin, y));

    _photoZCounter += 1;
    const photoId = Date.now() + Math.random().toString(36).slice(2);
    
    // Save image to IndexedDB
    await largeStore.set('photo_img_' + photoId, file);

    const photo = {
      id: photoId,
      xPercent: x / window.innerWidth,
      yPercent: y / window.innerHeight,
      w: w,
      h: h,
      z: _photoZCounter,
      caption: ""
    };
    photos.push(photo);
    existingSnapshot.push(photo);
  }

  await store.set('photos', photos);
  renderBoard();
}

photoInput.addEventListener('change', async (e) => {
  const files = [...e.target.files];
  await addPhotos(files);
  photoInput.value = '';
});

// ---------- Document Drag & Drop File Handlers ----------
let dragCounter = 0;
document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  // Bypass document-wide drag overlay if background settings drawer is open
  if (typeof bgSettingsDrawer !== 'undefined' && bgSettingsDrawer.classList.contains('open')) return;
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
  if (typeof bgSettingsDrawer !== 'undefined' && bgSettingsDrawer.classList.contains('open')) return;
  dragCounter--;
  if (dragCounter === 0) {
    document.getElementById('dragOverlay').classList.remove('active');
  }
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  if (typeof bgSettingsDrawer !== 'undefined' && bgSettingsDrawer.classList.contains('open')) return;
  dragCounter = 0;
  document.getElementById('dragOverlay').classList.remove('active');

  const files = [...e.dataTransfer.files];
  if (files.length > 0) {
    const dropCoords = { x: e.clientX, y: e.clientY };
    await addPhotos(files, dropCoords);
  }
});


// ══════════════════════════════════════════════════════════════
// Welcome Overlay — show only on first install
// ══════════════════════════════════════════════════════════════
// ---------- Focus Mode ----------
const clockEl = document.querySelector('.clock');
const dateEl = document.getElementById('date');
const focusNotification = document.getElementById('focusNotification');

let focusTimeout = null;
function showFocusNotification(text) {
  focusNotification.textContent = text;
  focusNotification.classList.add('visible');
  focusTimeout = setTimeout(() => {
    focusNotification.classList.remove('visible');
  }, 1500);
}

async function toggleFocusMode(e) {
  // If it's a double click event, ignore if clicking inside interactive widgets or the timer time
  if (e && e.type === 'dblclick') {
    if (e.target.closest('.photo') || e.target.closest('.right-panel') || e.target.closest('.vertical-toolbar') || e.target.closest('.bookmarks-drawer') || e.target.closest('#bgSettingsDrawer') || e.target.closest('#helpDrawer') || e.target.closest('#timerTime')) return;
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

document.addEventListener('dblclick', toggleFocusMode);

// Keyboard Esc shortcut
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Avoid toggling Focus Mode if user is inside an input field or textarea
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }
    
    // Close drawers first if open
    let drawerClosed = false;
    [bookmarksDrawer, bgSettingsDrawer, helpDrawer].forEach(drawer => {
      if (drawer && drawer.classList.contains('open')) {
        drawer.classList.remove('open');
        drawerClosed = true;
      }
    });
    
    // If we closed a drawer, let Escape close the drawer first (do not toggle focus mode)
    if (drawerClosed) return;
    
    toggleFocusMode();
  }
});

async function initFocusMode() {
  const active = await store.get('focusMode', false);
  if (active) {
    document.body.classList.add('focus-mode');
  }
  await initTimer();
}

// ══════════════════════════════════════════════════════════════
// Focus Countdown Timer with Web Audio Chime & State Syncing
// ══════════════════════════════════════════════════════════════

const timerView = document.getElementById('timerView');
const timerTime = document.getElementById('timerTime');
const timerInput = document.getElementById('timerInput');
const timerDoneBtn = document.getElementById('timerDoneBtn');

let timerInterval = null;
let defaultDurationMin = 25;
let timerState = 'idle'; // 'idle', 'running', 'paused', 'finished'
let timerEndTimestamp = 0;
let timerRemainingMs = 25 * 60 * 1000;
let timerSoundEnabled = true;

// Update keyboard shortcuts guide string visually to show Sound mute state
function updateShortcutsGuideUI() {
  const guide = document.getElementById('timerShortcutsHelp');
  if (!guide) return;
  if (timerSoundEnabled) {
    guide.textContent = "[Space] Play/Pause  •  [R] Reset  •  [M] Mute";
  } else {
    guide.textContent = "[Space] Play/Pause  •  [R] Reset  •  [M] Unmute";
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

// Optical dimness overlay updater based on timer running states
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

function updateTimerDisplay(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  timerTime.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
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

async function initTimer() {
  if (!timerView) return;
  timerSoundEnabled = await store.get('focusTimerSoundEnabled', true);
  updateShortcutsGuideUI();
  
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

// Controls interactions
if (timerTime) {
  timerTime.addEventListener('click', (e) => {
    if (timerState === 'finished') return;
    if (timerView.classList.contains('editing')) return;
    
    if (timerState === 'running') {
      pauseTimer();
    } else {
      // Enter Edit mode if clicked when paused or idle
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
      // Revert input value to the current timer duration in minutes before blurring
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

// Global Spacebar and R Key listener (when not inside inputs)
document.addEventListener('keydown', async (e) => {
  // Only capture keypresses in Focus Mode
  if (!document.body.classList.contains('focus-mode')) return;
  
  // Ignore if inside input/textarea/editable
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
    return;
  }
  
  if (e.key === ' ') {
    e.preventDefault(); // prevent page scroll
    
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

// Sync Timer state across multiple tabs
if (window.chrome && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local') {
      if (changes.focusTimerState || changes.focusTimerDuration || changes.focusTimerEndTimestamp || changes.focusTimerRemaining) {
        await initTimer();
      }
      if (changes.focusTimerSoundEnabled) {
        timerSoundEnabled = changes.focusTimerSoundEnabled.newValue;
        updateShortcutsGuideUI();
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
const ghostGrid = document.getElementById('ghostGrid');

async function loadShortcuts() {
  const defaultShortcuts = [
    { title: "Google", url: "https://google.com" },
    { title: "GitHub", url: "https://github.com" },
    { title: "YouTube", url: "https://youtube.com" }
  ];
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

    item.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.button === 1) {
        return; // default new tab behavior
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
    
    tile.appendChild(img);

    const del = document.createElement('span');
    del.className = 'shortcut-del';
    del.innerHTML = '&times;';
    del.title = 'Delete Shortcut';
    del.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const confirmed = confirm(`Delete shortcut for ${sc.title}?`);
      if (!confirmed) return;
      const current = await store.get('shortcuts', []);
      current.splice(idx, 1);
      await store.set('shortcuts', current);
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
      const title = prompt("Enter shortcut name (max 15 chars):");
      if (!title) return;
      let url = prompt("Enter URL (e.g. google.com):");
      if (!url) return;
      
      url = url.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      
      const current = await store.get('shortcuts', []);
      current.push({ title: title.slice(0, 15), url });
      await store.set('shortcuts', current);
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

// ---------- whiteboard lock ----------
const lockBoardBtn = document.getElementById('lockBoardBtn');
const lockIcon = document.getElementById('lockIcon');
let boardIsLocked = false;

async function applyLockState(locked) {
  boardIsLocked = locked;
  const boardEl = document.getElementById('board');
  if (locked) {
    boardEl.classList.add('board-locked');
    lockBoardBtn.classList.add('active');
    // Closed shackle SVG path
    lockIcon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
  } else {
    boardEl.classList.remove('board-locked');
    lockBoardBtn.classList.remove('active');
    // Open shackle SVG path
    lockIcon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>';
  }
}

async function initLockState() {
  const locked = await store.get('boardLocked', false);
  applyLockState(locked);
}
initLockState();

lockBoardBtn.addEventListener('click', async () => {
  const next = !boardIsLocked;
  applyLockState(next);
  await store.set('boardLocked', next);
});

// ---------- Screen-Wide Background Feature ----------
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

// Toggle background drawer
bgSettingsToggleBtn.addEventListener('click', () => {
  bookmarksDrawer.classList.remove('open');
  bgSettingsDrawer.classList.toggle('open');
});

// Close background drawer
closeBgSettings.addEventListener('click', () => {
  bgSettingsDrawer.classList.remove('open');
});

// Trigger file selection on drop zone click
bgDropZone.addEventListener('click', () => {
  bgFileInput.click();
});

// Handle drop zone file drag and drop events
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

// Handle file input change
bgFileInput.addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (files.length > 0) {
    await processAndSetBackground(files[0]);
  }
  bgFileInput.value = '';
});

// Process image file to data URL and set background
async function processAndSetBackground(file) {
  if (!file.type.startsWith('image/')) return;
  
  // Store the Blob directly in IndexedDB
  await largeStore.set('bgImage', file);
  await store.set('bgImage', 'MIGRATED'); // Sentinel for migration detection
  applyBgImage(file);
}

// Apply background image to container
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
      // Legacy base64 string
      screenBgContainer.style.backgroundImage = `url(${src})`;
    }
    clearBgBtn.removeAttribute('disabled');
  } else {
    screenBgContainer.style.backgroundImage = 'none';
    clearBgBtn.setAttribute('disabled', 'true');
  }
}

// Handle dim/opacity slider
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

// Handle blur slider
bgBlurSlider.addEventListener('input', async (e) => {
  const val = e.target.value;
  bgBlurValue.textContent = `${val}px`;
  screenBgContainer.style.filter = val > 0 ? `blur(${val}px)` : 'none';
});

bgBlurSlider.addEventListener('change', async (e) => {
  await store.set('bgBlur', e.target.value);
});

// Handle clear background button
clearBgBtn.addEventListener('click', async () => {
  const confirmed = confirm('Remove the screen background?');
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

// Initialize background settings from storage
async function initBackground() {
  let src = await store.get('bgImage', null);
  
  if (src === 'MIGRATED') {
    src = await largeStore.get('bgImage', null);
  } else if (src && typeof src === 'string' && src.startsWith('data:')) {
    // Perform migration if we hit base64 string from legacy
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

// Data Migration for Whiteboard Photos and Coordinates on startup
async function migrateLegacyData() {
  const photos = await store.get('photos', []);
  let needsSave = false;
  
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    
    // 1. Migrate image to IndexedDB Blob
    if (photo.src && photo.src.startsWith('data:')) {
      const blob = dataURLtoBlob(photo.src);
      if (blob) {
        await largeStore.set('photo_img_' + photo.id, blob);
        delete photo.src;
        needsSave = true;
      }
    }
    
    // 2. Migrate back from percentages to absolute pixels if needed (MUST run before step 3 to resolve size)
    if (photo.wPercent !== undefined && photo.w === undefined) {
      photo.w = Math.round(photo.wPercent * window.innerWidth);
      photo.h = Math.round(photo.hPercent * window.innerHeight);
      delete photo.wPercent;
      delete photo.hPercent;
      needsSave = true;
    }
    
    // 3. Migrate coordinate pixels to proportional percentages
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

// Startup Initialization sequence
async function startupInit() {
  await migrateLegacyData();
  await initBackground();

  // Clean up legacy tutorial tasks if present in user storage
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
  await initFocusMode();
  await loadShortcuts();
  await renderBoard();
}
startupInit();
