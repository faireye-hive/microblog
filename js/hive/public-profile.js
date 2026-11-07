/**
 * Public Hive account metadata via the same RPC origin already authorized by
 * Micro.fair's Content Security Policy. No signing, keys or user data is sent.
 * A failed RPC request must not prevent rendering locally cached posts.
 */
import { safeExternalUrl, safeHiveUsername } from "../security/safe-values.js";

export const HIVE_PUBLIC_PROFILE_RPC = "https://rpc.mahdiyari.info";
const CACHE_MS = 5 * 60 * 1000;
const profileCache = new Map();
const inFlight = new Map();

function readProfileMetadata(value) {
  if (typeof value === "object" && value && !Array.isArray(value)) {
    return typeof value.profile === "object" && value.profile && !Array.isArray(value.profile)
      ? value.profile : {};
  }
  if (typeof value !== "string" || value.length > 25000) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed?.profile === "object" && parsed.profile && !Array.isArray(parsed.profile)
      ? parsed.profile : {};
  } catch { return {}; }
}
function textField(value, limit = 300) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}
function profileWebsite(value) {
  const raw = textField(value, 350);
  if (!raw) return "";
  const proposed = /^https?:\/\//i.test(raw) ? raw : (
    /^[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?$/i.test(raw) ? "https://" + raw : ""
  );
  return proposed ? safeExternalUrl(proposed) : "";
}
export function normalizePublicHiveAccount(account, expectedUser) {
  const username = safeHiveUsername(expectedUser);
  if (username === "unknown" || !account || safeHiveUsername(account.name) !== username)
    return null;
  const base = readProfileMetadata(account.json_metadata);
  const posting = readProfileMetadata(account.posting_json_metadata);
  const profile = { ...base, ...posting };
  const rawImage = textField(profile.profile_image, 4096);
  const rawCover = textField(profile.cover_image, 4096);
  return {
    username,
    displayName: textField(profile.name, 70),
    about: textField(profile.about, 700),
    location: textField(profile.location, 90),
    website: profileWebsite(profile.website),
    profileImage: safeExternalUrl(rawImage),
    coverImage: safeExternalUrl(rawCover),
    joined: typeof account.created === "string" && /^\d{4}-\d{2}-\d{2}T/.test(account.created)
      ? account.created : "",
    confirmedOnChain: true
  };
}

/**
 * Returns {status:'found'|'not-found'|'unavailable'|'invalid', profile?}.
 * Only a successful RPC response with an empty result proves not-found.
 */
export async function fetchPublicHiveAccount(user, options = {}) {
  const username = safeHiveUsername(user);
  if (username === "unknown") return { status:"invalid", profile:null };
  const now = Date.now();
  const cached = profileCache.get(username);
  if (!options.force && cached && now - cached.at < CACHE_MS) return cached.result;
  if (inFlight.has(username)) return inFlight.get(username);

  const worker = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    try {
      const response = await (options.fetchImpl || globalThis.fetch)(HIVE_PUBLIC_PROFILE_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        referrerPolicy: "no-referrer",
        credentials: "omit",
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "condenser_api.get_accounts",
          params: [[username]],
          id: 1
        })
      });
      if (!response.ok) throw new Error("Hive RPC HTTP " + response.status);
      const data = await response.json();
      if (data?.error || !Array.isArray(data?.result))
        throw new Error("Unexpected Hive RPC response");
      const record = data.result.find(row => safeHiveUsername(row?.name) === username);
      const profile = normalizePublicHiveAccount(record, username);
      const result = profile
        ? { status:"found", profile }
        : { status:"not-found", profile:null };
      profileCache.set(username, {at:Date.now(), result});
      return result;
    } catch {
      return { status:"unavailable", profile:null };
    } finally {
      clearTimeout(timer);
    }
  })();

  inFlight.set(username, worker);
  try { return await worker; }
  finally { inFlight.delete(username); }
}
