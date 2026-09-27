/**
 * IndexedDB persistence layer for Skima & Taima application data.
 * Provides resilient, unlimited storage capacity for projects, rosters,
 * logs, and large base64 attachments (CVs, proof docs, logos).
 */

const DB_NAME = 'Skima_Taima_Storage_v1';
const DB_VERSION = 1;
const STORE_APP_DATA = 'app_data';
const STORE_ATTACHMENTS = 'attachments';

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase | null> | null = null;

export function getIDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_APP_DATA)) {
          db.createObjectStore(STORE_APP_DATA);
        }
        if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
          db.createObjectStore(STORE_ATTACHMENTS);
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        resolve(dbInstance);
      };

      request.onerror = () => {
        console.warn('IndexedDB unavailable or blocked in this browser context.');
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB initialization failed:', err);
      resolve(null);
    }
  });

  return dbInitPromise;
}

/**
 * Saves a dataset to IndexedDB asynchronously
 */
export async function saveToIDB<T>(key: string, value: T): Promise<boolean> {
  try {
    const db = await getIDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_APP_DATA, 'readwrite');
        const store = tx.objectStore(STORE_APP_DATA);
        store.put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Retrieves a dataset from IndexedDB asynchronously
 */
export async function getFromIDB<T>(key: string): Promise<T | null> {
  try {
    const db = await getIDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_APP_DATA, 'readonly');
        const store = tx.objectStore(STORE_APP_DATA);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/**
 * Retrieves all stored datasets from IndexedDB for comprehensive data restoration
 */
export async function getAllKeysAndValuesFromIDB(): Promise<Record<string, any>> {
  try {
    const db = await getIDB();
    if (!db) return {};

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_APP_DATA, 'readonly');
        const store = tx.objectStore(STORE_APP_DATA);
        const results: Record<string, any> = {};

        if (store.getAllKeys && store.getAll) {
          const keysReq = store.getAllKeys();
          const valsReq = store.getAll();

          keysReq.onsuccess = () => {
            valsReq.onsuccess = () => {
              const keys = keysReq.result as string[];
              const vals = valsReq.result;
              keys.forEach((k, idx) => {
                results[k] = vals[idx];
              });
              resolve(results);
            };
            valsReq.onerror = () => resolve({});
          };
          keysReq.onerror = () => resolve({});
        } else {
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest).result;
            if (cursor) {
              results[cursor.key as string] = cursor.value;
              cursor.continue();
            } else {
              resolve(results);
            }
          };
          cursorReq.onerror = () => resolve({});
        }
      } catch {
        resolve({});
      }
    });
  } catch {
    return {};
  }
}

/**
 * Removes a key from IndexedDB
 */
export async function deleteFromIDB(key: string): Promise<boolean> {
  try {
    const db = await getIDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_APP_DATA, 'readwrite');
        const store = tx.objectStore(STORE_APP_DATA);
        store.delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Saves large attachments/documents (e.g. Leave proof documents, CVs) to IDB
 */
export async function saveAttachmentToIDB(attachmentId: string, dataUrl: string): Promise<boolean> {
  try {
    const db = await getIDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ATTACHMENTS, 'readwrite');
        const store = tx.objectStore(STORE_ATTACHMENTS);
        store.put(dataUrl, attachmentId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Loads large attachment from IDB
 */
export async function getAttachmentFromIDB(attachmentId: string): Promise<string | null> {
  try {
    const db = await getIDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ATTACHMENTS, 'readonly');
        const store = tx.objectStore(STORE_ATTACHMENTS);
        const req = store.get(attachmentId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}
