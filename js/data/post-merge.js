/**
 * Merge overlapping HAFSQL batches and previous cached posts.
 * An operation ID belongs to a particular custom_json namespace; combine
 * namespace and id to avoid treating two different channels as one post.
 */
export function mergePostSnapshots(fresh = [], cached = [], { limit = 2000 } = {}) {
  const rows = new Map();
  let unidentified = 0;
  for (const post of [...fresh, ...cached]) {
    if (!post || typeof post !== "object") continue;
    const id = post.id;
    const key = id !== null && id !== undefined
      ? `${post.custom_id || ""}:${String(id)}`
      : `__missing_id_${unidentified++}`;
    if (!rows.has(key)) rows.set(key, post); // fresh wins ties
  }
  return Array.from(rows.values())
    .sort((a, b) =>
      (Date.parse(b.timestamp || "") || 0) - (Date.parse(a.timestamp || "") || 0)
    )
    .slice(0, Math.max(0, limit));
}
