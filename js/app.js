import {
  extractTagsFromText,
  extractMentionsFromText,
  showNotification,
  parseEmbeddedJson,
} from "./utils.js";
import { buildRepliesRecursive } from "./render.js";
import { setupAuthListeners, setAuthCallbacks } from "./auth.js";
import {
  TopNavHTML,
  LeftSidebarHTML,
  ComposerHTML,
  FeedFiltersHTML,
  FeedHeaderHTML,
  RightSidebarHTML,
  LoginModalHTML,
  LogoutModalHTML,
  CustomJsonModalHTML,
  CreateChannelModalHTML,
} from "./templates.js";

import {
  fetchData,
  sendPost,
  sendVote,
  sendMute,
  sendUnmute,
  sendBlock,
  sendUnblock,
  sendFollow,
  sendUnfollow,
  sendCreateChannel,
  clearAllCaches,
} from "./api.js";
import {
  handleRoute,
  backToFeed,
  showSinglePost,
  filterByTag,
  currentPage,
} from "./routing.js";
import { 
  allPosts, 
  renderFeed, 
  renderNextBatch, 
  loading, 
  loggedInUser, 
  setLoggedInUser, 
  updateTags,
  toggleBookmark,
  bookmarkedPostIds,
  setActiveFilter,
  setCurrentSort,
  currentSort,
  activeChannel,
  getChannelPosts
} from "./state.js";

// ---------- Funções de UI Locais (Modais) ----------

function setupImageModal() {
  const modalHtml = `
    <div id="imageModal" class="modal-overlay hidden" onclick="this.classList.add('hidden')">
      <div style="position: relative; max-width: 90vw; max-height: 90vh;">
        <img id="modalImage" src="" style="max-width: 100%; max-height: 85vh; object-fit: contain; border-radius: 16px;" onclick="event.stopPropagation()">
        <button class="modal-close" style="color: white; top: -2.5rem; right: 0; font-size: 2rem;" onclick="document.getElementById('imageModal').classList.add('hidden'); event.stopPropagation();">&times;</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

function showImageModal(src) {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("modalImage");
  if (modal && img) {
    img.src = src;
    modal.classList.remove("hidden");
  }
}

function showMuteReasonModal(contentId) {
  const modalHtml = `
    <div id="muteReasonModal" class="modal-overlay">
      <div class="modal-dialog">
        <h3 class="modal-title">Mutar Post</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.75rem;">Insira o motivo para mutar este post:</p>
        <textarea id="muteReasonInput" class="modal-input" rows="3" placeholder="Motivo obrigatório"></textarea>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button id="cancelMute" class="btn-outline-small">
            Cancelar
          </button>
          <button id="confirmMute" class="btn-post">
            Mutar
          </button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const modal = document.getElementById("muteReasonModal");
  const input = document.getElementById("muteReasonInput");
  input.focus();

  document.getElementById("confirmMute").addEventListener("click", () => {
    const cause = input.value.trim();
    if (!cause) {
      showNotification("⚠️ O motivo é obrigatório para mutar.", false);
      return;
    }
    sendMute(contentId, cause);
    modal.remove();
    showNotification("✅ Post mutado, aguardando confirmação...", true);
  });

  document.getElementById("cancelMute").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target.id === "muteReasonModal") modal.remove();
  });
}

// ---------- LISTENERS E INTERAÇÕES ----------

function setupScrollListeners() {
  window.addEventListener("scroll", () => {
    if (loading) return;
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
    if (nearBottom) {
      renderNextBatch();
    }
  });
}

function setupFeedDelegation() {
  const feed = document.getElementById("feed");
  if (!feed) return;

  feed.addEventListener("click", (e) => {
    // 1. VIEW THREAD
    if (e.target.classList.contains("view-thread")) {
      const id = e.target.dataset.id;
      showSinglePost(id);
    }

    // 2. THREAD TOGGLE
    const threadBtn = e.target.closest(".thread-btn");
    if (threadBtn) {
      const id = threadBtn.dataset.id;
      const card = threadBtn.closest(".post-card");
      if (!card) return;
      const threadDiv = card.querySelector(".thread");
      if (!threadDiv) return;

      if (!threadDiv.classList.contains("hidden")) {
        threadDiv.classList.add("hidden");
        threadDiv.innerHTML = "";
        return;
      }
      const repliesHtml = buildRepliesRecursive(id, allPosts);
      threadDiv.innerHTML = repliesHtml || '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0;">Sem respostas ainda. Seja o primeiro a responder!</div>';
      threadDiv.classList.remove("hidden");
    }

    // 3. REPLY BUTTON
    const replyBtn = e.target.closest(".reply-btn");
    if (replyBtn) {
      const id = replyBtn.dataset.id;
      const card = replyBtn.closest(".post-card");
      if (!card) return;
      const existing = card.querySelector(".reply-input-box");
      if (existing) {
        existing.remove();
        return;
      }
      const replyBox = document.createElement("div");
      replyBox.className = "reply-input-box";
      replyBox.innerHTML = `
        <textarea class="reply-input-textarea" rows="2" placeholder="Escreva sua resposta na rede Hive..."></textarea>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
          <button class="btn-outline-small cancel-reply">Cancelar</button>
          <button class="btn-post send-reply" style="padding: 0.35rem 0.95rem; font-size: 0.8rem;">Responder</button>
        </div>`;
      
      const contentWrap = card.querySelector(".post-card-main") || card;
      contentWrap.appendChild(replyBox);
      
      const textarea = replyBox.querySelector("textarea");
      textarea.focus();

      replyBox.querySelector(".cancel-reply").addEventListener("click", () => replyBox.remove());
      replyBox.querySelector(".send-reply").addEventListener("click", () => {
        const text = textarea.value.trim();
        if (!text) return showNotification("⚠️ Digite algo para responder!", false);
        const targetPost = allPosts.find(p => p.id == id) || (activeChannel ? getChannelPosts(activeChannel).find(p => p.id == id) : null);
        const postChannel = (targetPost && targetPost.custom_id) ? targetPost.custom_id : activeChannel;
        sendPost(text, parseInt(id) || id, postChannel);
      });
    }

    // 4. BOOKMARK BUTTON
    const bookmarkBtn = e.target.closest(".bookmark-btn");
    if (bookmarkBtn) {
      const id = bookmarkBtn.dataset.id;
      toggleBookmark(id);
      const isSaved = bookmarkedPostIds.has(id);
      bookmarkBtn.classList.toggle("bookmarked", isSaved);
      const svg = bookmarkBtn.querySelector("svg");
      if (svg) {
        svg.setAttribute("fill", isSaved ? "currentColor" : "none");
      }
      showNotification(isSaved ? "🔖 Post salvo nos Favoritos!" : "Post removido dos Favoritos.", true);
    }

    // 5. IMAGE MODAL
    if (e.target.classList.contains("post-image")) {
      const fullSrc = e.target.dataset.fullSrc;
      showImageModal(fullSrc);
    }

    // 6. VOTE BUTTON
    const voteBtn = e.target.closest(".vote-btn");
    if (voteBtn) {
      const contentId = voteBtn.dataset.id;
      const voteType = voteBtn.dataset.vote;
      sendVote(contentId, voteType);
    }

    // 7. TAG LINK
    const tagLink = e.target.closest(".tag-link");
    if (tagLink) {
      const tag = tagLink.dataset.tag || tagLink.textContent.replace("#", "").trim();
      filterByTag(tag);
    }

    // 8. MUTE BUTTON
    const muteBtn = e.target.closest(".mute-btn");
    if (muteBtn) {
      if (!loggedInUser) {
        showNotification("🔒 Você precisa estar logado para mutar/desmutar posts.", false);
        return;
      }
      const contentId = muteBtn.dataset.id;
      const type = muteBtn.dataset.type;
      if (type === "mute") {
        showMuteReasonModal(contentId);
      } else if (type === "unmute") {
        sendUnmute(contentId);
        showNotification("✅ Desmutando post...", true);
      }
    }

    // 9. PROFILE POPUP
    if (e.target.classList.contains("author-name")) {
      const author = e.target.dataset.author;
      const currentPostCard = e.target.closest(".card") || e.target.closest(".post-card");
      const popover = currentPostCard
        ? currentPostCard.querySelector(`.user-popover-menu[data-author="${author}"]`)
        : null;

      document.querySelectorAll(".user-popover-menu").forEach((p) => {
        if (p !== popover) p.classList.add("hidden");
      });

      if (popover) {
        popover.classList.toggle("hidden");
      }
    }

    // 10. LOGIN/LOGOUT ON PROFILE PAGE
    if (e.target.id === "btnProfileLogin") {
      document.getElementById("loginModal")?.classList.remove("hidden");
    }
    if (e.target.id === "btnProfileLogout") {
      document.getElementById("logoutConfirmModal")?.classList.remove("hidden");
    }
  });
}

function setupGlobalInteractions() {
  document.addEventListener("click", (e) => {
    const popoverSelector = ".user-popover-menu";
    const btn = e.target.closest(`${popoverSelector} button`);

    // Ações dentro do Popover
    if (btn) {
      const action = btn.dataset.action;
      const targetUser = btn.dataset.user;
      
      if (action && targetUser) {
        btn.closest(popoverSelector)?.classList.add("hidden"); 

        if (action === "block") sendBlock(targetUser);
        else if (action === "unblock") sendUnblock(targetUser);
        else if (action === "follow") sendFollow(targetUser);
        else if (action === "unfollow") sendUnfollow(targetUser);
      }
    }
    
    // Desbloqueio na Página de Perfil
    const profileUnblockBtn = e.target.closest('button[data-action="unblock"]');
    if (profileUnblockBtn && currentPage === "profile") { 
      const targetUser = profileUnblockBtn.dataset.user;
      sendUnblock(targetUser);
      profileUnblockBtn.closest("div")?.remove();
    }

    // Fechar Popover ao clicar fora
    if (!e.target.closest(popoverSelector) && !e.target.classList.contains("author-name")) {
      document.querySelectorAll(popoverSelector).forEach(p => p.classList.add("hidden"));
    }
  });

  // Atalho global Ctrl+K para buscar
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const input = document.getElementById("topSearchInput");
      if (input) {
        input.focus();
        input.select();
      }
    }
  });
}

function setupComposerControls() {
  const btnPost = document.getElementById("btnPost");
  const textarea = document.getElementById("newPostContent");
  const charCount = document.getElementById("charCount");

  if (textarea) {
    textarea.addEventListener("input", () => {
      const len = textarea.value.length;
      if (charCount) charCount.textContent = `${len} / 2048`;
    });
  }

  if (btnPost) {
    btnPost.addEventListener("click", () => {
      const text = textarea ? textarea.value.trim() : "";
      if (!text) return showNotification("⚠️ Digite algo para publicar!", false);
      sendPost(text);
    });
  }

  const btnExitChannel = document.getElementById("btnExitChannelComposer");
  if (btnExitChannel) {
    btnExitChannel.addEventListener("click", () => {
      window.location.hash = "#/";
    });
  }

  // Tool pills do Composer (Text, Image, Link, Video, File, Custom JSON)
  document.querySelectorAll(".composer-tools .tool-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const mode = pill.dataset.mode;
      document.querySelectorAll(".composer-tools .tool-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");

      if (mode === "image") {
        const url = prompt("Insira a URL da imagem:");
        if (url && textarea) {
          textarea.value += `\n![imagem](${url})\n`;
          textarea.focus();
        }
      } else if (mode === "link") {
        const url = prompt("Insira a URL do link:");
        if (url && textarea) {
          textarea.value += `\n[link](${url})\n`;
          textarea.focus();
        }
      } else if (mode === "video") {
        const url = prompt("Insira a URL do vídeo (YouTube/3Speak):");
        if (url && textarea) {
          textarea.value += `\n${url}\n`;
          textarea.focus();
        }
      } else if (mode === "file") {
        const url = prompt("Insira a URL do anexo/arquivo:");
        if (url && textarea) {
          textarea.value += `\n[arquivo](${url})\n`;
          textarea.focus();
        }
      } else if (mode === "json") {
        document.getElementById("customJsonModal")?.classList.remove("hidden");
      }
    });
  });
}

function setupFeedFilters() {
  // Filtros (All, Text, Media, Links, Long Posts)
  const tabs = document.querySelectorAll("#feedFilterTabs .filter-pill");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const filter = tab.dataset.filter;
      setActiveFilter(filter);
    });
  });

  // Botão de Ordenação
  const sortBtn = document.getElementById("sortDropdownBtn");
  const sortLabel = document.getElementById("currentSortLabel");
  if (sortBtn) {
    sortBtn.addEventListener("click", () => {
      if (currentSort === "recent") {
        setCurrentSort("votes");
        if (sortLabel) sortLabel.textContent = "Trending";
      } else if (currentSort === "votes") {
        setCurrentSort("comments");
        if (sortLabel) sortLabel.textContent = "Comments";
      } else {
        setCurrentSort("recent");
        if (sortLabel) sortLabel.textContent = "Recent";
      }
    });
  }
}

function setupSidebarControls() {
  // Busca no Topo
  const searchInput = document.getElementById("topSearchInput");
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const query = searchInput.value.trim();
        if (!query) {
          window.location.hash = "#/";
          return;
        }
        if (query.startsWith("#")) {
          filterByTag(query.replace("#", ""));
        } else {
          const filtered = allPosts.filter((p) => {
            const js = parseEmbeddedJson(p.json);
            const content = (js?.content || "").toLowerCase();
            const author = (p.required_posting_auths?.[0] || "").toLowerCase();
            return content.includes(query.toLowerCase()) || author.includes(query.toLowerCase());
          });
          const feedHeaderBar = document.getElementById("feedHeaderBar");
          if (feedHeaderBar) feedHeaderBar.classList.remove("hidden");
          document.getElementById("pageTitle").textContent = `Busca: "${query}"`;
          document.getElementById("btnBack").classList.remove("hidden");
          renderFeed(filtered);
        }
      }
    });
  }

  // Refresh Tags
  document.getElementById("btnRefreshTags")?.addEventListener("click", updateTags);

  // Trending List Clicks
  const trendingList = document.getElementById("trendingList");
  if (trendingList) {
    trendingList.addEventListener("click", (e) => {
      const row = e.target.closest(".trending-tag-row");
      if (row) {
        const tag = row.dataset.tag;
        if (tag) filterByTag(tag);
      }
    });
  }

  // Channel Join Buttons
  document.querySelectorAll(".btn-join").forEach(btn => {
    btn.addEventListener("click", () => {
      const channel = btn.dataset.channel;
      const joined = btn.classList.toggle("joined");
      btn.textContent = joined ? "Joined" : "Join";
      showNotification(joined ? `✅ Inscrito no canal #${channel}` : `Saiu do canal #${channel}`, true);
    });
  });

  // Create Channel Modal Handlers
  const channelModal = document.getElementById("createChannelModal");
  const openChannelModal = (prefillName = "") => {
    if (!loggedInUser) {
      showNotification("🔒 Faça login com Hive Keychain para criar um canal!", false);
      document.getElementById("loginModal")?.classList.remove("hidden");
      return;
    }
    if (channelModal) {
      channelModal.classList.remove("hidden");
      if (prefillName) {
        const nameInput = document.getElementById("newChannelName");
        const idInput = document.getElementById("newChannelId");
        if (nameInput) nameInput.value = prefillName;
        if (idInput) idInput.value = prefillName.toLowerCase().replace(/[^a-z0-9._-]/g, "");
      }
      document.getElementById("newChannelName")?.focus();
    }
  };

  document.getElementById("btnCreateChannelTrigger")?.addEventListener("click", () => openChannelModal());
  document.getElementById("btnAddChannel")?.addEventListener("click", () => openChannelModal());

  // Auto-slugify ID a partir do nome (Permitindo o caractere ponto .)
  const channelNameInput = document.getElementById("newChannelName");
  const channelIdInput = document.getElementById("newChannelId");
  let channelIdManuallyEdited = false;

  channelIdInput?.addEventListener("input", () => {
    channelIdManuallyEdited = true;
    channelIdInput.value = channelIdInput.value.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  });

  channelNameInput?.addEventListener("input", () => {
    if (!channelIdManuallyEdited && channelIdInput) {
      channelIdInput.value = channelNameInput.value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9.]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24);
    }
  });

  document.getElementById("closeCreateChannelModal")?.addEventListener("click", () => {
    channelModal?.classList.add("hidden");
  });
  document.getElementById("cancelCreateChannel")?.addEventListener("click", () => {
    channelModal?.classList.add("hidden");
  });

  document.getElementById("confirmCreateChannel")?.addEventListener("click", () => {
    const channelName = document.getElementById("newChannelName")?.value.trim();
    const channelId = document.getElementById("newChannelId")?.value.trim();
    const channelDesc = document.getElementById("newChannelDesc")?.value.trim();

    if (!channelName) {
      return showNotification("⚠️ Informe o nome do canal (ex: Linux, Rust, Gaming)!", false);
    }
    if (!channelId) {
      return showNotification("⚠️ Informe o ID/tag do canal (ex: linux, rust, gaming)!", false);
    }

    sendCreateChannel(channelId, channelName, channelDesc);
  });

  // Quick Actions
  document.querySelectorAll(".quick-action-item").forEach(item => {
    item.addEventListener("click", () => {
      const action = item.dataset.action;
      if (action === "new-post") {
        const textarea = document.getElementById("newPostContent");
        if (textarea) {
          textarea.focus();
          textarea.scrollIntoView({ behavior: "smooth" });
        }
      } else if (action === "new-channel") {
        openChannelModal();
      } else if (action === "custom-json") {
        document.getElementById("customJsonModal")?.classList.remove("hidden");
      } else if (action === "settings") {
        window.location.hash = "#/profile";
      }
    });
  });

  // Custom JSON Modal Handlers
  const customModal = document.getElementById("customJsonModal");
  document.getElementById("closeCustomJsonModal")?.addEventListener("click", () => customModal?.classList.add("hidden"));
  document.getElementById("cancelCustomJson")?.addEventListener("click", () => customModal?.classList.add("hidden"));
  document.getElementById("submitCustomJson")?.addEventListener("click", () => {
    const customId = document.getElementById("customJsonId")?.value.trim() || "microblog_v1";
    const payload = document.getElementById("customJsonPayload")?.value.trim();
    if (!payload) return showNotification("⚠️ Digite o conteúdo JSON!", false);
    if (!window.hive_keychain) return showNotification("❌ Hive Keychain não detectado!", false);
    if (!loggedInUser) return showNotification("🔒 Faça login para transmitir Custom JSON!", false);

    window.hive_keychain.requestCustomJson(
      loggedInUser,
      customId,
      "Posting",
      payload,
      "Broadcast Custom JSON",
      (res) => {
        if (res.success) {
          showNotification("✅ Operação Custom JSON transmitida com sucesso!", true);
          customModal?.classList.add("hidden");
        } else {
          showNotification("❌ Falha na transmissão: " + (res.message || "Erro"), false);
        }
      }
    );
  });

  // Header Back & Refresh
  document.getElementById("btnBack")?.addEventListener("click", backToFeed);
  document.getElementById("btnRefresh")?.addEventListener("click", refreshCurrentView);

  // Clear Cache
  document.getElementById("clearCacheButton")?.addEventListener("click", (e) => {
    e.preventDefault();
    clearAllCaches();
  });
}

// ---------- MONTAGEM DO DOM INICIAL ----------

function setupInitialDOM() {
  document.getElementById("top-nav-root").innerHTML = TopNavHTML;
  document.getElementById("left-sidebar-root").innerHTML = LeftSidebarHTML;
  document.getElementById("composer-root").innerHTML = ComposerHTML;
  document.getElementById("feed-filters-root").innerHTML = FeedFiltersHTML;
  document.getElementById("feed-header-root").innerHTML = FeedHeaderHTML;
  document.getElementById("right-sidebar-root").innerHTML = RightSidebarHTML;
  document.getElementById("modal-root").innerHTML = LoginModalHTML;
  document.getElementById("logout-root").innerHTML = LogoutModalHTML;
  document.getElementById("extra-modal-root").innerHTML = CustomJsonModalHTML + CreateChannelModalHTML;
}

function setupEventListeners() {
  setupScrollListeners();
  setupFeedDelegation();
  setupGlobalInteractions();
  setupComposerControls();
  setupFeedFilters();
  setupSidebarControls();
}

async function refreshCurrentView() {
  await fetchData();
  handleRoute();
}

async function handleInitialRoute() {
  setLoggedInUser(localStorage.getItem("hiveUser"));
  handleRoute();
}

// ---------- INICIALIZAÇÃO ----------

// 1. Monta o HTML no DOM
setupInitialDOM();

// 2. Configura a Autenticação
setAuthCallbacks(
  async (user) => {
    setLoggedInUser(user);
    await fetchData();
    window.location.hash = "#/";
    handleRoute();
  },
  async () => {
    setLoggedInUser(null);
    await fetchData();
    window.location.hash = "#/";
    handleRoute();
  }
);
setupAuthListeners();

// 3. Listeners e modais
setupEventListeners();
setupImageModal();

// 4. Inicia feed e roteamento
handleInitialRoute();

// 5. Escuta mudança de hash
window.addEventListener("hashchange", handleRoute);