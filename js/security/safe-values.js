/**
 * Output-context helpers for untrusted public Hive metadata.
 *
 * Keep URL validation separate from HTML encoding: URLs returned here are RAW
 * strings for DOM assignment, and MUST be escaped with escapeAttr before
 * interpolation into an HTML attribute.
 */
export function safeExternalUrl(value) {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw || raw.length > 4096 || /[\u0000-\u0020\u007f-\u009f<>"'`]/.test(raw)) return "";
  if (!/^https?:\/\//i.test(raw)) return "";
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    if (parsed.username || parsed.password || !parsed.hostname) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

/** Conservative normalization for username locations in URLs and attributes. */
export function safeHiveUsername(value) {
  if (typeof value !== "string") return "unknown";
  const name = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{0,23}$/.test(name) ? name : "unknown";
}

export function hiveAvatarUrl(value) {
  return `https://images.hive.blog/u/${encodeURIComponent(safeHiveUsername(value))}/avatar`;
}

/** A tag is not a free-form HTML or URI expression. */
export function safeTag(value) {
  const tag = typeof value === "string" ? value.toLowerCase().trim() : "";
  return /^[a-z0-9][a-z0-9._-]{0,35}$/.test(tag) ? tag : "";
}
