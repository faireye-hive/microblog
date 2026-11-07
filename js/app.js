import {
  extractTagsFromText,
  extractMentionsFromText,
  showNotification,
  parseEmbeddedJson,
} from "./utils.js";
import { buildRepliesRecursive } from "./render.js";
import { getDiscoveryResults, normalizeDiscoveryQuery, discoveryPostPool } from "./helpers/discovery.js";
import { buildSearchSuggestions } from "./ui/discovery.js";
import { hasHiveKeychain, requestHiveCustomJson } from "./hive/keychain.js";
import { safeExternalUrl, safeHiveUsername } from "./security/safe-values.js";
import { installImageErrorHandling } from "./security/image-errors.js";
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
  channels, 
  channelPostsMap, 
  blockedUsers, 
  mutedPostIds, 
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

let imageModalReturnFocus = null;

function closeImageModal() {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("modalImage");
  modal?.classList.add("hidden");
  if (img) img.removeAttribute("src");
  imageModalReturnFocus?.focus?.();
  imageModalReturnFocus = null;
}

function setupImageModal() {
  const modalHtml = `
    <div id="imageModal" class="modal-overlay post-lightbox hidden"
         role="dialog" aria-modal="true" aria-labelledby="imageModalTitle">
      <div class="post-lightbox-dialog">
        <div class="post-lightbox-header">
          <strong id="imageModalTitle">Image preview</strong>
          <button id="closeImageModal" type="button" class="post-lightbox-close"
                  aria-label="Close image preview">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <path d="M6 6 18 18M18 6 6 18"/>
            </svg>
          </button>
        </div>
        <img id="modalImage" alt="Expanded post image" class="post-lightbox-image">
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const overlay = document.getElementById("imageModal");
  overlay?.addEventListener("click", event => {
    if (event.target === overlay) closeImageModal();
  });
  overlay?.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeImageModal();
    } else if (event.key === "Tab") {
      // Only one focusable element in the lightbox.
      event.preventDefault();
      document.getElementById("closeImageModal")?.focus();
    }
  });
  document.getElementById("closeImageModal")?.addEventListener("click", closeImageModal);
}

function showImageModal(src, trigger) {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("modalImage");
  if (!modal || !img) return;
  const url = safeExternalUrl(src);
  if (!url) return;
  imageModalReturnFocus = trigger || document.activeElement;
  img.src = url;
  modal.classList.remove("hidden");
  document.getElementById("closeImageModal")?.focus();
}

async function sharePostLink(id) {
  // Build links from the current deployment path (GitHub Pages and local both work).
  if (!/^\d+$/.test(String(id))) return;
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = `#/thread/${encodeURIComponent(id)}`;
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({title: "Post on Micro.fair", url: url.toString()});
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url.toString());
      showNotification("Post link copied to clipboard.", true);
    } else {
      // Older browsers can still select the post URL manually.
      window.prompt("Copy this post link:", url.toString());
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      showNotification("Could not share this post. Please try again.", false);
    }
  }
}

function showMuteReasonModal(contentId) {
  const modalHtml = `
    <div id="muteReasonModal" class="modal-overlay">
      <div class="modal-dialog">
        <h3 class="modal-title">Mute post</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.75rem;">Enter a reason for muting this post:</p>
        <textarea id="muteReasonInput" class="modal-input" rows="3" placeholder="Reason (required)"></textarea>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button id="cancelMute" class="btn-outline-small">
            Cancel
          </button>
          <button id="confirmMute" class="btn-post">
            Mute
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
      showNotification("⚠️ Please enter a reason before muting.", false);
      return;
    }
    sendMute(contentId, cause);
    modal.remove();
    showNotification("✅ Post muted. Waiting for blockchain confirmation...", true);
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
    // Navigate to a parent post from a reply context card.
    const threadLink = e.target.closest(".view-thread");
    if (threadLink) {
      showSinglePost(threadLink.dataset.id);
      return;
    }

    // Expand or collapse the replies inline.
    const threadBtn = e.target.closest(".thread-btn");
    if (threadBtn) {
      const id = threadBtn.dataset.id;
      const card = threadBtn.closest(".post-card");
      if (!card) return;
      const threadDiv = card.querySelector(".thread");
      if (!threadDiv) return;
      if (currentPage === "thread") {
        document.querySelector(".conversation-panel")?.scrollIntoView({behavior:"smooth", block:"start"});
        return;
      }

      const opening = threadDiv.classList.contains("hidden");
      if (!opening) {
        threadDiv.classList.add("hidden");
        threadDiv.innerHTML = "";
        threadBtn.setAttribute("aria-expanded", "false");
        return;
      }
      const pool = activeChannel ? getChannelPosts(activeChannel) : allPosts;
      const repliesHtml = buildRepliesRecursive(id, pool);
      threadDiv.innerHTML = `
        <div class="thread-inline-heading">
          <span>Replies</span>
          ${/^\d+$/.test(String(id)) ?
            `<a href="#/thread/${encodeURIComponent(id)}" class="thread-open-link">Full conversation →</a>` : ""}
        </div>
        ${repliesHtml || '<p class="thread-no-replies">No replies yet. Start the conversation!</p>'}
      `;
      threadDiv.classList.remove("hidden");
      threadBtn.setAttribute("aria-expanded", "true");
      return;
    }

    // Reply inline to a post or to an individual reply in a thread.
    const replyBtn = e.target.closest(".reply-btn");
    if (replyBtn) {
      const id = replyBtn.dataset.id;
      // Full conversation replies live in a sibling panel of the root post.
      const card = replyBtn.closest(".post-card") ||
        (replyBtn.closest(".conversation-panel") ? feed.querySelector(".post-card") : null);
      if (!card) return;
      const existing = currentPage === "thread"
        ? feed.querySelector(".reply-input-box")
        : card.querySelector(".reply-input-box");
      if (existing) {
        const sameTarget = existing.dataset.replyId === String(id);
        existing.remove();
        feed.querySelectorAll('.reply-btn[aria-expanded="true"]').
          forEach(button => button.setAttribute("aria-expanded", "false"));
        if (sameTarget) return;
      }

      const replyItem = replyBtn.closest(".reply-thread-item");
      const mount = replyItem || card.querySelector(".post-card-main") || card;
      const replyBox = document.createElement("div");
      replyBox.className = "reply-input-box";
      replyBox.dataset.replyId = String(id);
      replyBox.innerHTML = `
        <div class="reply-compose-top">
          <span class="reply-compose-target">Write a reply</span>
          <button type="button" class="reply-compose-close cancel-reply" aria-label="Close reply editor">&times;</button>
        </div>
        <textarea class="reply-input-textarea" rows="3" maxlength="2048"
                  aria-label="Write a reply" placeholder="Share your thoughts on Hive..."></textarea>
        <div class="reply-compose-bottom">
          <span class="reply-compose-count" aria-live="off">0 / 2048</span>
          <div class="reply-compose-actions">
            <button type="button" class="btn-outline-small cancel-reply">Cancel</button>
            <button type="button" class="btn-post send-reply">Post reply</button>
          </div>
        </div>
      `;
      mount.appendChild(replyBox);
      const author = replyItem?.querySelector(".reply-author")?.textContent?.trim() ||
        card.querySelector(".post-author-name")?.textContent?.trim() || "";
      const replyTarget = replyBox.querySelector(".reply-compose-target");
      if (author) replyTarget.textContent = `Replying to ${author}`;
      const textarea = replyBox.querySelector(".reply-input-textarea");
      const count = replyBox.querySelector(".reply-compose-count");
      textarea.addEventListener("input", () => {
        count.textContent = `${textarea.value.length} / 2048`;
      });
      const close = () => {
        replyBox.remove();
        replyBtn.setAttribute("aria-expanded", "false");
        replyBtn.focus();
      };
      replyBtn.setAttribute("aria-expanded", "true");
      textarea.addEventListener("keydown", event => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          replyBox.querySelector(".send-reply")?.click();
        }
      });
      replyBox.querySelectorAll(".cancel-reply").forEach(button => button.addEventListener("click", close));
      replyBox.querySelector(".send-reply").addEventListener("click", () => {
        const text = textarea.value.trim();
        if (!text) {
          showNotification("Write a reply before posting.", false);
          textarea.focus();
          return;
        }
        const pool = activeChannel ? getChannelPosts(activeChannel) : allPosts;
        const targetPost = pool.find(post => String(post.id) === String(id)) ||
          allPosts.find(post => String(post.id) === String(id));
        const postChannel = targetPost?.custom_id || activeChannel;
        sendPost(text, /^\d+$/.test(String(id)) ? Number(id) : id, postChannel);
      });
      textarea.focus();
      return;
    }

    // 4. BOOKMARK BUTTON
    const bookmarkBtn = e.target.closest(".bookmark-btn");
    if (bookmarkBtn) {
      const id = bookmarkBtn.dataset.id;
      toggleBookmark(id);
      const isSaved = bookmarkedPostIds.has(id);
      bookmarkBtn.classList.toggle("bookmarked", isSaved);
      bookmarkBtn.setAttribute("aria-pressed", String(isSaved));
      bookmarkBtn.setAttribute("aria-label", isSaved ? "Remove bookmark" : "Save post");
      bookmarkBtn.title = isSaved ? "Remove bookmark" : "Save post";
      const svg = bookmarkBtn.querySelector("svg");
      if (svg) {
        svg.setAttribute("fill", isSaved ? "currentColor" : "none");
      }
      showNotification(isSaved ? "Post saved to bookmarks!" : "Post removed from bookmarks.", true);
    }

    // Native image buttons can be opened with a pointer or keyboard.
    const imageTrigger = e.target.closest(".post-image-trigger");
    if (imageTrigger) {
      const image = imageTrigger.querySelector(".post-image");
      showImageModal(image?.dataset.fullSrc, imageTrigger);
      return;
    }

    const shareBtn = e.target.closest(".post-share-btn");
    if (shareBtn) {
      void sharePostLink(shareBtn.dataset.id);
      return;
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
        showNotification("🔒 Sign in to mute or unmute posts.", false);
        return;
      }
      const contentId = muteBtn.dataset.id;
      const type = muteBtn.dataset.type;
      if (type === "mute") {
        showMuteReasonModal(contentId);
      } else if (type === "unmute") {
        sendUnmute(contentId);
        showNotification("✅ Unmuting post...", true);
      }
    }

    // Accessible author actions, only when authenticated.
    const authorButton = e.target.closest(".author-name[data-author]");
    if (authorButton) {
      const author = authorButton.dataset.author;
      const card = authorButton.closest(".post-card");
      const popover = card
        ? [...card.querySelectorAll(".user-popover-menu")].find(el => el.dataset.author === author)
        : null;
      document.querySelectorAll(".user-popover-menu").forEach(other => {
        if (other !== popover) other.classList.add("hidden");
      });
      document.querySelectorAll(".author-name[aria-expanded]").forEach(button => {
        if (button !== authorButton) button.setAttribute("aria-expanded", "false");
      });
      if (popover) {
        popover.classList.toggle("hidden");
        authorButton.setAttribute("aria-expanded", String(!popover.classList.contains("hidden")));
      }
      return;
    }

    // 10. LOGIN/LOGOUT ON PROFILE PAGE
    if (e.target.closest("#btnProfileLogin")) {
      // Reuse the accessible account flow so focus lands in the username input.
      document.getElementById("btnMenu")?.click();
    }
    if (e.target.closest("#btnProfileLogout")) {
      // Reuse the existing confirmation logic and keyboard focus management.
      document.getElementById("menuLogout")?.click();
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

    // Close author menus and restore their expanded state when clicking away.
    if (!e.target.closest(popoverSelector) && !e.target.closest(".author-name[data-author]")) {
      document.querySelectorAll(popoverSelector).forEach(p => p.classList.add("hidden"));
      document.querySelectorAll(".author-name[aria-expanded]").forEach(
        button => button.setAttribute("aria-expanded", "false")
      );
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    const openMenu = document.querySelector(".user-popover-menu:not(.hidden)");
    if (!openMenu) return;
    const trigger = openMenu.closest(".post-card")?.querySelector(".author-name[aria-expanded]");
    openMenu.classList.add("hidden");
    trigger?.setAttribute("aria-expanded", "false");
    trigger?.focus();
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
      if (!text) return showNotification("⚠️ Write something before posting!", false);
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
      // Advanced actions remain available without keeping the menu open.
      const advancedMenu = pill.closest(".composer-extra");
      if (advancedMenu) advancedMenu.open = false;
      document.querySelectorAll(".composer-tools .tool-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");

      if (mode === "image") {
        const url = prompt("Enter an image URL:");
        if (url && textarea) {
          textarea.value += `\n![image](${url})\n`;
          textarea.focus();
        }
      } else if (mode === "link") {
        const url = prompt("Enter a link URL:");
        if (url && textarea) {
          textarea.value += `\n[link](${url})\n`;
          textarea.focus();
        }
      } else if (mode === "video") {
        const url = prompt("Enter a video URL (YouTube/3Speak):");
        if (url && textarea) {
          textarea.value += `\n${url}\n`;
          textarea.focus();
        }
      } else if (mode === "file") {
        const url = prompt("Enter an attachment URL:");
        if (url && textarea) {
          textarea.value += `\n[file](${url})\n`;
          textarea.focus();
        }
      } else if (mode === "json") {
        document.getElementById("customJsonModal")?.classList.remove("hidden");
        document.getElementById("customJsonId")?.focus();
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
        if (sortLabel) sortLabel.textContent = "Most discussed";
      } else {
        setCurrentSort("recent");
        if (sortLabel) sortLabel.textContent = "Latest";
      }
    });
  }
}

function setupSidebarControls() {
  // Fast, accessible, client-side discovery over the content already loaded.
  const searchInput = document.getElementById("topSearchInput");
  const searchPanel = document.getElementById("searchResultsPanel");
  const searchContainer = searchInput?.closest(".search-container");
  const mobileTrigger = document.getElementById("btnMobileSearch");
  const mobileClose = document.getElementById("closeMobileSearch");
  if (searchInput && searchPanel) {
    let debounceId = 0;
    let activeOption = -1;
    const options = () => [...searchPanel.querySelectorAll(".search-suggestion-item")];
    const showPanel = () => {
      searchPanel.classList.remove("hidden");
      searchInput.setAttribute("aria-expanded", "true");
    };
    const closePanel = (closeMobile = false) => {
      clearTimeout(debounceId);
      searchPanel.classList.add("hidden");
      searchInput.setAttribute("aria-expanded", "false");
      searchInput.removeAttribute("aria-activedescendant");
      activeOption = -1;
      if (closeMobile) {
        searchContainer?.classList.remove("search-mobile-open");
        mobileTrigger?.setAttribute("aria-expanded", "false");
      }
    };
    const selectOption = index => {
      const items = options();
      activeOption = Math.min(items.length-1,Math.max(-1,index));
      items.forEach((item,n)=>{
        const selected=n===activeOption;
        item.classList.toggle("selected",selected);
        item.setAttribute("aria-selected",String(selected));
      });
      if(activeOption>=0) {
        searchInput.setAttribute("aria-activedescendant",items[activeOption].id);
        items[activeOption].scrollIntoView?.({block:"nearest"});
      } else searchInput.removeAttribute("aria-activedescendant");
    };
    const renderSuggestions = () => {
      const query = normalizeDiscoveryQuery(searchInput.value);
      const postPool = discoveryPostPool(
        allPosts, [...channelPostsMap.values()].flat(), blockedUsers, mutedPostIds);
      const results = getDiscoveryResults({query,posts:postPool,channels,maxPosts:5});
      searchPanel.innerHTML = buildSearchSuggestions(results);
      activeOption=-1;
      searchInput.removeAttribute("aria-activedescendant");
      showPanel();
    };
    const goToSearch = () => {
      const query=normalizeDiscoveryQuery(searchInput.value);
      closePanel(true);
      window.location.hash=query ? `#/search?q=${encodeURIComponent(query)}` : "#/explore";
    };
    searchInput.addEventListener("focus", renderSuggestions);
    searchInput.addEventListener("input", ()=>{
      clearTimeout(debounceId);
      debounceId = setTimeout(renderSuggestions, 100);
    });
    searchInput.addEventListener("keydown",event=>{
      if(event.key==="ArrowDown"||event.key==="ArrowUp"){
        event.preventDefault();
        if(searchPanel.classList.contains("hidden"))renderSuggestions();
        const items=options();
        if(items.length)selectOption(event.key==="ArrowDown" ?
          (activeOption+1)%items.length : (activeOption<=0?items.length-1:activeOption-1));
      } else if(event.key==="Escape"){
        event.preventDefault();
        closePanel(true);
        searchInput.blur();
        mobileTrigger?.focus?.();
      } else if(event.key==="Enter"){
        event.preventDefault();
        const selected=options()[activeOption];
        if(selected?.getAttribute("href")){
          window.location.hash=selected.getAttribute("href");
          closePanel(true);
        } else goToSearch();
      }
    });
    searchPanel.addEventListener("click",event=>{
      if(event.target.closest("a[href]"))closePanel(true);
    });
    document.addEventListener("pointerdown",event=>{
      if(!searchContainer?.contains(event.target) && event.target!==mobileTrigger)
        closePanel(true);
    });
    window.addEventListener("hashchange",()=>closePanel(true));
    mobileTrigger?.addEventListener("click",()=>{
      const open = !searchContainer?.classList.contains("search-mobile-open");
      searchContainer?.classList.toggle("search-mobile-open",open);
      mobileTrigger.setAttribute("aria-expanded",String(open));
      if(open)searchInput.focus();
      else {closePanel(true);mobileTrigger.focus();}
    });
    mobileClose?.addEventListener("click",()=>{
      closePanel(true);
      mobileTrigger?.focus();
    });
  }

  // The header notification icon must navigate instead of being decorative.
  document.getElementById("btnNotificationsTop")?.addEventListener("click", () => {
    window.location.hash = "#/notifications";
  });

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
      showNotification(joined ? `✅ Joined #${channel}` : `Left #${channel}`, true);
    });
  });

  // Create Channel Modal Handlers
  const channelModal = document.getElementById("createChannelModal");
  const openChannelModal = (prefillName = "") => {
    if (!loggedInUser) {
      showNotification("🔒 Sign in with Hive Keychain to create a community!", false);
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
      return showNotification("⚠️ Enter a community name (e.g. Linux, Rust, Gaming).", false);
    }
    if (!channelId) {
      return showNotification("⚠️ Enter a community ID (e.g. linux, rust, gaming).", false);
    }

    sendCreateChannel(channelId, channelName, channelDesc);
  });

  // Custom JSON Modal Handlers
  const customModal = document.getElementById("customJsonModal");
  document.getElementById("closeCustomJsonModal")?.addEventListener("click", () => customModal?.classList.add("hidden"));
  document.getElementById("cancelCustomJson")?.addEventListener("click", () => customModal?.classList.add("hidden"));
  document.getElementById("submitCustomJson")?.addEventListener("click", () => {
    const customId = document.getElementById("customJsonId")?.value.trim() || "microblog_v1";
    const payload = document.getElementById("customJsonPayload")?.value.trim();
    if (!payload) return showNotification("⚠️ Enter a JSON payload!", false);
    if (!hasHiveKeychain()) return showNotification("❌ Hive Keychain was not detected!", false);
    if (!loggedInUser) return showNotification("🔒 Sign in before broadcasting Custom JSON!", false);

    requestHiveCustomJson(
      loggedInUser,
      customId,
      payload,
      "Broadcast Custom JSON",
      (res) => {
        if (res.success) {
          showNotification("✅ Custom JSON operation broadcast successfully!", true);
          customModal?.classList.add("hidden");
        } else {
          showNotification("❌ Broadcast failed: " + (res.message || "Unknown error"), false);
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

// Shared keyboard/backdrop behavior for dialogs outside the Keychain flow.
function setupSecondaryDialogAccessibility() {
  for (const id of ["customJsonModal", "createChannelModal"]) {
    const modal = document.getElementById(id);
    if (!modal) continue;
    modal.addEventListener("click", event => {
      if (event.target === modal) modal.classList.add("hidden");
    });
    modal.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        modal.classList.add("hidden");
        document.getElementById(id === "createChannelModal" ? "btnCreateChannelTrigger" : "btnMenu")?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...modal.querySelectorAll("button:not([disabled]), input:not([disabled]), textarea:not([disabled])")];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });
  }
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
  const storedUser = localStorage.getItem("hiveUser");
  const safeUser = safeHiveUsername(storedUser);
  setLoggedInUser(safeUser === "unknown" ? null : safeUser);
  handleRoute();
}

// ---------- INICIALIZAÇÃO ----------

// 1. Erros de imagens são tratados sem atributos HTML executáveis.
installImageErrorHandling();

// 2. Monta o HTML no DOM
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
setupSecondaryDialogAccessibility();

// 3. Listeners e modais
setupEventListeners();
setupImageModal();

// 4. Inicia feed e roteamento
handleInitialRoute();

// 5. Escuta mudança de hash
window.addEventListener("hashchange", handleRoute);