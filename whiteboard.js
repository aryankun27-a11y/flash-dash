// ---------- Gallery of Goals Whiteboard (Glassmorphic Photo Board) ----------
const board = document.getElementById('board');
const photoInput = document.getElementById('photoInput');
const addPhotoBtn = document.getElementById('addPhotoBtn');
const clearPhotosBtn = document.getElementById('clearPhotosBtn');

let _photoZCounter = 10;
let loadedPhotos = [];
const photoObjectUrls = new Map(); // photoId -> ObjectURL string

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

// ---------- Snap Guide Helpers ----------
const SNAP_THRESHOLD = 12; // proximity in px to trigger snapping
const SNAP_GAP = 16; // gap spacing for side-by-side snapping

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

    // Horizontal snapping
    if (Math.abs(dLeft - o.left) < SNAP_THRESHOLD && snapX === null) { snapX = o.left - dLeft; guideXSet.add(o.left); }
    if (Math.abs(dRight - o.right) < SNAP_THRESHOLD && snapX === null) { snapX = o.right - dRight; guideXSet.add(o.right); }
    if (Math.abs(dLeft - (o.right + SNAP_GAP)) < SNAP_THRESHOLD && snapX === null) { snapX = (o.right + SNAP_GAP) - dLeft; guideXSet.add(o.right + SNAP_GAP); }
    if (Math.abs(dRight - (o.left - SNAP_GAP)) < SNAP_THRESHOLD && snapX === null) { snapX = (o.left - SNAP_GAP) - dRight; guideXSet.add(o.left - SNAP_GAP); }
    if (Math.abs(dLeft - o.right) < SNAP_THRESHOLD && snapX === null) { snapX = o.right - dLeft; guideXSet.add(o.right); }
    if (Math.abs(dRight - o.left) < SNAP_THRESHOLD && snapX === null) { snapX = o.left - dRight; guideXSet.add(o.left); }
    if (Math.abs(dCenterX - oCenterX) < SNAP_THRESHOLD && snapX === null) { snapX = oCenterX - dCenterX; guideXSet.add(oCenterX); }

    // Vertical snapping
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

// Optimized incremental board updates (prevents re-reading all Blobs and allocating URL objects)
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

  // Remove deletions
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

// Canvas image downscaling helper (max 1200px limit on upload, returns blob and dimensions)
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
  const START_X = 100; // Clear left toolbar
  const START_Y = 30;
  const MAX_X = window.innerWidth - 280; // Clear right panel

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

    // Downscale and get size in one unified pass
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

// Document Drag & Drop File Handlers
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

// Expose variables globally
window.renderBoard = renderBoard;
window.addPhotos = addPhotos;
