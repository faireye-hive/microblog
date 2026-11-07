/**
 * Synchronization and pagination of HAFSQL custom_json operations.
 * Stateless except for injected storage; no DOM, Keychain, or UI dependencies.
 *
 * Cache keys and order of operations remain unchanged for existing installs.
 */
import { withHafsqlCursor, fetchHafsqlPayload, getHafsqlRows } from "./hafsql.js";
import { getUserCacheKey } from "./cache-keys.js";

export const PAGE_SIZE = 1000;
export const MAX_OPERATIONS = 20000;
export const MAX_AUX_CACHE_RECORDS = 20000;

/**
 * Load previous auxiliary operations and fetch fresh ones (limit=-1000).
 * Gracefully returns last cached content when transport/storage fails.
 */
export async function syncAuxiliaryData(
  cacheKey,
  apiUrl,
  {
    storage = globalThis.localStorage,
    load = fetchHafsqlPayload,
    logger = console,
  } = {}
) {
  let cachedData = [];
  let startIdForSync = null;

  try {
    const cachedJson = storage.getItem(cacheKey);
    if (cachedJson) {
      const parsed = JSON.parse(cachedJson);
      cachedData = Array.isArray(parsed) ? parsed : [];
      if (cachedData.length > 0) startIdForSync = cachedData[0].id;
    }
  } catch (error) {
    logger.error(`Erro ao carregar cache ${cacheKey}:`, error);
  }

  let updated = [...cachedData];
  const syncUrl = startIdForSync !== null && startIdForSync !== undefined
    ? withHafsqlCursor(apiUrl, { limit: -PAGE_SIZE, start: startIdForSync })
    : apiUrl;

  try {
    const fresh = getHafsqlRows(await load(syncUrl));
    if (fresh.length > 0) {
      // Keep legacy ordering and max size. Deduplication will be a separate change.
      updated = fresh.concat(cachedData).slice(0, MAX_AUX_CACHE_RECORDS);
      storage.setItem(cacheKey, JSON.stringify(updated));
    } else if (startIdForSync === null || startIdForSync === undefined) {
      storage.setItem(cacheKey, JSON.stringify([]));
    }
  } catch (error) {
    logger.error(`Erro ao sincronizar dados auxiliares para ${cacheKey}:`, error);
  }
  return updated;
}

/** User-scoped follow/block operation cache (never mix user identities). */
export async function syncUserTargetOps(
  baseCacheKey,
  urlTemplate,
  username,
  options = {}
) {
  if (!username) return [];
  const userCacheKey = getUserCacheKey(baseCacheKey, username);
  const apiUrl = urlTemplate.replace("{user}", username);
  return syncAuxiliaryData(userCacheKey, apiUrl, options);
}

/**
 * Read the historical pages (newest to oldest), with a hard cap of operations.
 * Network failure still rejects so the caller can decide whether to use cache.
 */
export async function fetchPaginatedOperations(
  baseUrl,
  {
    pageSize = PAGE_SIZE,
    maxOperations = MAX_OPERATIONS,
    load = fetchHafsqlPayload,
    delayMs = 50,
    pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
  } = {}
) {
  let startId = null;
  const allRows = [];
  let hasMore;

  do {
    const url = startId === null
      ? baseUrl
      : withHafsqlCursor(baseUrl, { limit: pageSize, start: startId });

    const rows = getHafsqlRows(await load(url));
    allRows.push(...rows);
    if (rows.length > 0) startId = rows[rows.length - 1].id;

    hasMore = rows.length === pageSize && allRows.length < maxOperations;
    if (hasMore) await pause(delayMs);
  } while (hasMore);

  return allRows;
}
