// /js/routing.js

import { 
  allPosts, 
  voteCounts, 
  blockedUsers, 
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
import { fetchData, fetchChannelPosts, hasFinishedFeedSync } from "./api.js";
import { showFeedSkeleton, hideFeedSkeleton } from "./ui/feed-loading.js";
import { parseEmbeddedJson, showNotification, escapeHtml } from "./utils.js";
import { parseChannelCustomId } from "./helpers/channel-id.js";
import { getPostById, countDirectReplies } from "./data/post-index.js";
import { buildPostCard, buildRepliesRecursive, buildProfilePage, buildChannelsPage } from "./render.js";
import { rankPostsByVotes, rankPostsByComments } from "./helpers/ranking.js";
import { ADMIN } from "./config.js";
import { getDiscoveryResults, normalizeDiscoveryQuery, discoveryPostPool } from "./helpers/discovery.js";
import { buildExploreOverview, buildSearchOverview } from "./ui/discovery.js";

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
  } else if (["trending", "explore", "active", "search"].includes(newPage)) {
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
    showNotification("Post not found or not loaded yet.", false);
    window.location.hash = "";
    return;
  }

  const feed = document.getElementById("feed");
  if (!feed) return;
  feed.innerHTML = "";
  
  feed.appendChild(buildPostCard(post, pool, voteCounts, mutedPostIds));

  const repliesHtml = buildRepliesRecursive(post.id, pool);
  const replyCount = countDirectReplies(pool, post.id);
  const repliesContainer = document.createElement("section");
  repliesContainer.className = "conversation-panel";
  repliesContainer.setAttribute("aria-labelledby", "conversationRepliesTitle");
  repliesContainer.innerHTML = `
    <div class="conversation-panel-heading">
      <h3 id="conversationRepliesTitle">Conversation</h3>
      <span>${replyCount} ${replyCount === 1 ? "reply" : "replies"}</span>
    </div>
    <div class="conversation-panel-body">
      ${repliesHtml || '<p class="thread-no-replies">No replies yet. Be the first to join in.</p>'}
    </div>
  `;
  feed.appendChild(repliesContainer);

  // Atualiza UI
  const feedHeaderBar = document.getElementById("feedHeaderBar");
  if (feedHeaderBar) feedHeaderBar.classList.remove("hidden");
  document.getElementById("pageTitle").textContent = "Conversation";
  const btnBack = document.getElementById("btnBack");
  if (btnBack) {
    btnBack.classList.remove("hidden");
    btnBack.textContent = "← Back";
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
    btnBack.textContent = "← Back";
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
    showNotification("Invalid community ID. Enter a valid Custom JSON ID.", false);
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
    description: `Community #${cleanId} registered on Hive`
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
    btnBack.textContent = "← Main feed";
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
    // A channel change must replace the previous channel, not overlay its posts.
    feed.innerHTML = "";
    showFeedSkeleton(feed);
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

  // Only the currently selected channel may replace this view.
  if (activeChannel === cleanId) {
    hideFeedSkeleton(feed);
    if (finalPosts.length === 0) {
      feed.innerHTML = `
        <div class="community-empty-state">
          <span class="community-empty-icon" aria-hidden="true">#</span>
          <h2>Start a conversation in #${escapeHtml(cleanId)}</h2>
          <p>No one has posted here yet. Be the first to start a conversation.</p>
          <button id="btnFocusChannelComposer" type="button" class="btn-post">Create the first post</button>
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
      btn.textContent = isJoined ? "Joined" : "Join";
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
  if (allPosts.length === 0 && !hasFinishedFeedSync()) {
    try {
      await fetchData();
    } catch (e) {
      return; 
    }
  }

  const path = window.location.hash.substring(1);
  const searchRoute = path.match(/^\/search(?:\?(.*))?$/i);
  
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
  const isSpecialView = ["profile", "custom-json", "notifications", "messages", "channels", "explore", "trending", "active", "search"].includes(newPage);
  
  if (feedHeaderBar) {
    if (["feed", "profile", "channels", "explore", "trending", "active", "search"].includes(newPage)) {
      // Profile and directory already have their own clear page header.
      feedHeaderBar.classList.add("hidden");
    } else {
      feedHeaderBar.classList.remove("hidden");
      document.getElementById("pageTitle").textContent = title;
      const btnBack = document.getElementById("btnBack");
      if (btnBack) {
        btnBack.classList.toggle("hidden", newPage === "feed");
        btnBack.textContent = "← Back";
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
  } else if (newPage === "search" && searchRoute) {
    const query = normalizeDiscoveryQuery(new URLSearchParams(searchRoute[1] || "").get("q") || "");
    // Only search content actually loaded by this client, across main feed and
    // previously visited communities. Suppress blocked and muted authors/posts.
    const loadedChannelPosts = [...channelPostsMap.values()].flat();
    const pool = discoveryPostPool(allPosts, loadedChannelPosts, blockedUsers, mutedPostIds);
    const results = getDiscoveryResults({query,posts:pool,channels,maxPosts:300});
    renderFeed(results.posts);
    feed.insertAdjacentHTML("afterbegin", buildSearchOverview({results}));
    setupDiscoveryPageEvents();
  } else if (["explore", "trending", "active"].includes(newPage)) {
    const visibleMainPosts = discoveryPostPool(
      allPosts.filter(post => !post.custom_id || post.custom_id === "micro.fair"),
      [], blockedUsers, mutedPostIds);
    const mode = newPage === "trending" ? "popular" : newPage === "active" ? "discussed" : "latest";
    renderFeed(finalPosts);
    feed.insertAdjacentHTML("afterbegin", buildExploreOverview({posts:visibleMainPosts,channels,mode}));
    setupDiscoveryPageEvents();
  } else if (newPage === "profile") {
    feed.innerHTML = buildProfilePage(); 
  } else if (newPage === "notifications" || newPage === "messages") {
    // These are future capabilities, not fabricated live blockchain events.
    const isNotifications = newPage === "notifications";
    feed.innerHTML = `
      <section class="feature-empty-state" aria-labelledby="featureEmptyTitle">
        <div class="feature-empty-symbol" aria-hidden="true">
          ${isNotifications ? `
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M10 21h4"/>
            </svg>` : `
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="3"/>
              <path d="m4 7 8 6 8-6"/>
            </svg>`}
        </div>
        <span class="feature-empty-eyebrow">COMING SOON</span>
        <h2 id="featureEmptyTitle">${isNotifications ? "Notifications" : "Private messages"}</h2>
        <p>${isNotifications
          ? "We're building a clearer way to follow your activity on Hive. Notifications are not available yet."
          : "Secure Hive messages are on our roadmap. Messaging is not available yet."}</p>
        <a class="feature-empty-link" href="#/">Back to the feed <span aria-hidden="true">→</span></a>
      </section>
    `;
  } else {
    renderFeed(finalPosts); 
  }

  updateNavSelection(newPage);
  window.scrollTo(0, 0);
}

function setupDiscoveryPageEvents() {
  const submit = input => {
    const query = normalizeDiscoveryQuery(input?.value || "");
    window.location.hash = query ? `#/search?q=${encodeURIComponent(query)}` : "#/explore";
  };
  for (const [fieldId, buttonId] of [
    ["exploreSearchInput", "exploreSearchButton"],
    ["searchPageInput", "searchPageSubmit"]
  ]) {
    const input = document.getElementById(fieldId);
    const button = document.getElementById(buttonId);
    button?.addEventListener("click", () => submit(input));
    input?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit(input);
      }
    });
  }
}

function getRouteData(path) {
  // Posts do feed principal pertencentes estritamente ao micro.fair (isolando canais específicos)
  const mainFeedPosts = allPosts.filter(p => {
    const cid = (p.custom_id || "").toLowerCase();
    return !cid || cid === "micro.fair";
  });

  const route = {
    title: "For you",
    postsToRender: mainFeedPosts,
    newPage: "feed"
  };

  if (path === "/followed") {
    route.title = "Following";
    route.postsToRender = loggedInUser 
      ? mainFeedPosts.filter(p => followedUsers.has(p.required_posting_auths?.[0]))
      : mainFeedPosts;
    route.newPage = "followed";
  } else if (path === "/profile") {
    route.title = "My profile";
    route.newPage = "profile";
  } else if (path === "/bookmarks") {
    route.title = "Bookmarks";
    route.postsToRender = allPosts.filter(p => bookmarkedPostIds.has(p.id));
    route.newPage = "bookmarks";
  } else if (path === "/notifications") {
    route.title = "Notifications";
    route.newPage = "notifications";
  } else if (path === "/messages") {
    route.title = "Messages";
    route.newPage = "messages";
  } else if (path === "/channels") {
    route.title = "Communities";
    route.postsToRender = mainFeedPosts;
    route.newPage = "channels";
  } else if (path === "/my-votes" && loggedInUser) {
    route.title = "My votes";
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
    route.title = "My comments";
    route.newPage = "my-comments";
    route.postsToRender = allPosts.filter(p => {
      const isMyPost = p.required_posting_auths?.[0] === loggedInUser;
      const isReply = !!parseEmbeddedJson(p.json)?.reply_to;
      return isMyPost && isReply;
    });
  } else if (path === "/my-replies" && loggedInUser) {
    route.title = "Replies to my posts";
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
  } else if (path === "/explore") {
    route.title = "Explore";
    route.postsToRender = [...mainFeedPosts].sort((a,b) =>
      (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
    route.newPage = "explore";
  } else if (path === "/trending") {
    route.title = "Popular";
    route.postsToRender = rankPostsByVotes(mainFeedPosts);
    route.newPage = "trending";
  } else if (path === "/active") {
    route.title = "Most discussed";
    route.postsToRender = rankPostsByComments(mainFeedPosts);
    route.newPage = "active";
  } else if (path === "/search" || path.startsWith("/search?")) {
    route.title = "Search";
    route.postsToRender = [];
    route.newPage = "search";
  } else if (path === "/muted") {
    route.title = "Muted posts";
    route.postsToRender = allPosts.filter(p => mutedPostIds.has(p.id));
    route.newPage = "muted";
  }

  return route;
}