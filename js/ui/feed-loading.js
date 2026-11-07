/**
 * Lightweight feed loading placeholders.
 * Keep existing posts on screen while syncing; show placeholders only on
 * initially empty views. No untrusted data or external assets are inserted.
 */

export function buildFeedSkeletonHTML(count = 3) {
  const size = Number.isFinite(count) ? Math.max(1, Math.min(4, Math.trunc(count))) : 3;
  const cards = Array.from({length:size}, (_, index) => `
    <article class="feed-skeleton-card" aria-hidden="true">
      <div class="feed-skeleton-avatar skeleton-shine"></div>
      <div class="feed-skeleton-content">
        <div class="feed-skeleton-heading">
          <div class="feed-skeleton-name skeleton-shine"></div>
          <div class="feed-skeleton-time skeleton-shine"></div>
        </div>
        <div class="feed-skeleton-line skeleton-shine"></div>
        <div class="feed-skeleton-line feed-skeleton-line-wide skeleton-shine"></div>
        <div class="feed-skeleton-line feed-skeleton-line-short skeleton-shine"></div>
        ${index === 1 ? '<div class="feed-skeleton-media skeleton-shine"></div>' : ''}
        <div class="feed-skeleton-actions">
          <span class="skeleton-shine"></span>
          <span class="skeleton-shine"></span>
          <span class="skeleton-shine"></span>
        </div>
      </div>
    </article>
  `).join("");

  return `
    <div class="feed-skeletons" role="status" aria-label="Loading posts" aria-live="polite">
      <span class="visually-hidden">Loading posts…</span>
      ${cards}
    </div>
  `;
}

export function showFeedSkeleton(feed) {
  if (!feed) return false;
  if (feed.querySelector(".feed-skeletons")) return true;
  // Refreshes must not clear a real feed, profile, directory or empty state.
  if (feed.querySelector(".post-card, .conversation-panel, .community-empty-state, .profile-page, .channels-page, .feature-empty-state")) {
    return false;
  }
  feed.innerHTML = buildFeedSkeletonHTML();
  feed.setAttribute("aria-busy", "true");
  return true;
}

export function hideFeedSkeleton(feed) {
  if (!feed) return;
  feed.querySelector(".feed-skeletons")?.remove();
  feed.removeAttribute("aria-busy");
}
