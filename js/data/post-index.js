/**
 * Reusable indexes for public Hive custom_json posts.
 *
 * Building the maps costs O(n); a post lookup and direct reply count then cost
 * O(1). References are weakly cached so old feed arrays can be garbage collected.
 */
import { parseEmbeddedJson } from "../utils.js";

const indexes = new WeakMap();

export function postKey(id) {
  return id === undefined || id === null ? null : String(id);
}

export function getPostIndex(posts) {
  if (!Array.isArray(posts)) {
    return { byId: new Map(), repliesByParent: new Map(), replyCounts: new Map() };
  }

  const existing = indexes.get(posts);
  if (
    existing &&
    existing.length === posts.length &&
    existing.first === posts[0] &&
    existing.last === posts[posts.length - 1]
  ) {
    return existing;
  }

  const byId = new Map();
  const repliesByParent = new Map();
  const replyCounts = new Map();

  for (const post of posts) {
    if (!post || typeof post !== "object") continue;
    const id = postKey(post.id);
    if (id !== null && !byId.has(id)) byId.set(id, post);

    const parsed = parseEmbeddedJson(post.json);
    const replyTo = parsed?.reply_to;
    // Keep legacy semantics: absent or falsy reply_to denotes a root post.
    if (!replyTo) continue;

    const parentKey = postKey(replyTo);
    if (parentKey === null) continue;
    if (!repliesByParent.has(parentKey)) repliesByParent.set(parentKey, []);
    repliesByParent.get(parentKey).push(post);
    replyCounts.set(parentKey, (replyCounts.get(parentKey) || 0) + 1);
  }

  const result = {
    byId, repliesByParent, replyCounts,
    length: posts.length, first: posts[0], last: posts[posts.length - 1]
  };
  indexes.set(posts, result);
  return result;
}

export function getPostById(posts, id) {
  return getPostIndex(posts).byId.get(postKey(id));
}

export function getDirectReplies(posts, parentId) {
  return getPostIndex(posts).repliesByParent.get(postKey(parentId)) || [];
}

export function countDirectReplies(posts, parentId) {
  return getPostIndex(posts).replyCounts.get(postKey(parentId)) || 0;
}

/** Needed when a caller edits a post in place without changing array length. */
export function invalidatePostIndex(posts) {
  if (Array.isArray(posts)) indexes.delete(posts);
}
