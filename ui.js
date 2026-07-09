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

// Horizontal drag helper for Ghost Grid shortcuts reordering
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

// Close drawers if clicking outside of them
document.addEventListener('click', (e) => {
  const bgSettingsDrawer = document.getElementById('bgSettingsDrawer');
  const bgSettingsToggleBtn = document.getElementById('bgSettingsToggleBtn');

  if (bookmarksDrawer && !bookmarksDrawer.contains(e.target) && bookmarksToggle && !bookmarksToggle.contains(e.target)) {
    bookmarksDrawer.classList.remove('open');
  }
  if (bgSettingsDrawer && !bgSettingsDrawer.contains(e.target) && bgSettingsToggleBtn && !bgSettingsToggleBtn.contains(e.target)) {
    bgSettingsDrawer.classList.remove('open');
  }

  // Close ghost grid if clicking outside it and the indicator
  const ghostGrid = document.getElementById('ghostGrid');
  const ghostGridIndicator = document.getElementById('ghostGridIndicator');
  const customModalOverlay = document.getElementById('customModalOverlay');
  if (ghostGrid && !ghostGrid.contains(e.target) && ghostGridIndicator && !ghostGridIndicator.contains(e.target)) {
    if (customModalOverlay && customModalOverlay.contains(e.target)) {
      return;
    }
    ghostGrid.classList.remove('visible');
    ghostGridIndicator.classList.remove('active');
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
    // Fallback mock bookmarks for non-extension environments
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
        return; // default new tab redirection
      }
      e.preventDefault();
      // Drop broad tabs query, navigate directly to destination
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

    // drag handle
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

    // inline double-click editing
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

// ---------- theme ----------
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

// ---------- Ghost Grid Shortcuts ----------
const ghostGrid = document.getElementById('ghostGrid');
const ghostGridIndicator = document.getElementById('ghostGridIndicator');

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

// Click listener to toggle Ghost Grid active states
if (ghostGridIndicator && ghostGrid) {
  ghostGridIndicator.addEventListener('click', (e) => {
    e.stopPropagation();
    ghostGrid.classList.toggle('visible');
    ghostGridIndicator.classList.toggle('active');
  });
}

// Dragover event listener for horizontal reordering on Ghost Grid
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

// ---------- Screen Background Settings ----------
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

// canvas background image downscaling (clamped to max 1600px for backgrounds)
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

  // Downscale background
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



// ---------- Data Migrations ----------
async function migrateLegacyData() {
  const photos = await store.get('photos', []);
  let needsSave = false;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];

    // Migrate to IndexedDB
    if (photo.src && photo.src.startsWith('data:')) {
      const blob = dataURLtoBlob(photo.src);
      if (blob) {
        await largeStore.set('photo_img_' + photo.id, blob);
        delete photo.src;
        needsSave = true;
      }
    }

    // Proportional dimensions conversion
    if (photo.wPercent !== undefined && photo.w === undefined) {
      photo.w = Math.round(photo.wPercent * window.innerWidth);
      photo.h = Math.round(photo.hPercent * window.innerHeight);
      delete photo.wPercent;
      delete photo.hPercent;
      needsSave = true;
    }

    // Coordinate conversion
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

// ---------- Startup Sequence ----------
async function startupInit() {
  await migrateLegacyData();
  await initBackground();

  // Clear tutorial onboarding checks
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

  // Seeding the welcome onboarding checklist overlay if not completed
  const onboardingCompleted = await store.get('onboardingCompleted', false);
  if (!onboardingCompleted) {
    await ModalManager.showWelcomeModal();
    await store.set('onboardingCompleted', true);
  }
}

// Clock tick triggers
function tickClock() {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;

  const hoursEl = document.getElementById('clockHours');
  const minutesEl = document.getElementById('clockMinutes');
  if (hoursEl && minutesEl) {
    hoursEl.textContent = h.toString();
    minutesEl.textContent = m;
  } else {
    const timeSpan = document.getElementById('time');
    if (timeSpan) timeSpan.textContent = `${h}:${m}`;
  }

  const ampmSpan = document.getElementById('ampm');
  if (ampmSpan) ampmSpan.textContent = ampm;

  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const dateEl = document.getElementById('date');
  if (dateEl) dateEl.textContent = dateStr;
}

tickClock();
setInterval(tickClock, 1000);

// Initialize dashboard logic
startupInit();
