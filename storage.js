// ---------- Concurrency Queue / Mutex to Prevent Race Conditions ----------
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

// ---------- Unified Storage Interface (chrome.storage.local with fallback) ----------
// Determine storage destination (local vs localStorage)
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
  // Mutator helper to serialize read-modify-write cycles
  async mutate(key, fallback, mutatorFn) {
    return storageQueue.enqueue(async () => {
      const current = await this.get(key, fallback);
      const mutated = await mutatorFn(current);
      await this.set(key, mutated);
      return mutated;
    });
  }
};

// ---------- IndexedDB Storage Wrapper for Large Binary Blobs ----------
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

// ---------- Data Converters & Base64 Helpers ----------
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

// Expose elements on the global window object for cross-script scoping
window.store = store;
window.largeStore = largeStore;
window.dataURLtoBlob = dataURLtoBlob;
