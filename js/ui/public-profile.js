/*
 * Public account pages are a read-only view of Hive's public profile metadata
 * and Micro.fair posts already cached in the browser.
 *
 * Never display synthetic follower counts, hidden private data, or a claim
 * that the entire Hive post history has been indexed.
 */
import {escapeAttr, escapeHtml, fmtDate, parseEmbeddedJson} from "../utils.js";
import {safeExternalUrl, safeHiveUsername, hiveAvatarUrl} from "../security/safe-values.js";
import {proxiedImageUrl} from "../security/media-url.js";

export function publicUserPath(name) {
  const user = safeHiveUsername(name);
  return user === "unknown" ? "#/explore" : `#/user/${encodeURIComponent(user)}`;
}

export function collectPublicProfilePosts(user, posts = []) {
  const username = safeHiveUsername(user);
  if (username === "unknown") return {posts:[],topLevel:[],replies:[]};
  const all = (Array.isArray(posts) ? posts : []).filter(
    post => safeHiveUsername(post?.required_posting_auths?.[0]) === username
  ).sort((a,b) => (Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0));
  const topLevel=[], replies=[];
  for (const post of all) {
    const parsed = parseEmbeddedJson(post.json);
    if (parsed?.reply_to) replies.push(post);
    else topLevel.push(post);
  }
  return {posts:all,topLevel,replies};
}

function joinedDate(value) {
  if (!value) return "";
  const date=new Date(value.endsWith("Z")?value:value+"Z");
  if (!Number.isFinite(date.valueOf())) return "";
  return new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric",timeZone:"UTC"}).format(date);
}

export function buildPublicProfilePage({
  username,
  account = null,
  status = "loading",
  allCount = 0,
  postsCount = 0,
  repliesCount = 0,
  tab = "posts",
  isSelf = false,
  signedIn = false,
  isFollowing = false,
  isBlocked = false
} = {}) {
  const user = safeHiveUsername(username);
  if (user === "unknown") return `
    <section class="public-profile-invalid" role="status">
      <h1>Invalid Hive account</h1>
      <p>This profile URL does not contain a valid account name.</p>
      <a href="#/explore">Explore Micro.fair →</a>
    </section>`;

  const profile = account && account.username === user ? account : null;
  const name = typeof profile?.displayName === "string" && profile.displayName ?
    profile.displayName : "@" + user;
  const bio=typeof profile?.about==="string" ? profile.about : "";
  const location=typeof profile?.location==="string" ? profile.location : "";
  const website=safeExternalUrl(profile?.website);
  const profileImage=safeExternalUrl(profile?.profileImage)||hiveAvatarUrl(user);
  const banner=safeExternalUrl(profile?.coverImage);
  const joined=joinedDate(profile?.joined);
  const section=(tab==="replies"?"replies":"posts");

  let actionButtons = "";
  if (isSelf) {
    actionButtons = `<a href="#/profile" class="public-profile-action public-profile-edit">
      Account settings <span aria-hidden="true">↗</span></a>`;
  } else if (!signedIn) {
    actionButtons = `<button type="button" class="public-profile-action public-profile-primary"
                          id="btnPublicProfileLogin">Sign in to follow</button>`;
  } else {
    actionButtons = `
      <button type="button" class="public-profile-action ${isFollowing?"public-profile-following":"public-profile-primary"}"
              data-profile-action="${isFollowing?"unfollow":"follow"}" data-user="${escapeAttr(user)}"
              aria-label="${isFollowing?"Unfollow":"Follow"} @${escapeAttr(user)}"
              aria-pressed="${isFollowing}">${isFollowing?"Following":"Follow"}</button>
      <button type="button" class="public-profile-action public-profile-secondary"
              data-profile-action="${isBlocked?"unblock":"block"}" data-user="${escapeAttr(user)}"
              aria-label="${isBlocked?"Unblock":"Block"} @${escapeAttr(user)}"
              aria-pressed="${isBlocked}">${isBlocked?"Unblock":"Block"}</button>`;
  }

  return `
    <section class="public-profile-page" aria-labelledby="publicProfileTitle">
      <div class="public-profile-banner" aria-hidden="true">
        ${banner ? `<img src="${escapeAttr(proxiedImageUrl(banner))}" alt="" loading="lazy"
                          data-profile-cover="true">` : ""}
        <span class="public-profile-banner-mark">HIVE / SOCIAL</span>
      </div>
      <header class="public-profile-header">
        <div class="public-profile-header-top">
          <img class="public-profile-avatar" src="${escapeAttr(proxiedImageUrl(profileImage))}"
               alt="" data-avatar-fallback="user">
          <div class="public-profile-actions">${actionButtons}</div>
        </div>
        <div class="public-profile-intro">
          <span class="public-profile-eyebrow">PUBLIC HIVE PROFILE</span>
          <h1 id="publicProfileTitle">${escapeHtml(name)}</h1>
          ${name === "@"+user ? "" : `<span class="public-profile-username">@${escapeHtml(user)}</span>`}
          ${bio ? `<p class="public-profile-about">${escapeHtml(bio)}</p>` : ""}
          <div class="public-profile-meta">
            ${location ? `<span class="public-profile-meta-item">⌾ ${escapeHtml(location)}</span>` : ""}
            ${website ? `<a class="public-profile-meta-item public-profile-website"
                 href="${escapeAttr(website)}" target="_blank" rel="noopener noreferrer"
                 referrerpolicy="no-referrer">↗ ${escapeHtml(new URL(website).hostname)}</a>` : ""}
            ${joined ? `<span class="public-profile-meta-item">On Hive since ${escapeHtml(joined)}</span>` : ""}
          </div>
          ${status === "loading" ? `<p class="public-profile-rpc-state" role="status">
            Loading public Hive account details…</p>` : ""}
          ${status === "unavailable" ? `<p class="public-profile-rpc-state">
            Live account details are temporarily unavailable. Showing locally loaded posts.</p>` : ""}
          ${status === "not-found" && allCount === 0 ? `<p class="public-profile-rpc-state">
            This account was not found by the connected Hive RPC.</p>` : ""}
          ${isBlocked ? `<p class="public-profile-blocked-note" role="status">
            You blocked @${escapeHtml(user)}. Their posts are hidden until you unblock them.</p>` : ""}
        </div>
        <div class="public-profile-stats" aria-label="Activity in locally loaded Micro.fair content">
          <div class="public-profile-stat"><strong>${postsCount}</strong><span>Posts loaded</span></div>
          <span class="public-profile-stats-divider" aria-hidden="true"></span>
          <div class="public-profile-stat"><strong>${repliesCount}</strong><span>Replies loaded</span></div>
          <span class="public-profile-stats-caption">From posts loaded in this browser, not account-wide totals</span>
        </div>
      </header>
      <div class="public-profile-feed-heading">
        <div>
          <span class="public-profile-eyebrow">THE CONVERSATION</span>
          <h2>From @${escapeHtml(user)}</h2>
        </div>
        <a href="#/explore" class="public-profile-explore-link">Explore →</a>
      </div>
      <nav class="public-profile-tabs" aria-label="Profile activity">
        <a href="${escapeAttr(publicUserPath(user))}" class="public-profile-tab ${section==="posts"?"active":""}"
           ${section==="posts"?'aria-current="page"':""}>Posts <span>${postsCount}</span></a>
        <a href="${escapeAttr(publicUserPath(user))}/replies" class="public-profile-tab ${section==="replies"?"active":""}"
           ${section==="replies"?'aria-current="page"':""}>Replies <span>${repliesCount}</span></a>
      </nav>
      ${isBlocked ? "" : section==="posts"&&postsCount===0 ?
        `<div class="public-profile-empty"><strong>No posts loaded for this account.</strong>
          <p>The app shows only available Micro.fair posts, including communities you've visited.</p></div>` :
        section==="replies"&&repliesCount===0 ?
        `<div class="public-profile-empty"><strong>No replies loaded for this account.</strong>
          <p>Replies will appear here when they're available in your loaded data.</p></div>` : ""}
    </section>`;
}
