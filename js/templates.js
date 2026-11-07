import { escapeAttr } from "./utils.js";
import { proxiedImageUrl } from "./security/media-url.js";

// /js/templates.js

export const TopNavHTML = `
<header class="top-header">
  <div class="top-header-inner">
    <!-- Brand -->
    <div class="top-header-left">
      <a href="#/" class="brand-container" id="brandLogo">
        <div class="brand-icon">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 2L3 9.5V22.5L16 30L29 22.5V9.5L16 2Z" fill="#0f172a"/>
            <path d="M11 10L8 16L11 22H14L11 16L14 10H11Z" fill="#e31337"/>
            <path d="M18 10L15 16L18 22H21L18 16L21 10H18Z" fill="#e31337"/>
            <path d="M23 11.5L20.8 16L23 20.5H25L22.8 16L25 11.5H23Z" fill="#ffffff"/>
          </svg>
        </div>
        <div class="brand-info">
          <span class="brand-title">micro.fair</span>
          <span class="brand-subtitle">Hive • Share • Build</span>
        </div>
      </a>

      <!-- Center Tabs -->
      <nav class="top-nav-tabs">
        <a href="#/" class="top-nav-tab active" data-tab="for-you" id="tabForYou">For you</a>
        <a href="#/followed" class="top-nav-tab" data-tab="following" id="tabFollowing">Following</a>

      </nav>
    </div>

    <!-- Right Controls -->
    <div class="top-header-right">
      <!-- Search -->
      <div class="search-container">
        <svg class="search-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="topSearchInput" class="top-search-input" placeholder="Search posts, people and channels..." aria-label="Search posts, people and channels" autocomplete="off">
        <span class="search-shortcut-badge">Ctrl + K</span>
      </div>

      <!-- Notifications Bell -->
      <button class="icon-btn" id="btnNotificationsTop" title="Notifications" aria-label="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      </button>

      <div class="account-menu-shell">
        <button type="button" id="btnMenu" class="user-menu-trigger"
                aria-haspopup="true" aria-expanded="false" aria-controls="userMenuDropdown"
                aria-label="Open account menu">
          <span class="account-trigger-avatar">
            <span id="accountGuestIcon" class="account-guest-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M9 12h6m-2.5-2.5L15 12l-2.5 2.5"/></svg></span>
            <img id="navUserAvatar" class="user-avatar-sm hidden" src="${escapeAttr(proxiedImageUrl("https://images.hive.blog/u/hive/avatar"))}" alt="" data-avatar-fallback="user">
          </span>
          <span id="accountTriggerLabel" class="account-trigger-label">Sign in</span>
          <svg class="chevron-down-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div id="userMenuDropdown" class="user-menu-dropdown hidden" aria-label="Account options">
          <div class="account-menu-heading">
            <span class="account-menu-heading-kicker">MICRO.FAIR · HIVE</span>
            <strong id="accountMenuName" class="account-menu-name">Your account</strong>
            <span id="accountMenuStatus" class="account-menu-status">Sign in to post and connect</span>
          </div>
          <div class="account-menu-items">
            <button id="menuLogin" type="button" class="dropdown-link account-login-action"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M9 12h6m-2.5-2.5L15 12l-2.5 2.5"/></svg><span>Sign in with Keychain</span><span class="account-login-arrow" aria-hidden="true">→</span></button>
            <span id="accountMenuSectionLabel" class="account-menu-section-label hidden">Your activity</span>
            <a id="menuProfile" href="#/profile" class="dropdown-link hidden"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg><span id="menuUserLabel">My profile</span></a>
            <a id="menuMyVotes" href="#/my-votes" class="dropdown-link hidden"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8.5 10.5 2.5-5.5c.8-1.7 3-1.2 3 1v4h5c1.6 0 2.5 1.5 2.1 2.9L19.5 20H9v-9.5Z"/><path d="M4 10.5h5V20H4z"/></svg><span>My votes</span></a>
            <a id="menuMyComments" href="#/my-comments" class="dropdown-link hidden"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 1-8 8c-1.5 0-2.8-.3-4-1l-4 2 1.5-4A8 8 0 1 1 20 11Z"/></svg><span>My comments</span></a>
            <a id="menuMyReplies" href="#/my-replies" class="dropdown-link hidden"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 9 4 13l5 4M4 13h10a6 6 0 0 1 6 6"/></svg><span>My replies</span></a>
          </div>
          <div class="account-menu-footer">
            <button id="clearCacheButton" type="button" class="dropdown-link account-menu-muted"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3m3 0-1 13H7L6 7"/><path d="M10 11v5m4-5v5"/></svg><span>Clear local cache</span></button>
            <button id="menuLogout" type="button" class="dropdown-link account-menu-logout hidden"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5m10-6H9m6-4 4 4-4 4"/></svg><span>Sign out</span></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</header>
`;

export const LeftSidebarHTML = `
<!-- Main Nav Links -->
<div class="left-nav-group">
  <a href="#/" class="nav-item active" id="leftNavHome">
    <div class="nav-item-content">
      <span class="nav-item-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </span>
      <span class="nav-item-text">Home</span>
    </div>
  </a>

  <a href="#/trending" class="nav-item" id="leftNavExplore">
    <div class="nav-item-content">
      <span class="nav-item-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
        </svg>
      </span>
      <span class="nav-item-text">Explore</span>
    </div>
  </a>

  <a href="#/channels" class="nav-item" id="leftNavChannels">
    <div class="nav-item-content">
      <span class="nav-item-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      </span>
      <span class="nav-item-text">Communities</span>
    </div>
  </a>

  <a href="#/bookmarks" class="nav-item" id="leftNavBookmarks">
    <div class="nav-item-content">
      <span class="nav-item-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
        </svg>
      </span>
      <span class="nav-item-text">Bookmarks</span>
    </div>
  </a>

  <a href="#/profile" class="nav-item" id="leftNavProfile">
    <div class="nav-item-content">
      <span class="nav-item-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </span>
      <span class="nav-item-text">Profile</span>
    </div>
  </a>

  <details class="nav-more" id="leftNavMoreMenu">
    <summary class="nav-item nav-more-summary" id="leftNavMore" aria-label="Show more navigation">
      <span class="nav-item-content">
        <span class="nav-item-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle>
          </svg>
        </span>
        <span class="nav-item-text">More</span>
      </span>
    </summary>
    <div class="nav-more-links">
  <a href="#/custom-json" class="nav-item" id="leftNavCustomJson">
    <div class="nav-item-content">
      <span class="nav-item-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      </span>
      <span class="nav-item-text">Custom JSON</span>
    </div>
  </a>


  <a href="#/notifications" class="nav-item" id="leftNavNotifications">
    <div class="nav-item-content">
      <span class="nav-item-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      </span>
      <span class="nav-item-text">Notifications</span>
    </div>
  </a>


  <a href="#/messages" class="nav-item" id="leftNavMessages">
    <div class="nav-item-content">
      <span class="nav-item-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
      </span>
      <span class="nav-item-text">Messages</span>
    </div>
  </a>
    </div>
  </details>
</div>

<!-- Your Channels Section -->
<div class="sidebar-section-header">
  <span class="sidebar-section-title">Your communities</span>
  <button class="sidebar-add-btn" id="btnAddChannel" title="Add a community" aria-label="Add a community">+</button>
</div>

<div class="channels-list" id="yourChannelsList">
  <!-- Renderizado dinamicamente pelo state.js -->
</div>


`;

export const ComposerHTML = `
<div class="composer-card" id="newPostSection">
  <div class="composer-top" style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <img id="composerAvatar" class="composer-avatar" src="${escapeAttr(proxiedImageUrl("https://images.hive.blog/u/hive/avatar"))}" alt="Avatar" data-avatar-fallback="user">
      <h3 class="composer-title" style="margin: 0;">Create a post</h3>
    </div>
    <div id="composerChannelBadge" class="hidden" style="display: flex; align-items: center; gap: 0.35rem; background: rgba(227, 19, 55, 0.08); border: 1px solid rgba(227, 19, 55, 0.2); padding: 3px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; color: #e31337;">
      <span>Community:</span>
      <span id="composerChannelName">#community</span>
      <button id="btnExitChannelComposer" style="background: none; border: none; color: #e31337; font-weight: 900; font-size: 1rem; cursor: pointer; padding: 0 0 0 4px; line-height: 1;" title="Back to the main feed (micro.fair)">&times;</button>
    </div>
  </div>

  <div class="composer-textarea-wrap">
    <textarea id="newPostContent" class="composer-textarea" rows="3" placeholder="What's on your mind?"></textarea>
  </div>

  <div class="composer-bottom">
    <div class="composer-tools">
      <button class="tool-pill active" data-mode="text" title="Write a post">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
        </svg>
        <span>Text</span>
      </button>

      <button class="tool-pill" data-mode="image" title="Add image">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <span>Image</span>
      </button>

      <button class="tool-pill" data-mode="link" title="Add link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
        <span>Link</span>
      </button>

      <details class="composer-extra">
        <summary class="composer-extra-trigger" aria-label="More tools" title="More tools">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>
          <span>More</span>
        </summary>
        <div class="composer-extra-menu">
      <button class="tool-pill" data-mode="video" title="Add video">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
        <span>Video</span>
      </button>
      <button class="tool-pill" data-mode="file" title="Attach file">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <span>File</span>
      </button>
      <button class="tool-pill" data-mode="json" title="Hive Custom JSON">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
        <span>Custom JSON</span>
      </button>
        </div>
      </details>
    </div>

    <div class="composer-actions-right">
      <span id="charCount" class="char-counter">0 / 2048</span>
      <button id="btnPost" class="btn-post">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        <span>Post</span>
      </button>
    </div>
  </div>
</div>
`;

export const FeedFiltersHTML = `
<div class="feed-filters-bar">
  <div class="filter-tabs" id="feedFilterTabs">
    <button class="filter-pill active" data-filter="all">All</button>
    <button class="filter-pill" data-filter="text">Text</button>
    <button class="filter-pill" data-filter="media">Media</button>
    <button class="filter-pill" data-filter="links">Links</button>
    <button class="filter-pill" data-filter="long">Long posts</button>
  </div>

  <div class="sort-select-wrap">
    <button id="sortDropdownBtn" class="sort-select-btn" aria-label="Change sort order" title="Change sort order">
      <span id="currentSortLabel">Latest</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
  </div>
</div>
`;

export const FeedHeaderHTML = `
<div id="feedHeaderBar" class="view-header-bar hidden">
  <h2 id="pageTitle" class="view-header-title">Feed</h2>
  <div style="display: flex; gap: 0.5rem; align-items: center;">
    <button id="btnRefresh" class="btn-outline-small">Refresh</button>
    <button id="btnBack" class="btn-outline-small hidden">← Back</button>
  </div>
</div>
`;

export const RightSidebarHTML = `
<!-- Trending Tags Card -->
<div class="sidebar-card">
  <div class="sidebar-card-header">
    <h4 class="sidebar-card-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
      </svg>
      <span>Trending</span>
    </h4>
    <button id="btnRefreshTags" class="sidebar-header-link">Refresh</button>
  </div>

  <div id="trendingList" class="trending-tags-list">
    <div style="padding: 1rem 0.5rem; text-align: center; color: var(--text-faint); font-size: 0.8rem;">
      Loading trending topics...
    </div>
  </div>
</div>

<!-- Channels Card -->
<div class="sidebar-card">
  <div class="sidebar-card-header">
    <h4 class="sidebar-card-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      <span>Communities</span>
    </h4>
    <div class="sidebar-channel-actions">
      <a href="#/channels" class="sidebar-header-link">View all</a>
      <button class="sidebar-add-btn" id="btnCreateChannelTrigger" type="button" aria-label="Create community" title="Create community">+</button>
    </div>
  </div>

  <div class="channels-card-list" id="sidebarChannelsList">
    <!-- Renderizado dinamicamente pelo state.js -->
  </div>
</div>

`;

export const LoginModalHTML = `
<div id="loginModal" class="modal-overlay auth-modal-overlay hidden"
     role="dialog" aria-modal="true" aria-labelledby="loginTitle" aria-describedby="loginDescription">
  <div class="modal-dialog auth-dialog">
    <button type="button" class="modal-close auth-modal-close" id="closeLoginModal" aria-label="Close sign-in dialog">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18"/></svg>
    </button>
    <div class="auth-dialog-symbol" aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><path d="M16 2 3 9.5v13L16 30l13-7.5v-13L16 2Z" fill="#262b35"/><path d="m11 10-3 6 3 6h3l-3-6 3-6h-3Zm7 0-3 6 3 6h3l-3-6 3-6h-3Z" fill="#c72e4a"/></svg>
    </div>
    <span class="auth-dialog-eyebrow">WELCOME TO MICRO.FAIR</span>
    <h2 id="loginTitle" class="modal-title auth-dialog-title">Join the conversation</h2>
    <p id="loginDescription" class="auth-dialog-description">Connect your Hive account to post, vote, and be part of the conversation.</p>
    <form id="loginForm" class="auth-login-form" novalidate>
      <label class="auth-field-label" for="loginUsername">Hive username</label>
      <div class="auth-input-wrap">
        <span class="auth-input-prefix" aria-hidden="true">@</span>
        <input type="text" name="username" id="loginUsername" class="modal-input auth-username-input"
               placeholder="your-username" autocomplete="username" autocapitalize="none" spellcheck="false"
               maxlength="24" aria-describedby="authUsernameHint" required>
      </div>
      <p id="authUsernameHint" class="auth-field-hint">Enter your username without the @.</p>
      <button id="confirmLogin" type="submit" class="btn-post auth-submit">
        <span class="auth-submit-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M9 12h6m-2.5-2.5L15 12l-2.5 2.5"/></svg></span>
        <span id="loginSubmitLabel">Continue with Keychain</span>
        <span class="auth-submit-arrow" aria-hidden="true">→</span>
      </button>
    </form>
    <p class="auth-security-note">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
      Your signature stays in Hive Keychain. We never ask for your private keys.
    </p>
    <button id="cancelLoginModal" type="button" class="auth-dismiss-btn">Not now</button>
  </div>
</div>
`;


export const LogoutModalHTML = `
<div id="logoutConfirmModal" class="modal-overlay community-dialog-overlay hidden"
     role="dialog" aria-modal="true" aria-labelledby="logoutDialogTitle"
     aria-describedby="logoutDialogDescription">
  <div class="modal-dialog community-dialog community-dialog-compact">
    <span class="community-dialog-icon community-dialog-icon-muted" aria-hidden="true">
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5m-1-6h10m-4-4 4 4-4 4"/>
      </svg>
    </span>
    <span class="community-dialog-eyebrow">YOUR ACCOUNT</span>
    <h2 id="logoutDialogTitle" class="modal-title community-dialog-title">Sign out of Micro.fair?</h2>
    <p id="logoutDialogDescription" class="community-dialog-description">
      You can sign in again with your Hive account at any time.
    </p>
    <div class="community-dialog-actions">
      <button id="cancelLogout" type="button" class="btn-outline-small community-secondary-btn">Stay signed in</button>
      <button id="confirmLogout" type="button" class="community-danger-btn">Sign out</button>
    </div>
  </div>
</div>
`;

export const CustomJsonModalHTML = `
<div id="customJsonModal" class="modal-overlay community-dialog-overlay hidden"
     role="dialog" aria-modal="true" aria-labelledby="customJsonDialogTitle"
     aria-describedby="customJsonDialogDescription">
  <div class="modal-dialog community-dialog community-dialog-wide">
    <button type="button" class="modal-close community-dialog-close" id="closeCustomJsonModal"
            aria-label="Fechar janela de Custom JSON">&times;</button>
    <span class="community-dialog-icon" aria-hidden="true">
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16"/>
      </svg>
    </span>
    <span class="community-dialog-eyebrow">HIVE TOOLS</span>
    <h2 id="customJsonDialogTitle" class="modal-title community-dialog-title">Send Custom JSON</h2>
    <p id="customJsonDialogDescription" class="community-dialog-description">
      Broadcast a custom operation to the Hive blockchain with your account.
    </p>
    <div class="community-dialog-form">
      <div class="community-field">
        <label for="customJsonId">Operation ID</label>
        <input type="text" id="customJsonId" class="modal-input community-input"
               value="microblog_v1" placeholder="ex: microblog_v1" autocomplete="off">
      </div>
      <div class="community-field">
        <label for="customJsonPayload">JSON payload</label>
        <textarea id="customJsonPayload" class="modal-input community-input community-code-input"
                  rows="5" spellcheck="false" placeholder='{"type": "post", "content": "Hello, Hive!"}'></textarea>
      </div>
    </div>
    <p class="community-dialog-note">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>
      Review your payload before signing. Blockchain operations are permanent.
    </p>
    <div class="community-dialog-actions">
      <button id="cancelCustomJson" type="button" class="btn-outline-small community-secondary-btn">Cancel</button>
      <button id="submitCustomJson" type="button" class="btn-post community-submit-btn">Broadcast operation</button>
    </div>
  </div>
</div>
`;

export const CreateChannelModalHTML = `
<div id="createChannelModal" class="modal-overlay community-dialog-overlay hidden"
     role="dialog" aria-modal="true" aria-labelledby="createChannelDialogTitle"
     aria-describedby="createChannelDialogDescription">
  <div class="modal-dialog community-dialog community-dialog-wide">
    <button type="button" class="modal-close community-dialog-close" id="closeCreateChannelModal"
            aria-label="Close community dialog">&times;</button>
    <span class="community-dialog-icon" aria-hidden="true">#</span>
    <span class="community-dialog-eyebrow">COMMUNITIES · MICRO.FAIR</span>
    <h2 id="createChannelDialogTitle" class="modal-title community-dialog-title">Create a community</h2>
    <p id="createChannelDialogDescription" class="community-dialog-description">
      Bring people together around a topic. Your community will be registered on Hive.
    </p>
    <div class="community-dialog-form">
      <div class="community-field">
        <label for="newChannelName">Community name</label>
        <input type="text" id="newChannelName" class="modal-input community-input"
               placeholder="e.g. Design & Technology" maxlength="50" autocomplete="off">
      </div>
      <div class="community-field">
        <label for="newChannelId">Community ID</label>
        <div class="community-input-prefix-wrap">
          <span class="community-input-prefix" aria-hidden="true">#</span>
          <input type="text" id="newChannelId" class="modal-input community-input"
                 placeholder="design-technology" maxlength="32" autocomplete="off" spellcheck="false"
                 aria-describedby="newChannelIdHelp">
        </div>
        <small id="newChannelIdHelp">Unique identifier used for posts in this community.</small>
      </div>
      <div class="community-field">
        <label for="newChannelDesc">Description <span class="community-field-optional">optional</span></label>
        <textarea id="newChannelDesc" class="modal-input community-input" rows="3"
                  placeholder="What will your community talk about?" maxlength="180"></textarea>
      </div>
    </div>
    <p class="community-dialog-note">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>
      Creation requires a Hive Keychain signature and registers the community on-chain.
    </p>
    <div class="community-dialog-actions">
      <button id="cancelCreateChannel" type="button" class="btn-outline-small community-secondary-btn">Cancel</button>
      <button id="confirmCreateChannel" type="button" class="btn-post community-submit-btn">Create community</button>
    </div>
  </div>
</div>
`;
