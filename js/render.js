// /js/render.js
import { parseEmbeddedJson, escapeHtml, stripMarkdown, extractImages, fmtDate, linkifyText } from "./utils.js";
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

// Helper local
function findPost(postId, allPosts) {
  return allPosts.find((p) => p.id == postId);
}

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
function buildUserPopover(author, isBlocked) {
  if (!loggedInUser || author === loggedInUser) return '';

  const isFollowing = followedUsers.has(author);
  const followText = isFollowing ? "💔 Deixar de Seguir" : "⭐ Seguir";
  const followType = isFollowing ? "unfollow" : "follow";
  const blockText = isBlocked ? "✅ Desbloquear" : "🚫 Bloquear";
  const blockType = isBlocked ? "unblock" : "block";

  return `
    <div data-author="${author}" class="user-popover-menu hidden">
      <button data-action="${followType}" data-user="${author}" class="dropdown-link" style="font-size: 0.825rem;">
        ${followText}
      </button>
      <button data-action="${blockType}" data-user="${author}" class="dropdown-link" style="font-size: 0.825rem; color: #dc2626;">
        ${blockText}
      </button>
    </div>
  `;
}

export function buildRepliesRecursive(parentId, allPosts, depth = 1) {
  const replies = allPosts.filter(
    (r) => parseEmbeddedJson(r.json)?.reply_to == parentId
  );
  if (replies.length === 0) return "";
  return replies
    .map((r) => {
      const author = r.required_posting_auths?.[0] || "user";
      const rj = parseEmbeddedJson(r.json);
      const nestedHTML = buildRepliesRecursive(r.id, allPosts, depth + 1);
      const replyContentHtml = linkifyText(escapeHtml(rj.content || "")).replace(/\n/g, "<br>");
      return `
        <div class="reply-thread-item" data-depth="${depth}">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.2rem;">
            <span class="reply-author author-name" data-author="${author}">@${author}</span>
            <span style="font-size: 0.75rem; color: var(--text-faint);">${fmtDate(r.timestamp)}</span>
          </div>
          <div class="reply-body">${replyContentHtml}</div>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.35rem;">
            <button class="post-action-btn reply-btn" data-id="${r.id}" style="padding: 0.2rem 0.5rem; font-size: 0.775rem;">
              Reply
            </button>
          </div>
          ${nestedHTML}
        </div>`;
    })
    .join("");
}

export function buildThreadAbove(post, allPosts) {
  const parsed = parseEmbeddedJson(post.json);
  if (!parsed?.reply_to) return ""; 
  const parent = findPost(parsed.reply_to, allPosts);
  if (!parent) return ""; 
  const pj = parseEmbeddedJson(parent.json);
  const author = parent.required_posting_auths?.[0] || "user";

  const maxSlice = 120;
  const originalContent = pj.content || "";
  const snippetText = originalContent.slice(0, maxSlice);
  const ellipsis = originalContent.length > maxSlice ? '...' : ''; 
  const contentHtml = linkifyText(escapeHtml(snippetText)).replace(/\n/g, "<br>");
  
  return `
    <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 10px; padding: 0.5rem 0.75rem; margin-bottom: 0.65rem; font-size: 0.85rem;">
      <span class="view-thread" data-id="${parent.id}" style="font-weight: 700; color: #0284c7; cursor: pointer;">
        ↳ Em resposta a @${author}
      </span>: 
      <span style="color: var(--text-muted);">${contentHtml}${ellipsis}</span>
    </div>`;
}

export function buildPostCard(p, allPosts, voteCounts = {}, mutedPostMap = new Map()) {
  const author = (p.required_posting_auths && p.required_posting_auths[0]) || "unknown";
  const parsed = parseEmbeddedJson(p.json);

  const rawContent = parsed?.content || ""; 
  let text = stripMarkdown(rawContent);
  const imgs = extractImages(rawContent); 

  if (imgs.length === 1 && text.trim() === imgs[0]) {
    text = ''; 
  }

  // Tags extraídas
  const tags = parsed?.tags || [];
  const tagMatches = rawContent.match(/#([a-zA-Z0-9_\-]+)/g) || [];
  const allTagNames = [...tags, ...tagMatches.map(t => t.replace('#', ''))];
  const primaryTag = allTagNames[0] || "hive";

  // URL para preview card
  const firstUrl = extractFirstUrl(rawContent);

  const replies = allPosts.filter(
    (r) => parseEmbeddedJson(r.json)?.reply_to == p.id
  );

  const votes = voteCounts[p.id] || { upvote: 0, downvote: 0 };
  const upvoteCount = votes.upvote;
  const downvoteCount = votes.downvote;
  
  const muteInfo = mutedPostMap.get(p.id);
  const isMuted = !!muteInfo;
  const muteCause = muteInfo ? escapeHtml(muteInfo.cause) : '';
  const muteAdmin = muteInfo ? muteInfo.admin : 'Admin';
  const isAdmin = loggedInUser === ADMIN;
  const isBlocked = blockedUsers.has(author);
  const isBookmarked = bookmarkedPostIds?.has(p.id);

  if (!isAdmin && isBlocked) {
    return document.createElement('div');
  }

  let muteBannerHTML = '';
  if (isMuted) {
    muteBannerHTML = `
      <div style="margin: 0.5rem 0; padding: 0.75rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; font-size: 0.85rem; color: #b91c1c;">
        <strong>🚨 Post Mutado</strong> 
        <span style="color: #64748b;">(por @${muteAdmin})</span>:
        <p style="margin: 0.25rem 0 0; font-weight: 600;">${muteCause}</p>
      </div>
    `;
  }

  // Card element
  const el = document.createElement("article");
  el.className = `post-card card ${isMuted ? 'opacity-70' : ''}`; 
  el.setAttribute('data-id', p.id);

  // Formata o texto principal
  const mainContentHtml = linkifyText(escapeHtml(text)).replace(/\n/g, "<br>");

  // Título em destaque se existir markdown title ou texto longo com quebra
  let headlineHtml = '';
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length > 1 && lines[0].length < 80) {
    headlineHtml = `<h4 class="post-headline">${escapeHtml(lines[0])}</h4>`;
  }

  // Link Preview Box se existir URL
  let previewBoxHtml = '';
  if (firstUrl && !imgs.includes(firstUrl)) {
    const domain = getDomain(firstUrl);
    let previewThumb = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&auto=format&fit=crop&q=60';
    let previewTitle = `${domain}`;
    let previewDesc = 'Click to explore content on Hive network.';

    if (domain.includes('hive.blog') || domain.includes('peakd.com') || domain.includes('ecency.com')) {
      previewTitle = 'Hive Blockchain Community';
      previewDesc = 'Decentralized blogging and social ecosystem powered by Hive.';
      previewThumb = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&auto=format&fit=crop&q=60';
    } else if (domain.includes('hive-engine')) {
      previewTitle = 'MEME Price & Market Chart';
      previewDesc = 'Live price, volume and market data on Hive Engine.';
      previewThumb = 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=300&auto=format&fit=crop&q=60';
    }

    previewBoxHtml = `
      <a href="${firstUrl}" target="_blank" rel="noopener noreferrer" class="preview-box">
        <img src="${previewThumb}" alt="Preview" class="preview-thumb" onerror="this.style.display='none'">
        <div class="preview-content">
          <div class="preview-title">${previewTitle}</div>
          <div class="preview-desc">${previewDesc}</div>
          <div class="preview-domain">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            <span>${firstUrl}</span>
          </div>
        </div>
      </a>
    `;
  }

  // Imagens
  let imagesHtml = '';
  if (imgs.length) {
    imagesHtml = `
      <div class="post-image-grid" style="${imgs.length > 1 ? 'grid-template-columns: repeat(2, 1fr);' : ''}">
        ${imgs.map(u => `
          <img src="${u}" class="post-inline-image post-image" data-full-src="${u}" loading="lazy" alt="Post attachment">
        `).join('')}
      </div>
    `;
  }

  el.innerHTML = `
    <!-- User Avatar -->
    <img 
      src="https://images.hive.blog/u/${author}/avatar" 
      alt="@${author}" 
      class="post-card-avatar post-avatar"
      onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 48 48\\'><rect width=\\'48\\' height=\\'48\\' fill=\\'%23cbd5e1\\'/><text x=\\'24\\' y=\\'32\\' font-size=\\'22\\' text-anchor=\\'middle\\'>👤</text></svg>'"
    >

    <!-- Post Main Content -->
    <div class="post-card-main post-content">
      <!-- Header Meta -->
      <div class="post-card-header post-meta">
        <div class="post-author-row">
          <span class="post-author-name author-name" data-author="${author}">@${author}</span>
          <span class="hive-user-badge" title="Hive verified account">
            <svg width="13" height="13" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2L3 9.5V22.5L16 30L29 22.5V9.5L16 2Z" fill="#0f172a"/>
              <path d="M11 10L8 16L11 22H14L11 16L14 10H11Z" fill="#e31337"/>
              <path d="M18 10L15 16L18 22H21L18 16L21 10H18Z" fill="#e31337"/>
            </svg>
          </span>
          <span class="post-timestamp">• ${fmtDate(p.timestamp)}</span>
          ${isMuted ? '<span style="color: #dc2626; font-size: 0.75rem; font-weight: 700; margin-left: 0.25rem;">(Mutado)</span>' : ''}
          ${buildUserPopover(author, isBlocked)}
        </div>

        <a href="#/tag/${primaryTag}" class="post-tag-badge tag-link" data-tag="${primaryTag}">
          <span># ${primaryTag}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </a>
      </div>

      ${parsed?.reply_to ? buildThreadAbove(p, allPosts) : ""}
      ${muteBannerHTML}

      ${headlineHtml}
      <div class="post-text post-body">${mainContentHtml}</div>

      ${previewBoxHtml}
      ${imagesHtml}

      <!-- Actions Footer -->
      <div class="post-actions-row post-actions">
        <!-- Upvote -->
        <button class="post-action-btn vote-btn upvote-btn" data-id="${p.id}" data-vote="upvote" title="Upvote">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
          <span>${upvoteCount}</span>
        </button>

        <!-- Downvote -->
        <button class="post-action-btn vote-btn downvote-btn" data-id="${p.id}" data-vote="downvote" title="Downvote">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <span>${downvoteCount}</span>
        </button>

        <!-- Comments / Thread -->
        <button class="post-action-btn thread-btn" data-id="${p.id}" title="Comments">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>${replies.length}</span>
        </button>

        <!-- Bookmark -->
        <button class="post-action-btn bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-id="${p.id}" title="Bookmark">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
          </svg>
        </button>

        <!-- Reply Button -->
        <button class="post-action-btn reply-btn" data-id="${p.id}" title="Reply to post">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 17 4 12 9 7"></polyline>
            <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
          </svg>
          <span>Reply</span>
        </button>

        ${isAdmin ? `
          ${isMuted ? `
            <button class="post-action-btn mute-btn" style="color: #16a34a;" data-id="${p.id}" data-type="unmute">Unmute</button>
          ` : `
            <button class="post-action-btn mute-btn" style="color: #dc2626;" data-id="${p.id}" data-type="mute">Mute</button>
          `}
        ` : ''}

        <!-- More Options -->
        <button class="post-action-btn post-more-btn" data-id="${p.id}" title="More options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
          </svg>
        </button>
      </div>

      <!-- Thread Container -->
      <div class="thread hidden thread-container" id="thread-${p.id}"></div>
    </div>
  `;

  return el;
}

function buildUserListHTML(usersSet, type) {
  if (usersSet.size === 0) {
    return `<p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.5rem;">Nenhum usuário ${type === 'blocked' ? 'bloqueado' : 'seguido'}.</p>`;
  }
  
  const users = Array.from(usersSet).sort(); 
  const actionButton = (user) => type === 'blocked' 
    ? `<button data-action="unblock" data-user="${user}" class="btn-outline-small" style="color: #16a34a; font-size: 0.75rem;">✅ Desbloquear</button>`
    : '';
      
  return users.map(user => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0; border-bottom: 1px solid var(--border);">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <img src="https://images.hive.blog/u/${user}/avatar" style="width: 28px; height: 28px; border-radius: 50%;" onerror="this.style.display='none'">
        <span style="font-weight: 600; font-size: 0.9rem;">@${user}</span>
      </div>
      ${actionButton(user)}
    </div>
  `).join('');
}

export function buildProfilePage() {
  if (!loggedInUser) {
    return `
      <div class="composer-card" style="padding: 2.5rem; text-align: center;">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔑</div>
        <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 0.5rem;">Faça login com sua conta Hive</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">Conecte sua conta Hive via Keychain para visualizar seu perfil, votos e comunidades.</p>
        <button id="btnProfileLogin" class="btn-post" style="display: inline-flex;">Entrar via Keychain</button>
      </div>
    `;
  }

  const followedListHtml = buildUserListHTML(followedUsers, 'followed');
  const blockedListHtml = buildUserListHTML(blockedUsers, 'blocked');

  return `
    <div style="display: flex; flex-direction: column; gap: 1.25rem; width: 100%;">
      <!-- Profile Header Card -->
      <div class="composer-card" style="display: flex; align-items: center; justify-content: space-between; padding: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 1.25rem;">
          <img 
            src="https://images.hive.blog/u/${loggedInUser}/avatar" 
            alt="@${loggedInUser}" 
            style="width: 68px; height: 68px; border-radius: 50%; border: 2px solid var(--border);"
            onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 48 48\\'><rect width=\\'48\\' height=\\'48\\' fill=\\'%23ffd600\\'/><text x=\\'24\\' y=\\'32\\' font-size=\\'24\\' text-anchor=\\'middle\\'>🐝</text></svg>'"
          >
          <div>
            <h1 style="font-size: 1.4rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 0.45rem;">
              @${loggedInUser}
              <span class="hive-user-badge">
                <svg width="16" height="16" viewBox="0 0 32 32" fill="none"><path d="M16 2L3 9.5V22.5L16 30L29 22.5V9.5L16 2Z" fill="#0f172a"/><path d="M11 10L8 16L11 22H14L11 16L14 10H11Z" fill="#e31337"/><path d="M18 10L15 16L18 22H21L18 16L21 10H18Z" fill="#e31337"/></svg>
              </span>
            </h1>
            <span style="font-size: 0.8rem; color: var(--text-faint);">Conta Autenticada Hive</span>
          </div>
        </div>
        <button id="btnProfileLogout" class="btn-outline-small" style="color: #dc2626;">Sair da Conta</button>
      </div>

      <!-- Followed & Blocked Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
        <div class="composer-card">
          <h3 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 0.75rem;">⭐ Usuários Seguidos (${followedUsers.size})</h3>
          <div id="followedUsersList" style="max-height: 380px; overflow-y: auto;">
            ${followedListHtml}
          </div>
        </div>

        <div class="composer-card">
          <h3 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 0.25rem;">🚫 Usuários Bloqueados (${blockedUsers.size})</h3>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem;">Usuários bloqueados ficam ocultos no seu feed.</p>
          <div id="blockedUsersList" style="max-height: 380px; overflow-y: auto;">
            ${blockedListHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Constrói a página do diretório de Canais Hive
export function buildChannelsPage(searchFilter = "") {
  const query = (searchFilter || "").toLowerCase().trim();
  const filtered = channels.filter(c => {
    if (!query) return true;
    return c.id.toLowerCase().includes(query) ||
           (c.name && c.name.toLowerCase().includes(query)) ||
           (c.description && c.description.toLowerCase().includes(query)) ||
           (c.creator && c.creator.toLowerCase().includes(query));
  });

  const cardsHtml = filtered.map(c => {
    const isJoined = joinedChannels.has(c.id);
    const icon = getChannelIcon(c.id);
    const count = getChannelPostCount(c.id);
    const postLabel = count === 1 ? "1 post" : `${count} posts`;

    return `
      <div class="composer-card" style="display: flex; flex-direction: column; justify-content: space-between; padding: 1.25rem;">
        <div>
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(227, 19, 55, 0.08); color: #e31337; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">
                ${icon}
              </div>
              <div>
                <a href="#/channel/${encodeURIComponent(c.id)}" style="text-decoration: none; color: var(--text); font-weight: 800; font-size: 1.05rem; display: block; line-height: 1.2;">
                  ${escapeHtml(c.name || c.id)}
                </a>
                <span style="font-size: 0.75rem; font-weight: 700; color: #e31337;">
                  #${escapeHtml(c.id)}
                </span>
              </div>
            </div>
            <button class="btn-join ${isJoined ? 'joined' : ''}" data-channel="${c.id}" style="font-size: 0.8rem; padding: 0.35rem 0.85rem;">
              ${isJoined ? 'Joined' : 'Join'}
            </button>
          </div>

          <p style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.45; margin-bottom: 1rem;">
            ${escapeHtml(c.description || "Canal público descentralizado na Hive.")}
          </p>
        </div>

        <div>
          <div style="border-top: 1px solid var(--border); padding-top: 0.75rem; display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: var(--text-faint);">
            <div style="display: flex; align-items: center; gap: 0.35rem;">
              <span>Criado por</span>
              <a href="#/user/${c.creator}" class="author-name" style="font-weight: 700;">@${c.creator}</a>
            </div>
            <span style="font-weight: 600; color: var(--text);">${postLabel}</span>
          </div>

          <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
            <a href="#/channel/${encodeURIComponent(c.id)}" class="btn-outline-small" style="flex: 1; text-align: center; text-decoration: none; justify-content: center; padding: 0.45rem;">
              Ver Feed
            </a>
            <button class="btn-post btn-post-in-channel" data-channel="${c.id}" style="padding: 0.45rem 0.85rem; font-size: 0.8rem;">
              Postar
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div style="display: flex; flex-direction: column; gap: 1.25rem; width: 100%;">
      <!-- Hero / Header Card -->
      <div class="composer-card" style="padding: 1.5rem; background: linear-gradient(135deg, rgba(227, 19, 55, 0.03) 0%, rgba(15, 23, 42, 0.02) 100%);">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem;">
          <div>
            <h1 style="font-size: 1.35rem; font-weight: 800; margin: 0 0 0.35rem 0; display: flex; align-items: center; gap: 0.5rem;">
              <span>Canais & Comunidades Hive</span>
              <span style="font-size: 0.75rem; font-weight: 700; background: rgba(227, 19, 55, 0.1); color: #e31337; padding: 2px 8px; border-radius: 999px;">
                ${channels.length} canais
              </span>
            </h1>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0; max-width: 620px; line-height: 1.4;">
              Descubra canais ou crie novos tópicos registrados de forma permanente na Hive via Custom JSON (<code>micro.fair.channels</code>).
            </p>
          </div>

          <button id="btnCreateChannelFromPage" class="btn-post" style="box-shadow: 0 4px 12px rgba(227, 19, 55, 0.2);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Criar Novo Canal</span>
          </button>
        </div>

        <!-- Search Bar -->
        <div style="position: relative; max-width: 100%;">
          <svg style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: #94a3b8;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            id="channelsDirectorySearch" 
            class="modal-input" 
            style="padding-left: 2.35rem; margin: 0; background: var(--bg-card);" 
            placeholder="Buscar canais por nome, #tag ou criador..." 
            value="${escapeHtml(searchFilter)}"
            autocomplete="off"
          />
        </div>
      </div>

      <!-- Channels Grid -->
      <div id="channelsDirectoryGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
        ${filtered.length > 0 ? cardsHtml : `
          <div class="composer-card" style="grid-column: 1 / -1; padding: 3rem; text-align: center; color: var(--text-muted);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
            <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 0.25rem;">Nenhum canal encontrado</h4>
            <p style="font-size: 0.85rem; margin-bottom: 1.25rem;">Nenhum canal corresponde a "${escapeHtml(searchFilter)}".</p>
            <button id="btnCreateChannelNotFound" class="btn-post" style="display: inline-flex;">
              + Criar Canal com este nome
            </button>
          </div>
        `}
      </div>
    </div>
  `;
}

