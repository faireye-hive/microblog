/**
 * HAFSQL transport and URL handling.
 * No UI, localStorage or Hive Keychain dependencies.
 */
export const HAFSQL_CUSTOM_JSON_ENDPOINT =
  "https://rpc.mahdiyari.info/hafsql/operations/custom_json";

// Preserve the {user} placeholder in config URLs; all other path chars are encoded.
export function buildHafsqlCustomJsonUrl(customId, { limit = 1000, start } = {}) {
  const id = String(customId);
  const path = encodeURIComponent(id).replace(/%7Buser%7D/gi, "{user}");
  const url = `${HAFSQL_CUSTOM_JSON_ENDPOINT}/${path}?limit=${encodeURIComponent(String(limit))}`;
  if (start === undefined || start === null) return url;
  return `${url}&start=${encodeURIComponent(String(start))}`;
}

// Cursor helper used for incremental syncs and backwards pagination.
export function withHafsqlCursor(baseUrl, { limit, start } = {}) {
  const url = new URL(baseUrl);
  if (limit !== undefined) url.searchParams.set("limit", String(limit));
  if (start !== undefined && start !== null) url.searchParams.set("start", String(start));
  return url.toString();
}

export function getHafsqlRows(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.rows) ? data.rows : [];
}

export async function fetchHafsqlPayload(url, fetcher = globalThis.fetch) {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`HAFSQL request failed (HTTP ${response.status})`);
  }
  return response.json();
}
