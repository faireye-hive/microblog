// /js/routing.js

import { 
  allPosts, 
  voteCounts, 
  renderFeed, 
  mutedPostIds, 
  loggedInUser, 
  followedUsers, 
  bookmarkedPostIds,
  applyFilterAndSort,
  channels,
  joinedChannels,
  toggleJoinChannel,
  activeChannel,
  setActiveChannel,
  getChannelPosts,
  channelPostsMap
} from "./state.js";
import { fetchData, fetchChannelPosts } from "./api.js";
import { parseEmbeddedJson, showNotification, escapeHtml } from "./utils.js";
import { parseChannelCustomId } from "./helpers/channel-id.js";
import { getPostById } from "./data/post-index.js";
import { buildPostCard, buildRepliesRecursive, buildProfilePage, buildChannelsPage } from "./render.js";
import { rankPostsByVotes, rankPostsByComments } from "./helpers/ranking.js";
import { ADMIN } from "./config.js";

export let currentPage = "feed";

// Atualiza a seleção visual das abas do topo e da barra lateral
export function updateNavSelection(newPage) {
  currentPage = newPage;

  // 1. Top Tabs
  document.querySelectorAll(".top-nav-tab").forEach(tab => tab.classList.remove("active"));
  if (newPage === "feed" || newPage === "tag" || newPage === "thread") {
    document.getElementById("tabForYou")?.classList.add("active");
  } else if (newPage === "followed") {
    document.getElementById("tabFollowing")?.classList.add("active");
  }

  // 2. Left Nav
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  if (newPage === "feed") {
    document.getElementById("leftNavHome")?.classList.add("active");
  } else if (newPage === "trending" || newPage === "explore") {
    document.getElementById("leftNavExplore")?.classList.add("active");
  } else if (newPage === "channels") {
    document.getElementById("leftNavChannels")?.classList.add("active");
  } else if (newPage === "bookmarks") {
    document.getElementById("leftNavBookmarks")?.classList.add("active");
  } else if (newPage === "notifications") {
    document.getElementById("leftNavNotifications")?.classList.add("active");
  } else if (newPage === "messages") {
    document.getElementById("leftNavMessages")?.classList.add("active");
  } else if (newPage === "profile") {
    document.getElementById("leftNavProfile")?.classList.add("active");
  } else if (newPage === "custom-json") {
    document.getElementById("leftNavCustomJson")?.classList.add("active");
  }

  // Retain secondary routes, but keep the sidebar uncluttered by default.
  const moreMenu = document.getElementById("leftNavMoreMenu");
  if (moreMenu && ["custom-json", "notifications", "messages"].includes(newPage)) {
    moreMenu.open = true;
  }

  document.querySelectorAll(".top-nav-tab, .left-nav-group a.nav-item").forEach(el => {
    if (el.classList.contains("active")) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
}

export function showSinglePost(postId) {
  let pool = allPosts;
  let post = getPostById(allPosts, postId);
  if (!post && activeChannel) {
    const chPosts = getChannelPosts(activeChannel);
    post = getPostById(chPosts, postId);
    if (post) pool = chPosts;
  }
  if (!post) {
    for (const [, pList] of channelPostsMap.entries()) {
      const found = getPostById(pList, postId);
      if (found) {
        post = found;
        pool = pList;
        break;
      }
    }
  }

  if (!post) {
    showNotification("❌ Post não encontrado ou não carregado!", false);
    window.location.hash = "";
    return;
  }

  const feed = document.getElementById("feed");
  if (!feed) return;
  feed.innerHTML = "";
  
  feed.appendChild(buildPostCard(post, pool, voteCounts, mutedPostIds));

  const repliesHtml = buildRepliesRecursive(post.id, pool);
  if (repliesHtml) {
    const repliesContainer = document.createElement("div");
    repliesContainer.className = "composer-card";
    repliesContainer.style.marginTop = "1rem";
    repliesContainer.innerHTML = `
      <h4 style="font-size: 1rem; font-weight: 800; margin-bottom: 0.75rem;">Respostas</h4>
      ${repliesHtml}
    `;
    feed.appendChild(repliesContainer);
  }

  // Atualiza UI
  const feedHeaderBar = document.getElementById("feedHeaderBar");
  if (feedHeaderBar) feedHeaderBar.classList.remove("hidden");
  document.getElementById("pageTitle").textContent = "Discussão (Thread)";
  const btnBack = document.getElementById("btnBack");
  if (btnBack) {
    btnBack.classList.remove("hidden");
    btnBack.textContent = "← Voltar";
  }
  
  document.getElementById("newPostSection")?.classList.add("hidden");
  updateNavSelection("thread");
  window.scrollTo(0, 0);
}

export function filterByTag(tag, pushHistory = true) {
  if (pushHistory) {
    window.location.hash = `/tag/${tag}`;
    return;
  }

  const filteredPosts = allPosts.filter((p) => {
    const js = parseEmbeddedJson(p.json);
    const tags = js?.tags || [];
    const text = js?.content || "";
    const matches = (text.match(/#([a-zA-Z0-9_\-\.]+)/g) || []).map(t => t.replace('#', ''));
    const allT = [...tags, ...matches].map(t => t.toLowerCase());
    return allT.includes(tag.toLowerCase());
  });
  
  let finalPosts = filteredPosts;
  const isAdmin = loggedInUser === ADMIN;
  if (!isAdmin) {
    finalPosts = filteredPosts.filter(p => !mutedPostIds.has(p.id));
  }

  const feedHeaderBar = document.getElementById("feedHeaderBar");
  if (feedHeaderBar) feedHeaderBar.classList.remove("hidden");
  document.getElementById("pageTitle").textContent = `#${tag}`;
  const btnBack = document.getElementById("btnBack");
  if (btnBack) {
    btnBack.classList.remove("hidden");
    btnBack.textContent = "← Voltar";
  }
  document.getElementById("newPostSection")?.classList.remove("hidden");

  renderFeed(finalPosts);
  updateNavSelection("tag");
  window.scrollTo(0, 0);
}

// Filtra o feed estritamente pelos posts de um canal específico (isolado por Custom JSON ID)
export async function filterByChannel(channelId, pushHistory = false) {
  const cleanId = parseChannelCustomId(channelId);
  if (!cleanId) {
    showNotification("Canal inválido: informe um ID Custom JSON válido.", false);
    return;
  }
  if (pushHistory) {
    window.location.hash = `#/channel/${encodeURIComponent(cleanId)}`;
    return;
  }
  setActiveChannel(cleanId);

  const channelObj = channels.find(c => c.id === cleanId) || {
    id: cleanId,
    name: `#${cleanId}`,
    description: `Canal #${cleanId} registrado na Hive`
  };

  const feedHeaderBar = document.getElementById("feedHeaderBar");
  if (feedHeaderBar) feedHeaderBar.classList.remove("hidden");

  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) {
    pageTitle.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        <span class="channel-route-hash">#${escapeHtml(cleanId)}</span>
        <span class="channel-route-name">${escapeHtml(channelObj.name || cleanId)}</span>
        <span class="channel-route-tag">Custom JSON</span>
      </div>
    `;
  }

  const btnBack = document.getElementById("btnBack");
  if (btnBack) {
    btnBack.classList.remove("hidden");
    btnBack.textContent = "← Feed Principal (micro.fair)";
  }

  // Mantém compositor visível para postar no canal
  const newPostSection = document.getElementById("newPostSection");
  if (newPostSection) {
    newPostSection.classList.remove("hidden");
  }

  const feedFiltersRoot = document.getElementById("feed-filters-root");
  if (feedFiltersRoot) feedFiltersRoot.classList.remove("hidden");

  const feed = document.getElementById("feed");
  let currentPosts = getChannelPosts(cleanId);

  if (currentPosts.length === 0) {
    feed.innerHTML = `
      <div class="community-empty-state community-loading" role="status">
        <span class="community-empty-icon" aria-hidden="true">#</span>
        <h2>Carregando #${escapeHtml(cleanId)}</h2>
        <p>Buscando as publicações deste canal na blockchain Hive.</p>
      </div>
    `;
  } else {
    renderFeed(currentPosts);
  }

  // Busca do blockchain Hive os posts exclusivos deste Custom JSON
  const fetched = await fetchChannelPosts(cleanId);

  let finalPosts = fetched;
  const isAdmin = loggedInUser === ADMIN;
  if (!isAdmin) {
    finalPosts = fetched.filter(p => !mutedPostIds.has(p.id));
  }

  // Se o usuário ainda estiver neste canal após o retorno da rede
  if (activeChannel === cleanId) {
    if (finalPosts.length === 0) {
      feed.innerHTML = `
        <div class="community-empty-state">
          <span class="community-empty-icon" aria-hidden="true">#</span>
          <h2>Comece uma conversa em #${escapeHtml(cleanId)}</h2>
          <p>Ainda não existem publicações neste canal. Você pode fazer a primeira!</p>
          <button id="btnFocusChannelComposer" type="button" class="btn-post">Criar primeira publicação</button>
        </div>
      `;
    } else {
      renderFeed(finalPosts);
    }
    document.getElementById("btnFocusChannelComposer")?.addEventListener("click", () => {
      const textarea = document.getElementById("newPostContent");
      textarea?.focus();
      textarea?.scrollIntoView({ behavior: "smooth" });
    });
  }

  updateNavSelection("channels");
  window.scrollTo(0, 0);
}

export function backToFeed() {
  window.location.hash = "";
}

// Eventos da página de Diretório de Canais
export function setupChannelsPageEvents() {
  const searchInput = document.getElementById("channelsDirectorySearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const feed = document.getElementById("feed");
      if (feed && currentPage === "channels") {
        feed.innerHTML = buildChannelsPage(e.target.value);
        setupChannelsPageEvents();
        const newSearch = document.getElementById("channelsDirectorySearch");
        if (newSearch) {
          newSearch.focus();
          newSearch.selectionStart = newSearch.selectionEnd = newSearch.value.length;
        }
      }
    });
  }

  const openModal = (prefillName = "") => {
      const modal = document.getElementById("createChannelModal");
      if (modal) {
        modal.classList.remove("hidden");
        if (prefillName) {
          const nameInput = document.getElementById("newChannelName");
          const idInput = document.getElementById("newChannelId");
          if (nameInput) nameInput.value = prefillName;
          // Adicionado o ponto (.) no regex para não removê-lo ao preencher automaticamente
          if (idInput) idInput.value = prefillName.toLowerCase().replace(/[^a-z0-9._-]/g, "");
        }
        document.getElementById("newChannelName")?.focus();
      }
  };

  document.getElementById("btnOpenChannelById")?.addEventListener("click", () => {
    const query = document.getElementById("channelsDirectorySearch")?.value?.trim() || "";
    const channelId = parseChannelCustomId(query.replace(/^#/, ""));
    if (channelId) window.location.hash = `#/channel/${encodeURIComponent(channelId)}`;
  });

  document.getElementById("btnCreateChannelFromPage")?.addEventListener("click", () => openModal());
  document.getElementById("btnCreateChannelNotFound")?.addEventListener("click", () => {
    const searchVal = document.getElementById("channelsDirectorySearch")?.value || "";
    openModal(searchVal);
  });

  document.querySelectorAll("#channelsDirectoryGrid .btn-join").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const ch = btn.dataset.channel;
      toggleJoinChannel(ch);
      const isJoined = joinedChannels.has(ch);
      btn.classList.toggle("joined", isJoined);
      btn.textContent = isJoined ? "Participando" : "Participar";
    });
  });

  document.querySelectorAll(".btn-post-in-channel").forEach(btn => {
    btn.addEventListener("click", () => {
      const ch = btn.dataset.channel;
      window.location.hash = `#/channel/${encodeURIComponent(ch)}`;
      setTimeout(() => {
        const textarea = document.getElementById("newPostContent");
        if (textarea) {
          textarea.focus();
          textarea.scrollIntoView({ behavior: "smooth" });
        }
      }, 120);
    });
  });
}

// Ouvinte para re-renderizar quando o estado de canais sincroniza
window.addEventListener("refreshChannelsPage", () => {
  if (currentPage === "channels") {
    const feed = document.getElementById("feed");
    const search = document.getElementById("channelsDirectorySearch")?.value || "";
    if (feed) {
      feed.innerHTML = buildChannelsPage(search);
      setupChannelsPageEvents();
    }
  }
});

// Lógica principal de roteamento
export async function handleRoute() {
  if (allPosts.length === 0) {
    try {
      await fetchData();
    } catch (e) {
      return; 
    }
  }

  const path = window.location.hash.substring(1);
  
  // CORREÇÃO: Adicionado o ponto (.) nas expressões regulares para capturar corretamente as rotas de canais e tags
  const tagMatch = path.match(/^\/(?:hashtag|tag)\/([a-z0-9._-]+)$/i);
  const channelMatch = path.match(/^\/channel\/([a-z0-9._-]+)$/i);
  const postMatch = path.match(/^\/thread\/(\d+)$/i);

  const feedHeaderBar = document.getElementById("feedHeaderBar");
  const newPostSection = document.getElementById("newPostSection");
  const feedFiltersRoot = document.getElementById("feed-filters-root");

  // Roteamento para Canal, Tag ou Thread
  if (channelMatch) {
    filterByChannel(channelMatch[1], false);
    return;
  }

  // Quando não estiver em um canal específico, volta para o canal principal (micro.fair)
  setActiveChannel(null);

  if (tagMatch) {
    const tag = tagMatch[1];
    filterByTag(tag, false);
    return;
  } else if (postMatch) {
    showSinglePost(postMatch[1]);
    return; 
  }
  
  // Determina os dados da rota
  const { title, postsToRender, newPage } = getRouteData(path);
  let finalPosts = postsToRender;
  
  const isAdmin = loggedInUser === ADMIN;
  if (!isAdmin && newPage !== "muted") {
    finalPosts = finalPosts.filter(p => !mutedPostIds.has(p.id));
  }

  // Configuração da UI de visualização
  const isSpecialView = ["profile", "custom-json", "notifications", "messages", "channels"].includes(newPage);
  
  if (feedHeaderBar) {
    if (["feed", "profile", "channels"].includes(newPage)) {
      // Profile and directory already have their own clear page header.
      feedHeaderBar.classList.add("hidden");
    } else {
      feedHeaderBar.classList.remove("hidden");
      document.getElementById("pageTitle").textContent = title;
      const btnBack = document.getElementById("btnBack");
      if (btnBack) {
        btnBack.classList.toggle("hidden", newPage === "feed");
        btnBack.textContent = "← Voltar";
      }
    }
  }

  if (newPostSection) {
    newPostSection.classList.toggle("hidden", isSpecialView);
  }

  if (feedFiltersRoot) {
    feedFiltersRoot.classList.toggle("hidden", isSpecialView);
  }

  const feed = document.getElementById("feed");

  if (newPage === "channels") {
    feed.innerHTML = buildChannelsPage();
    setupChannelsPageEvents();
  } else if (newPage === "profile") {
    feed.innerHTML = buildProfilePage(); 
  } else if (newPage === "notifications") {
    feed.innerHTML = `
      <div class="composer-card">
        <h3 class="sidebar-card-title" style="margin-bottom: 1rem;">Notificações</h3>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="display: flex; gap: 0.75rem; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
            <div style="font-size: 1.25rem;">🐝</div>
            <div>
              <p style="margin: 0; font-weight: 600;">Bem-vindo ao micro.feed!</p>
              <span style="font-size: 0.75rem; color: var(--text-faint);">Explore os posts descentralizados na blockchain Hive.</span>
            </div>
          </div>
          <div style="display: flex; gap: 0.75rem; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
            <div style="font-size: 1.25rem;">⭐</div>
            <div>
              <p style="margin: 0; font-weight: 600;">Nova tendência na rede Hive</p>
              <span style="font-size: 0.75rem; color: var(--text-faint);">A tag #crypto e #linux estão em alta hoje.</span>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (newPage === "messages") {
    feed.innerHTML = `
      <div class="composer-card" style="padding: 2.5rem; text-align: center;">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">✉️</div>
        <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.25rem;">Mensagens Privadas Hive</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem;">Em breve: Mensagens criptografadas P2P com memo keys Hive.</p>
      </div>
    `;
  } else {
    renderFeed(finalPosts); 
  }

  updateNavSelection(newPage);
  window.scrollTo(0, 0);
}

function getRouteData(path) {
  // Posts do feed principal pertencentes estritamente ao micro.fair (isolando canais específicos)
  const mainFeedPosts = allPosts.filter(p => {
    const cid = (p.custom_id || "").toLowerCase();
    return !cid || cid === "micro.fair";
  });

  const route = {
    title: "Para Você (For You)",
    postsToRender: mainFeedPosts,
    newPage: "feed"
  };

  if (path === "/followed") {
    route.title = "Posts de Quem Você Segue";
    route.postsToRender = loggedInUser 
      ? mainFeedPosts.filter(p => followedUsers.has(p.required_posting_auths?.[0]))
      : mainFeedPosts;
    route.newPage = "followed";
  } else if (path === "/profile") {
    route.title = "Meu Perfil";
    route.newPage = "profile";
  } else if (path === "/bookmarks") {
    route.title = "Meus Favoritos (Bookmarks)";
    route.postsToRender = allPosts.filter(p => bookmarkedPostIds.has(p.id));
    route.newPage = "bookmarks";
  } else if (path === "/notifications") {
    route.title = "Notificações";
    route.newPage = "notifications";
  } else if (path === "/messages") {
    route.title = "Mensagens";
    route.newPage = "messages";
  } else if (path === "/channels") {
    route.title = "Canais & Comunidades";
    route.postsToRender = mainFeedPosts;
    route.newPage = "channels";
  } else if (path === "/my-votes" && loggedInUser) {
    route.title = "Meus Votos";
    route.newPage = "my-votes";
    const votedPostIds = new Set();
    for (const postIdStr in voteCounts) {
      const votes = voteCounts[postIdStr];
      if (votes && votes.users && votes.users[loggedInUser]) {
        votedPostIds.add(postIdStr);
      }
    }
    route.postsToRender = allPosts.filter(p => votedPostIds.has(String(p.id)));   
  } else if (path === "/my-comments" && loggedInUser) {
    route.title = "Meus Comentários";
    route.newPage = "my-comments";
    route.postsToRender = allPosts.filter(p => {
      const isMyPost = p.required_posting_auths?.[0] === loggedInUser;
      const isReply = !!parseEmbeddedJson(p.json)?.reply_to;
      return isMyPost && isReply;
    });
  } else if (path === "/my-replies" && loggedInUser) {
    route.title = "Respostas aos Meus Posts";
    route.newPage = "my-replies";
    const myPostIds = new Set(
      allPosts
        .filter(p => p.required_posting_auths?.[0] === loggedInUser)
        .map(p => Number(p.id)) 
    );
    route.postsToRender = allPosts.filter(p => {
      const isMyPost = p.required_posting_auths?.[0] === loggedInUser;
      const replyTo = parseEmbeddedJson(p.json)?.reply_to;
      return !isMyPost && replyTo && myPostIds.has(Number(replyTo));
    });
  } else if (path === "/trending" || path === "/explore") {
    route.title = "Explorar / Trending";
    route.postsToRender = rankPostsByVotes(mainFeedPosts);
    route.newPage = "trending";
  } else if (path === "/active") {
    route.title = "Em Alta / Comentados";
    route.postsToRender = rankPostsByComments(mainFeedPosts);
    route.newPage = "active";
  } else if (path === "/muted") {
    route.title = "Mural (Posts Mutados)";
    route.postsToRender = allPosts.filter(p => mutedPostIds.has(p.id));
    route.newPage = "muted";
  }

  return route;
}