// /js/render.js
import { parseEmbeddedJson, escapeHtml, escapeAttr, stripMarkdown, extractImages, fmtDate, linkifyText } from "./utils.js";
import { safeExternalUrl, safeHiveUsername, hiveAvatarUrl, safeTag } from "./security/safe-values.js";
import { proxiedImageUrl } from "./security/media-url.js";
import { parseChannelCustomId } from "./helpers/channel-id.js";
import { getPostById, getDirectReplies, countDirectReplies } from "./data/post-index.js";
import { 
  loggedInUser, 
  mutedPostIds, 
  blockedUsers, 
  followedUsers, 
  bookmarkedPostIds,
  channels,
  joinedChannels,
  getChannelPostCount,
  getChannelIcon,
  toggleJoinChannel
} from "./state.js";
import { ADMIN } from "./config.js";

function extractFirstUrl(text) {
  const match = text.match(/https?:\/\/[^\s<>"')]+/i);
  return match ? match[0] : null;
}

function getDomain(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.hostname;
  } catch (e) {
    return urlStr;
  }
}

// Popover do Autor
function buildUserPopover(author, isBlocked, postId) {
  if (!loggedInUser || author === loggedInUser) return "";

  const isFollowing = followedUsers.has(author);
  const followText = isFollowing ? "Unfollow" : "Follow";
  const followType = isFollowing ? "unfollow" : "follow";
  const blockText = isBlocked ? "Unblock" : "Block";
  const blockType = isBlocked ? "unblock" : "block";

  return `
    <div id="author-popover-${escapeAttr(postId)}" data-author="${escapeAttr(author)}"
         class="user-popover-menu hidden" aria-label="Actions for @${escapeAttr(author)}">
      <span class="author-popover-label">ACCOUNT ACTIONS</span>
      <a href="#/user/${encodeURIComponent(author)}" class="dropdown-link author-popover-view">View profile</a>
      <button type="button" data-action="${followType}" data-user="${escapeAttr(author)}"
              class="dropdown-link author-popover-follow">${followText}</button>
      <button type="button" data-action="${blockType}" data-user="${escapeAttr(author)}"
              class="dropdown-link author-popover-block">${blockText}</button>
    </div>
  `;
}

export function buildRepliesRecursive(parentId, allPosts, depth = 1, seen = new Set()) {
  // A malformed custom_json can point back to itself; never recurse in cycles.
  const key = String(parentId);
  if (seen.has(key)) return "";
  const replies = getDirectReplies(allPosts, parentId);
  if (replies.length === 0) return "";
  seen.add(key);
  const html = replies
    .map((r) => {
      const author = safeHiveUsername(r.required_posting_auths?.[0]);
      const rj = parseEmbeddedJson(r.json);
      const nestedHTML = buildRepliesRecursive(r.id, allPosts, depth + 1, seen);
      const replyContentHtml = linkifyText(escapeHtml(typeof rj?.content === "string" ? rj.content : "")).replace(/\n/g, "<br>");
      return `
        <div class="reply-thread-item" data-depth="${Math.min(depth, 6)}">
          <div class="reply-heading">
            <span class="reply-mini-avatar" aria-hidden="true">@</span>
            <a href="#/user/${encodeURIComponent(author)}" class="reply-author reply-profile-link">@${escapeHtml(author)}</a>
            <time class="reply-time" datetime="${escapeAttr(r.timestamp || "")}">${fmtDate(r.timestamp)}</time>
          </div>
          <div class="reply-body">${replyContentHtml}</div>
          <button type="button" class="reply-inline-action reply-btn"
                  data-id="${escapeAttr(r.id)}" aria-label="Reply to @${escapeAttr(author)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="m10 8-5 4 5 4M5 12h9a5 5 0 0 1 5 5"/>
            </svg>
            Reply
          </button>
          ${nestedHTML}
        </div>`;
    })
    .join("");
  seen.delete(key);
  return html;
}

export function buildThreadAbove(post, allPosts) {
  const parsed = parseEmbeddedJson(post.json);
  if (!parsed?.reply_to) return ""; 
  const parent = getPostById(allPosts, parsed.reply_to);
  if (!parent) return ""; 
  const pj = parseEmbeddedJson(parent.json);
  const author = safeHiveUsername(parent.required_posting_auths?.[0]);

  const maxSlice = 120;
  const originalContent = typeof pj?.content === "string" ? pj.content : "";
  const snippetText = originalContent.slice(0, maxSlice);
  const ellipsis = originalContent.length > maxSlice ? '...' : ''; 
  const contentHtml = linkifyText(escapeHtml(snippetText)).replace(/\n/g, "<br>");
  
  return `
    <div class="post-parent-context">
      <span class="post-context-mark" aria-hidden="true">↳</span>
      <div class="post-context-content">
        <button type="button" class="view-thread post-context-author" data-id="${escapeAttr(parent.id)}">
          In reply to @${escapeHtml(author)}
        </button>
        <span class="post-context-snippet">${contentHtml}${escapeHtml(ellipsis)}</span>
      </div>
    </div>`;

}

export function buildPostCard(p, allPosts, voteCounts = {}, mutedPostMap = new Map()) {
  const author = safeHiveUsername(p.required_posting_auths?.[0]);
  const parsed = parseEmbeddedJson(p.json);

  const rawContent = typeof parsed?.content === "string" ? parsed.content : ""; 
  let text = stripMarkdown(rawContent);
  const imgs = extractImages(rawContent); 

  if (imgs.length === 1 && text.trim() === imgs[0]) {
    text = ''; 
  }

  // Tags extraídas
  const tags = Array.isArray(parsed?.tags) ? parsed.tags : [];
  const tagMatches = rawContent.match(/#([a-zA-Z0-9_\-]+)/g) || [];
  const allTagNames = [...tags, ...tagMatches.map(t => t.replace('#', ''))];
  const primaryTag = allTagNames.map(safeTag).find(Boolean) || "hive";

  // URL para preview card
  const firstUrl = safeExternalUrl(extractFirstUrl(rawContent));

  const replyCount = countDirectReplies(allPosts, p.id);

  const votes = voteCounts[p.id] || { upvote: 0, downvote: 0 };
  const upvoteCount = votes.upvote;
  const downvoteCount = votes.downvote;
  
  const muteInfo = mutedPostMap.get(p.id);
  const isMuted = !!muteInfo;
  const muteCause = muteInfo ? escapeHtml(muteInfo.cause) : '';
  const muteAdmin = escapeHtml(muteInfo ? muteInfo.admin : 'Admin');
  const isAdmin = loggedInUser === ADMIN;
  const isBlocked = blockedUsers.has(author);
  const isBookmarked = bookmarkedPostIds?.has(p.id);

  if (!isAdmin && isBlocked) {
    return document.createElement('div');
  }

  let muteBannerHTML = "";
  if (isMuted) {
    muteBannerHTML = `
      <aside class="post-moderation-note">
        <strong>Post muted</strong>
        <span>by @${muteAdmin}</span>
        <p>${muteCause}</p>
      </aside>
    `;
  }

  // Card element
  const el = document.createElement("article");
  el.className = `post-card card ${isMuted ? 'opacity-70' : ''}`; 
  el.setAttribute('data-id', p.id);

  // A short first line is presented as a headline only once.
  let headlineHtml = "";
  let bodyText = text;
  const lines = text.split("\n").filter(line => line.trim().length > 0);
  if (lines.length > 1 && lines[0].length < 80) {
    headlineHtml = `<h4 class="post-headline">${escapeHtml(lines[0])}</h4>`;
    bodyText = text.slice(text.indexOf(lines[0]) + lines[0].length).trimStart();
  }
  const mainContentHtml = linkifyText(escapeHtml(bodyText)).replace(/\n/g, "<br>");

  // Use verified link data only. No unrelated stock images or fabricated previews.
  let previewBoxHtml = "";
  if (firstUrl && !imgs.includes(firstUrl)) {
    const domain = getDomain(firstUrl);
    previewBoxHtml = `
      <a href="${escapeAttr(firstUrl)}" target="_blank" rel="noopener noreferrer"
         class="preview-box post-external-link" aria-label="Open link on ${escapeAttr(domain)} in a new tab">
        <span class="post-external-symbol" aria-hidden="true">
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 4h6v6M20 4l-9 9"/>
            <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>
          </svg>
        </span>
        <span class="post-external-content">
          <span class="post-external-eyebrow">EXTERNAL LINK</span>
          <strong class="post-external-domain">${escapeHtml(domain)}</strong>
          <span class="post-external-url">${escapeHtml(firstUrl)}</span>
        </span>
        <span class="post-external-arrow" aria-hidden="true">↗</span>
      </a>
    `;
  }

  // Image controls are native buttons, so mobile and keyboard users can expand them.
  let imagesHtml = "";
  if (imgs.length) {
    imagesHtml = `
      <div class="post-image-grid ${imgs.length === 1 ? "post-image-grid-single" : "post-image-grid-multi"}">
        ${imgs.map((url, index) => `
          <button type="button" class="post-image-trigger"
                  aria-label="Open image ${index + 1} of ${imgs.length}">
            <img src="${escapeAttr(proxiedImageUrl(url))}"
                 class="post-inline-image post-image"
                 data-full-src="${escapeAttr(proxiedImageUrl(url))}"
                 loading="lazy" alt="Post attachment ${index + 1}">
          </button>
        `).join("")}
      </div>
    `;
  }

  el.innerHTML = `
    <!-- User Avatar, linked to a real, shareable public profile. -->
    <a href="#/user/${encodeURIComponent(author)}" class="post-avatar-link"
       aria-label="View @${escapeAttr(author)}'s profile">
      <img src="${escapeAttr(proxiedImageUrl(hiveAvatarUrl(author)))}"
           alt="" class="post-card-avatar post-avatar" data-avatar-fallback="user">
    </a>

    <!-- Post Main Content -->
    <div class="post-card-main post-content">
      <div class="post-card-header post-meta">
        <div class="post-author-row">
          <a href="#/user/${encodeURIComponent(author)}"
             class="post-author-name author-profile-link">@${escapeHtml(author)}</a>
          <time class="post-timestamp" datetime="${escapeAttr(p.timestamp || "")}">${fmtDate(p.timestamp)}</time>
          ${isMuted ? '<span class="post-muted-chip">Muted</span>' : ""}
          ${loggedInUser && author !== loggedInUser ? `
            <button type="button" class="author-menu-toggle author-name"
                    data-author="${escapeAttr(author)}"
                    aria-label="More actions for @${escapeAttr(author)}"
                    aria-expanded="false" aria-controls="author-popover-${escapeAttr(p.id)}"
                    aria-haspopup="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
              </svg>
            </button>
          ` : ""}
          ${buildUserPopover(author, isBlocked, p.id)}
        </div>
        <a href="#/tag/${encodeURIComponent(primaryTag)}"
           class="post-tag-badge tag-link" data-tag="${escapeAttr(primaryTag)}">
          <span>#${escapeHtml(primaryTag)}</span>
        </a>
      </div>

      ${parsed?.reply_to ? buildThreadAbove(p, allPosts) : ""}
      ${muteBannerHTML}

      ${headlineHtml}
      <div class="post-text post-body">${mainContentHtml}</div>

      ${previewBoxHtml}
      ${imagesHtml}

      <!-- Clear groups: votes and conversation first, save/share to the right. -->
      <div class="post-actions-row post-actions" role="group" aria-label="Post actions">
        <div class="post-actions-primary">
          <div class="post-vote-group" role="group" aria-label="Vote on this post">
            <button type="button" class="post-action-btn vote-btn upvote-btn"
                    data-id="${escapeAttr(p.id)}" data-vote="upvote"
                    title="Upvote" aria-label="Upvote: ${upvoteCount} votes">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m7 14 5-5 5 5"/>
              </svg>
              <span>${upvoteCount}</span>
            </button>
            <span class="post-vote-divider" aria-hidden="true"></span>
            <button type="button" class="post-action-btn vote-btn downvote-btn"
                    data-id="${escapeAttr(p.id)}" data-vote="downvote"
                    title="Downvote" aria-label="Downvote: ${downvoteCount} votes">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m17 10-5 5-5-5"/>
              </svg>
              <span>${downvoteCount}</span>
            </button>
          </div>
          <button type="button" class="post-action-btn thread-btn"
                  data-id="${escapeAttr(p.id)}"
                  title="View replies" aria-label="View replies: ${replyCount}"
                  aria-expanded="false" aria-controls="thread-${escapeAttr(p.id)}">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 11.5c0 4.2-3.6 7.5-8 7.5-1.1 0-2.1-.2-3-.5L4 20l1.5-4C4.5 14.8 4 13.2 4 11.5 4 7.4 7.6 4 12 4s8 3.4 8 7.5z"/>
            </svg>
            <span>${replyCount}</span>
          </button>
          <button type="button" class="post-action-btn reply-btn post-reply-cta"
                  data-id="${escapeAttr(p.id)}" title="Write a reply">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m9 9-5 4 5 4M4 13h10a5 5 0 0 1 5 5"/>
            </svg>
            <span>Reply</span>
          </button>
        </div>
        <div class="post-actions-secondary">
          <button type="button" class="post-action-btn bookmark-btn ${isBookmarked ? "bookmarked" : ""}"
                  data-id="${escapeAttr(p.id)}" title="${isBookmarked ? "Remove bookmark" : "Save post"}"
                  aria-label="${isBookmarked ? "Remove bookmark" : "Save post"}"
                  aria-pressed="${Boolean(isBookmarked)}">
            <svg width="18" height="18" viewBox="0 0 24 24"
                 fill="${isBookmarked ? "currentColor" : "none"}" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v19l-6-4-6 4z"/>
            </svg>
          </button>
          ${/^\d+$/.test(String(p.id)) ? `
            <button type="button" class="post-action-btn post-share-btn"
                    data-id="${escapeAttr(p.id)}" title="Share post" aria-label="Share post">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 16V3m-4 4 4-4 4 4"/>
                <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>
              </svg>
            </button>
          ` : ""}
          ${isAdmin ? `
            <button type="button" class="post-action-btn mute-btn"
                    data-id="${escapeAttr(p.id)}" data-type="${isMuted ? "unmute" : "mute"}"
                    title="${isMuted ? "Unmute post" : "Mute post"}">
              ${isMuted ? "Unmute" : "Mute"}
            </button>
          ` : ""}
        </div>
      </div>

      <!-- Thread Container -->
      <div class="thread hidden thread-container" id="thread-${escapeAttr(p.id)}"></div>
    </div>
  `;

  return el;
}


function buildUserListHTML(usersSet, type) {
  const blocked = type === "blocked";
  const users = Array.from(usersSet).map(safeHiveUsername)
    .filter(user => user !== "unknown").sort();

  if (!users.length) {
    return `
      <div class="profile-list-empty">
        <span class="profile-list-empty-icon" aria-hidden="true">
          ${blocked ? "✓" : "＋"}
        </span>
        <strong>${blocked ? "No blocked accounts" : "You're not following anyone yet"}</strong>
        <p>${blocked
          ? "Accounts you block will appear here."
          : "Explore conversations and follow people you want to hear from."}</p>
      </div>
    `;
  }

  return users.map(user => `
    <div class="profile-person-row">
      <a class="profile-person-main" href="#/user/${encodeURIComponent(user)}">
        <img src="${escapeAttr(proxiedImageUrl(hiveAvatarUrl(user)))}"
             alt="" class="profile-person-avatar" loading="lazy"
             data-avatar-fallback="user">
        <span class="profile-person-name">@${escapeHtml(user)}</span>
      </a>
      ${blocked ? `<button type="button" data-action="unblock"
        data-user="${escapeAttr(user)}" class="profile-unblock-btn">Unblock</button>` : ""}
    </div>
  `).join("");
}

export function buildProfilePage() {
  if (!loggedInUser) {
    return `
      <section class="profile-page profile-guest">
        <div class="profile-guest-icon" aria-hidden="true">
          <svg width="33" height="33" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>
          </svg>
        </div>
        <span class="profile-eyebrow">YOUR SPACE ON HIVE</span>
        <h2>Your profile starts here</h2>
        <p>Sign in with Hive Keychain to manage your follows and preferences.</p>
        <button type="button" id="btnProfileLogin" class="btn-post profile-primary-action">Sign in with Keychain
          <span aria-hidden="true">→</span>
        </button>
        <span class="profile-guest-footnote">Authentication is handled securely by the Hive Keychain extension.</span>
      </section>
    `;
  }

  const profileUser = safeHiveUsername(loggedInUser);
  // Keep visible list counters consistent with the validated accounts shown.
  const followedCount = [...followedUsers].filter(name => safeHiveUsername(name) !== "unknown").length;
  const blockedCount = [...blockedUsers].filter(name => safeHiveUsername(name) !== "unknown").length;
  const followedListHtml = buildUserListHTML(followedUsers, "followed");
  const blockedListHtml = buildUserListHTML(blockedUsers, "blocked");

  return `
    <div class="profile-page">
      <section class="profile-hero" aria-labelledby="profileUsername">
        <div class="profile-hero-content">
          <img src="${escapeAttr(proxiedImageUrl(hiveAvatarUrl(profileUser)))}"
               alt="Profile avatar for @${escapeAttr(profileUser)}" class="profile-hero-avatar"
               data-avatar-fallback="user">
          <div class="profile-identity">
            <span class="profile-eyebrow">MY PROFILE</span>
            <h1 id="profileUsername">@${escapeHtml(profileUser)}</h1>
            <span class="profile-connected">
              <span class="profile-status-dot" aria-hidden="true"></span>
              Connected with Hive Keychain
            </span>
          </div>
        </div>
        <div class="profile-own-actions">
          <a href="#/user/${encodeURIComponent(profileUser)}" class="profile-public-link">
            View public profile <span aria-hidden="true">↗</span>
          </a>
        <button type="button" id="btnProfileLogout" class="profile-logout-btn">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/>
            <path d="M9 12h10m-4-4 4 4-4 4"/>
          </svg>
          Sign out
        </button>
        </div>
      </section>

      <div class="profile-summary" aria-label="Account connections">
        <div class="profile-stat">
          <strong>${followedCount}</strong>
          <span>Following</span>
        </div>
        <span class="profile-summary-divider" aria-hidden="true"></span>
        <div class="profile-stat">
          <strong>${blockedCount}</strong>
          <span>Blocked</span>
        </div>
      </div>

      <div class="profile-panels">
        <section class="profile-panel" aria-labelledby="profileFollowingTitle">
          <div class="profile-panel-head">
            <div>
              <span class="profile-panel-kicker">CONNECTIONS</span>
              <h2 id="profileFollowingTitle">People you follow</h2>
            </div>
            <span class="profile-count-badge">${followedCount}</span>
          </div>
          <div id="followedUsersList" class="profile-people-list">
            ${followedListHtml}
          </div>
        </section>

        <section class="profile-panel" aria-labelledby="profileBlockedTitle">
          <div class="profile-panel-head">
            <div>
              <span class="profile-panel-kicker">PRIVACY</span>
              <h2 id="profileBlockedTitle">Blocked accounts</h2>
            </div>
            <span class="profile-count-badge">${blockedCount}</span>
          </div>
          <p class="profile-panel-description">Posts from blocked accounts are hidden from your feed.</p>
          <div id="blockedUsersList" class="profile-people-list">
            ${blockedListHtml}
          </div>
        </section>
      </div>
    </div>
  `;
}

// Community directory: layout simplificado, sem placeholders de canais fictícios.
export function buildChannelsPage(searchFilter = "", scope = "all") {
  const query = (searchFilter || "").toLowerCase().trim();
  const directId = parseChannelCustomId(query.replace(/^#/, ""));
  const filtered = channels.filter(channel => {
    if (scope === "joined" && !joinedChannels.has(channel.id)) return false;
    if (!query) return true;
    return channel.id.toLowerCase().includes(query) ||
      (channel.name && channel.name.toLowerCase().includes(query)) ||
      (channel.description && channel.description.toLowerCase().includes(query)) ||
      (channel.creator && channel.creator.toLowerCase().includes(query));
  });

  const cardsHtml = filtered.map(channel => {
    const isJoined = joinedChannels.has(channel.id);
    const icon = getChannelIcon(channel.id);
    const count = getChannelPostCount(channel.id);
    const creator = safeHiveUsername(channel.creator);
    const path = `#/channel/${encodeURIComponent(channel.id)}`;

    return `
      <article class="channel-tile">
        <div class="channel-tile-top">
          <span class="channel-tile-icon" aria-hidden="true">${escapeHtml(icon)}</span>
          <button type="button" class="btn-join channel-follow ${isJoined ? "joined" : ""}"
                  data-channel="${escapeAttr(channel.id)}">
            ${isJoined ? "Joined" : "Join"}
          </button>
        </div>
        <div class="channel-tile-main">
          <a href="${escapeAttr(path)}" class="channel-tile-title">${escapeHtml(channel.name || channel.id)}</a>
          <span class="channel-tile-tag">#${escapeHtml(channel.id)}</span>
          <p class="channel-tile-description">${escapeHtml(channel.description || "A public space for conversations on Hive.")}</p>
        </div>
        <div class="channel-tile-meta">
          <span>${creator === "unknown" ? "Hive community" : `Created by @${escapeHtml(creator)}`}</span>
          <span>${count} ${count === 1 ? "post" : "posts"}</span>
        </div>
        <div class="channel-tile-actions">
          <a href="${escapeAttr(path)}" class="btn-outline-small channel-open-btn">Explore</a>
          <button type="button" class="btn-post btn-post-in-channel" data-channel="${escapeAttr(channel.id)}">Post</button>
        </div>
      </article>
    `;
  }).join("");

  return `
    <section class="channels-page" aria-label="Community directory">
      <div class="channels-hero">
        <div class="channels-hero-top">
          <div>
            <span class="channels-eyebrow">COMMUNITIES ON HIVE</span>
            <h1>Find your people <span class="channels-total">${channels.length}</span></h1>
            <p>Find conversations you care about and join communities built around your interests.</p>
          </div>
          <button id="btnCreateChannelFromPage" type="button" class="btn-post channels-create-btn">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            Create community
          </button>
        </div>
        <div class="channels-search">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>
          </svg>
          <input type="search" id="channelsDirectorySearch" class="channels-search-input"
                 placeholder="Search by name, tag or creator" aria-label="Search communities"
                 value="${escapeAttr(searchFilter)}" autocomplete="off" spellcheck="false">
        </div>
      </div>

      <div class="channels-directory-toolbar" role="group" aria-label="Filter communities">
        <button type="button" class="channel-scope-tab ${scope === "all" ? "active" : ""}"
                data-scope="all" aria-pressed="${scope === "all"}">
          All communities <span>${channels.length}</span>
        </button>
        <button type="button" class="channel-scope-tab ${scope === "joined" ? "active" : ""}"
                data-scope="joined" aria-pressed="${scope === "joined"}">
          Joined <span>${channels.filter(channel=>joinedChannels.has(channel.id)).length}</span>
        </button>
      </div>
      <div id="channelsDirectoryGrid" class="channels-grid">
        ${filtered.length ? cardsHtml : `
          <div class="community-empty-state">
            <span class="community-empty-icon" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/></svg>
            </span>
            <h2>${query ? "No communities found" : scope === "joined" ? "No joined communities yet" : "Start the first community"}</h2>
            <p>${query ? `No communities matched “${escapeHtml(searchFilter)}”. Try another search or open a valid community ID.`
                        : scope === "joined" ? "Join a community to see it here." : "New communities will appear here as soon as they are created."}</p>
            <div class="community-empty-actions">
              ${directId ? `
                <button type="button" id="btnOpenChannelById" class="btn-outline-small">
                  Open #${escapeHtml(directId)}
                </button>
              ` : ""}
              ${scope === "joined" ? '<button type="button" id="btnBrowseAllCommunities" class="btn-outline-small">Browse all communities</button>' : '<button type="button" id="btnCreateChannelNotFound" class="btn-post">Create community</button>'}
            </div>
          </div>
        `}
      </div>
    </section>
  `;
}
