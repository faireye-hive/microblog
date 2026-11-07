/**
 * Persistent cache for public posts and channel feeds.
 *
 * IndexedDB is preferred for large snapshots; legacy localStorage is read once
 * and migrated only after a successful IndexedDB write. No Hive credentials or
 * private user data are stored here.
 */
import { APP_ID } from "../config.js";
import { POSTS_CACHE_KEY, getChannelPostsCacheKey } from "./cache-keys.js";

export const POST_CACHE_DB_NAME = "micro-fair-posts";
export const POST_CACHE_DB_VERSION = 1;
export const POST_CACHE_STORE = "feeds";

export function getLegacyPostCacheKey(namespace) {
  return namespace === APP_ID
    ? POSTS_CACHE_KEY
    : getChannelPostsCacheKey(namespace);
}

function openDatabase(factory) {
  if (!factory || typeof factory.open !== "function") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = factory.open(POST_CACHE_DB_NAME, POST_CACHE_DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(POST_CACHE_STORE)) {
        db.createObjectStore(POST_CACHE_STORE, { keyPath: "namespace" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
  });
}

/** Small IDB driver; injectable for Node tests and alternate browsers. */
export function createIndexedPostStore(factory = globalThis.indexedDB) {
  async function operate(mode, action) {
    const db = await openDatabase(factory);
    try {
      return await new Promise((resolve, reject) => {
        let result;
        let tx;
        try {
          tx = db.transaction(POST_CACHE_STORE, mode);
          const store = tx.objectStore(POST_CACHE_STORE);
          const request = action(store);
          if (request) {
            request.onsuccess = () => { result = request.result; };
            request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
          }
          tx.oncomplete = () => resolve(result);
          tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
          tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
        } catch (error) {
          reject(error);
        }
      });
    } finally {
      db.close();
    }
  }

  return {
    async get(namespace) {
      const record = await operate("readonly", store => store.get(namespace));
      return Array.isArray(record?.posts) ? record.posts : null;
    },
    async put(namespace, posts) {
      await operate("readwrite", store =>
        store.put({ namespace, posts, savedAt: Date.now() })
      );
    },
    async clear() {
      await operate("readwrite", store => store.clear());
    },
  };
}

function readLegacy(storage, key) {
  try {
    const raw = storage?.getItem(key);
    if (raw === null || raw === undefined) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function removeLegacy(storage, key) {
  try { storage?.removeItem(key); } catch { /* Storage can be restricted. */ }
}

function newestTimestamp(posts) {
  let latest = 0;
  for (const p of posts) {
    const time = Date.parse(p?.timestamp || "");
    if (Number.isFinite(time) && time > latest) latest = time;
  }
  return latest;
}

function preferLegacy(legacy, indexed) {
  if (!indexed) return true;
  const a = newestTimestamp(legacy);
  const b = newestTimestamp(indexed);
  return a > b || (a === b && legacy.length > indexed.length);
}

/**
 * Read public feed from IndexedDB and migrate previous localStorage snapshots.
 * When IndexedDB is missing/blocked, return the original localStorage value.
 */
export async function readPostCache(
  namespace,
  { storage = globalThis.localStorage, driver = createIndexedPostStore() } = {}
) {
  const key = getLegacyPostCacheKey(namespace);
  const legacy = readLegacy(storage, key);
  let indexed;
  try {
    indexed = await driver.get(namespace);
  } catch {
    return legacy || [];
  }

  if (legacy !== null && preferLegacy(legacy, indexed)) {
    try {
      await driver.put(namespace, legacy);
      removeLegacy(storage, key);
    } catch {
      // Keep the only durable copy in localStorage when migration fails.
    }
    return legacy;
  }

  if (legacy !== null) removeLegacy(storage, key);
  return indexed || [];
}

/**
 * Write a full snapshot atomically to IndexedDB. Only remove the legacy value
 * after transaction completion; fallback to localStorage if IDB is unavailable.
 */
export async function writePostCache(
  namespace,
  posts,
  { storage = globalThis.localStorage, driver = createIndexedPostStore() } = {}
) {
  const rows = Array.isArray(posts) ? posts : [];
  const key = getLegacyPostCacheKey(namespace);
  try {
    await driver.put(namespace, rows);
    removeLegacy(storage, key);
    return "indexeddb";
  } catch {
    try {
      storage?.setItem(key, JSON.stringify(rows));
      return "localStorage";
    } catch {
      return "unavailable";
    }
  }
}

/** Clear only post snapshots. Auxiliary vote/mute caches are handled by api.js. */
export async function clearPostCaches(
  { storage = globalThis.localStorage, driver = createIndexedPostStore() } = {}
) {
  let indexedCleared = false;
  try {
    await driver.clear();
    indexedCleared = true;
  } catch {
    // Do not claim IndexedDB was cleared if it was blocked.
  }

  try {
    storage?.removeItem(POSTS_CACHE_KEY);
    for (const key of Object.keys(storage || {})) {
      if (key.startsWith("hiveAppChannelPosts_")) storage.removeItem(key);
    }
  } catch { /* Best effort when browser disallows localStorage. */ }
  return indexedCleared;
}
