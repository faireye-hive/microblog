// /js/state.js

import { buildPostCard } from "./render.js";
import { parseEmbeddedJson, extractImages } from "./utils.js";
import { ADMIN } from "./config.js";

// ---------- Variáveis de Estado (Centralizadas aqui) ----------
export let allPosts = []; // Todos os posts brutos
export let voteCounts = {}; // Contagem de votos processada
export let allPostsToRender = []; // Lista atual de posts (completa ou filtrada) para renderização
export let renderedCount = 0;
export let loading = false;
export const BATCH_SIZE = 40;

export let loggedInUser = null; // Armazena o usuário logado
export let mutedPostIds = new Map(); // Armazena os IDs dos posts mutados
export let blockedUsers = new Set(); // Armazena os nomes de usuários bloqueados
export let followedUsers = new Set(); // Armazena os nomes de usuários seguidos

// Bookmarks locais
const savedBookmarks = JSON.parse(localStorage.getItem("micro_bookmarks") || "[]");
export let bookmarkedPostIds = new Set(savedBookmarks);

// Canais descobertos via Custom JSON (sem canais demonstrativos fictícios)
export let channels = [];
let savedJoined = JSON.parse(localStorage.getItem("micro_joined_channels") || "[]");
// Remove eventuais canais de demonstração antigos do cache local
savedJoined = savedJoined.filter(id => !["hive", "crypto", "linux", "gaming", "technology", "ai"].includes((id || "").toLowerCase()));
export let joinedChannels = new Set(savedJoined);

// Canal ativo no momento (null = Canal Principal 'micro.fair')
export let activeChannel = null;

// Mapa em memória de posts por canal: channelId -> Array<post>
export const channelPostsMap = new Map();

export function setChannelPosts(channelId, posts) {
  const clean = (channelId || "").toLowerCase().trim();
  channelPostsMap.set(clean, posts);
}

export function getChannelPosts(channelId) {
  const clean = (channelId || "").toLowerCase().trim();
  if (!clean) return [];
  if (channelPostsMap.has(clean)) {
    return channelPostsMap.get(clean);
  }
  try {
    const raw = localStorage.getItem(`hiveAppChannelPosts_${clean}`);
    if (raw) {
      const arr = JSON.parse(raw);
      channelPostsMap.set(clean, arr);
      return arr;
    }
  } catch (e) {}
  return [];
}

export function addChannelPostLocally(channelId, post) {
  const clean = (channelId || "").toLowerCase().trim();
  const list = [...getChannelPosts(clean)];
  // Evita duplicatas locais
  if (!list.some(p => p.id === post.id)) {
    list.unshift(post);
  }
  channelPostsMap.set(clean, list);
  try {
    localStorage.setItem(`hiveAppChannelPosts_${clean}`, JSON.stringify(list.slice(0, 1000)));
  } catch (e) {}
}

export function setActiveChannel(channelId) {
  activeChannel = channelId ? channelId.toLowerCase().trim() : null;
  updateComposerChannelUI();
}

export function updateComposerChannelUI() {
  const badge = document.getElementById("composerChannelBadge");
  const nameEl = document.getElementById("composerChannelName");
  const textarea = document.getElementById("newPostContent");
  const btnPost = document.getElementById("btnPost");
  const btnPostSpan = btnPost ? (btnPost.querySelector("span") || btnPost) : null;

  if (activeChannel) {
    if (badge) badge.classList.remove("hidden");
    if (nameEl) nameEl.textContent = `#${activeChannel}`;
    if (textarea) {
      textarea.placeholder = `Escreva algo para o canal #${activeChannel} (Custom JSON: ${activeChannel})...`;
    }
    if (btnPostSpan) {
      btnPostSpan.textContent = `Postar em #${activeChannel}`;
    }
  } else {
    if (badge) badge.classList.add("hidden");
    if (nameEl) nameEl.textContent = "";
    if (textarea) {
      textarea.placeholder = "O que você está pensando? (Canal Principal micro.fair)";
    }
    if (btnPostSpan) {
      btnPostSpan.textContent = "Post";
    }
  }
}

export function toggleJoinChannel(channelId) {
  const clean = channelId.toLowerCase();
  if (joinedChannels.has(clean)) {
    joinedChannels.delete(clean);
  } else {
    joinedChannels.add(clean);
  }
  localStorage.setItem("micro_joined_channels", JSON.stringify([...joinedChannels]));
  updateChannelsUI();
}

export function setChannels(newChannels) {
  channels = newChannels;
  updateChannelsUI();
}

export function addChannelLocally(channel) {
  const existsIndex = channels.findIndex(c => c.id === channel.id);
  if (existsIndex >= 0) {
    channels[existsIndex] = channel;
  } else {
    channels.unshift(channel);
  }
  joinedChannels.add(channel.id);
  localStorage.setItem("micro_joined_channels", JSON.stringify([...joinedChannels]));
  updateChannelsUI();
}

export function getChannelPostCount(channelId) {
  const target = (channelId || "").toLowerCase().trim();
  const posts = getChannelPosts(target);
  return posts.length;
}

export function getChannelIcon(channelId) {
  const map = {
    hive: "🐝",
    crypto: "🪙",
    linux: "🐧",
    gaming: "🎮",
    technology: "⚙️",
    tech: "⚙️",
    ai: "🔮",
    dev: "💻",
    webdev: "🌐",
    art: "🎨",
    music: "🎵",
    news: "📰",
    finance: "📈",
    memes: "🎭",
    fairmemes: "🎭"
  };
  return map[(channelId || "").toLowerCase()] || "#️⃣";
}

// Filtros & Ordenação
export let activeFilter = "all"; // 'all' | 'text' | 'media' | 'links' | 'long'
export let currentSort = "recent"; // 'recent' | 'votes' | 'comments'

export function toggleBookmark(postId) {
  if (bookmarkedPostIds.has(postId)) {
    bookmarkedPostIds.delete(postId);
  } else {
    bookmarkedPostIds.add(postId);
  }
  localStorage.setItem("micro_bookmarks", JSON.stringify([...bookmarkedPostIds]));
}

// ---------- Funções de Mutação de Estado ----------

export function setAllPosts(posts) {
  allPosts = posts;
  renderedCount = 0;
}

export function setVoteCounts(counts) {
  voteCounts = counts;
}

export function setLoggedInUser(user) {
  loggedInUser = user;
}

export function setMutedPostIds(newMutedPostMap) {
  mutedPostIds = newMutedPostMap;
}

export function setBlockedUsers(newBlockedSet) {
  blockedUsers = newBlockedSet;
}

export function setFollowedUsers(newFollowedSet) {
  followedUsers = newFollowedSet;
}

export function setActiveFilter(filter) {
  activeFilter = filter;
  applyFilterAndSort();
}

export function setCurrentSort(sort) {
  currentSort = sort;
  applyFilterAndSort();
}

export function applyFilterAndSort(baseList = allPosts) {
  let filtered = [...baseList];

  // Filtro por tipo
  if (activeFilter === "text") {
    filtered = filtered.filter(p => {
      const parsed = parseEmbeddedJson(p.json);
      const content = parsed?.content || "";
      const imgs = extractImages(content);
      return imgs.length === 0 && !content.includes("http://") && !content.includes("https://");
    });
  } else if (activeFilter === "media") {
    filtered = filtered.filter(p => {
      const parsed = parseEmbeddedJson(p.json);
      const imgs = extractImages(parsed?.content || "");
      return imgs.length > 0;
    });
  } else if (activeFilter === "links") {
    filtered = filtered.filter(p => {
      const parsed = parseEmbeddedJson(p.json);
      const content = parsed?.content || "";
      return content.includes("http://") || content.includes("https://");
    });
  } else if (activeFilter === "long") {
    filtered = filtered.filter(p => {
      const parsed = parseEmbeddedJson(p.json);
      return (parsed?.content || "").length > 250;
    });
  }

  // Ordenação
  if (currentSort === "recent") {
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } else if (currentSort === "votes") {
    filtered.sort((a, b) => {
      const va = (voteCounts[a.id]?.upvote || 0) - (voteCounts[a.id]?.downvote || 0);
      const vb = (voteCounts[b.id]?.upvote || 0) - (voteCounts[b.id]?.downvote || 0);
      return vb - va;
    });
  } else if (currentSort === "comments") {
    filtered.sort((a, b) => {
      const ra = allPosts.filter(r => parseEmbeddedJson(r.json)?.reply_to == a.id).length;
      const rb = allPosts.filter(r => parseEmbeddedJson(r.json)?.reply_to == b.id).length;
      return rb - ra;
    });
  }

  renderFeed(filtered);
}

// ---------- Funções de Renderização de Estado ----------

export function renderFeed(postsToRender) {
  allPostsToRender = postsToRender;
  renderedCount = 0;

  const feed = document.getElementById("feed");
  if (!feed) return;
  feed.innerHTML = "";
  if (allPostsToRender.length === 0) {
    feed.innerHTML = `
      <div class="composer-card" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
        <p style="margin: 0; font-size: 1rem;">Nenhum post encontrado nesta visualização.</p>
      </div>
    `;
    const indicator = document.getElementById("loadingIndicator");
    if (indicator) indicator.classList.add("hidden");
    return;
  }
  renderNextBatch();
}

export function renderNextBatch() {
  if (loading) return;
  loading = true;
  const feed = document.getElementById("feed");
  if (!feed) {
    loading = false;
    return;
  }

  const currentList = allPostsToRender.length > 0 ? allPostsToRender : allPosts;

  const filteredList = currentList.filter(p => 
    !blockedUsers.has(p.required_posting_auths?.[0])
  );

  const next = filteredList.slice(renderedCount, renderedCount + BATCH_SIZE);

  if (next.length === 0 && renderedCount === 0) {
    feed.innerHTML = `
      <div class="composer-card" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
        <p style="margin: 0; font-size: 1rem;">Nenhum post encontrado nesta visualização.</p>
      </div>
    `;
  }

  next.forEach((p) => feed.appendChild(buildPostCard(p, allPosts, voteCounts, mutedPostIds)));

  renderedCount += next.length;
  loading = false;
  
  const indicator = document.getElementById("loadingIndicator");
  if (indicator) {
    indicator.classList.toggle("hidden", renderedCount >= filteredList.length);
  }
}

// Atualiza a lista de tags na sidebar (apenas tags reais encontradas nos posts)
export function updateTags() {
  const map = new Map();

  const visiblePosts = allPosts.filter(p => 
    !blockedUsers.has(p.required_posting_auths?.[0])
  );

  visiblePosts.forEach((p) => {
    const js = parseEmbeddedJson(p.json);
    const tags = js?.tags || [];
    const text = js?.content || "";
    const matches = text.match(/#([a-zA-Z0-9_\-]+)/g) || [];
    matches.forEach(m => tags.push(m.replace('#', '')));
    tags.forEach((t) => {
      const clean = (t || "").toString().toLowerCase().trim();
      if (clean && clean.length > 1) {
        map.set(clean, (map.get(clean) || 0) + 1);
      }
    });
  });

  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const tList = document.getElementById("trendingList");
  if (!tList) return;
  tList.innerHTML = "";

  if (sorted.length === 0) {
    tList.innerHTML = `
      <div style="padding: 1rem 0.5rem; text-align: center; color: var(--text-faint); font-size: 0.8rem;">
        Nenhuma hashtag em alta nos posts ainda.
      </div>
    `;
    return;
  }

  sorted.forEach(([t, c], idx) => {
    const div = document.createElement("div");
    div.className = "trending-tag-row";
    div.setAttribute("data-tag", t);
    const formattedCount = c >= 1000 ? (c / 1000).toFixed(1) + "k" : c;
    div.innerHTML = `
      <div class="trending-tag-left">
        <span class="trending-rank">${idx + 1}</span>
        <span class="trending-tag-name">#${t}</span>
      </div>
      <span class="trending-post-count">${formattedCount} posts</span>
    `;
    tList.appendChild(div);
  });
}

// Atualiza dinamicamente as seções de canais na UI
export function updateChannelsUI() {
  // 1. Barra Lateral Esquerda: Seus Canais
  const yourList = document.getElementById("yourChannelsList");
  if (yourList) {
    yourList.innerHTML = "";
    if (channels.length === 0) {
      yourList.innerHTML = `
        <div style="padding: 0.5rem 0.75rem; font-size: 0.8rem; color: var(--text-faint);">
          Nenhum canal criado ainda.
        </div>
      `;
    } else {
      const listToRender = channels.slice(0, 7);
      listToRender.forEach(c => {
        const count = getChannelPostCount(c.id);
        const a = document.createElement("a");
        a.href = `#/channel/${encodeURIComponent(c.id)}`;
        a.className = "channel-item";
        a.setAttribute("data-channel", c.id);
        a.innerHTML = `
          <div class="channel-item-name">
            <span class="channel-hash">#</span>
            <span>${c.id}</span>
          </div>
          <span class="channel-count">${count}</span>
        `;
        yourList.appendChild(a);
      });

      const viewAll = document.createElement("a");
      viewAll.href = "#/channels";
      viewAll.className = "view-all-link";
      viewAll.textContent = "Ver todos os canais →";
      yourList.appendChild(viewAll);
    }
  }

  // 2. Barra Lateral Direita: Card de Canais
  const sidebarList = document.getElementById("sidebarChannelsList");
  if (sidebarList) {
    sidebarList.innerHTML = "";
    if (channels.length === 0) {
      sidebarList.innerHTML = `
        <div style="padding: 1rem 0.75rem; text-align: center; font-size: 0.82rem; color: var(--text-faint);">
          Nenhum canal descoberto na Hive ainda.
        </div>
      `;
    } else {
      const listToRender = channels.slice(0, 6);
      listToRender.forEach(c => {
        const isJoined = joinedChannels.has(c.id);
        const icon = getChannelIcon(c.id);
        const count = getChannelPostCount(c.id);
        const postLabel = count === 1 ? "1 post" : `${count} posts`;
        const div = document.createElement("div");
        div.className = "channel-card-row";
        div.innerHTML = `
          <div class="channel-card-left" style="cursor: pointer;" onclick="window.location.hash='#/channel/${encodeURIComponent(c.id)}'">
            <div class="channel-card-icon">${icon}</div>
            <div class="channel-card-info">
              <div class="channel-card-name">#${c.id}</div>
              <div class="channel-card-desc" title="${c.description}">${c.name || c.description}</div>
            </div>
          </div>
          <div class="channel-card-right">
            <span class="channel-sub-count">${postLabel}</span>
            <button class="btn-join ${isJoined ? 'joined' : ''}" data-channel="${c.id}">
              ${isJoined ? 'Joined' : 'Join'}
            </button>
          </div>
        `;
        sidebarList.appendChild(div);
      });

      sidebarList.querySelectorAll(".btn-join").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const ch = btn.dataset.channel;
          toggleJoinChannel(ch);
        });
      });
    }
  }

  // 3. Notifica página de canais se ativa
  window.dispatchEvent(new CustomEvent("refreshChannelsPage"));
}

