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
          <span class="brand-title">micro.feed</span>
          <span class="brand-subtitle">Hive • Share • Build</span>
        </div>
      </a>

      <!-- Center Tabs -->
      <nav class="top-nav-tabs">
        <a href="#/" class="top-nav-tab active" data-tab="for-you" id="tabForYou">For You</a>
        <a href="#/followed" class="top-nav-tab" data-tab="following" id="tabFollowing">Following</a>
        <a href="#/channels" class="top-nav-tab" data-tab="channels" id="tabChannels">Channels</a>
        <a href="#/trending" class="top-nav-tab" data-tab="explore" id="tabExplore">Explore</a>
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
        <input type="text" id="topSearchInput" class="top-search-input" placeholder="Search posts, users, channels..." autocomplete="off">
        <span class="search-shortcut-badge">Ctrl + K</span>
      </div>

      <!-- Notifications Bell -->
      <button class="icon-btn" id="btnNotificationsTop" title="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span class="notification-badge-dot"></span>
      </button>

      <!-- User Menu Trigger -->
      <div class="user-menu-trigger" id="btnMenu">
        <img id="navUserAvatar" class="user-avatar-sm" src="https://images.hive.blog/u/hive/avatar" alt="Avatar" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 48 48\\'><rect width=\\'48\\' height=\\'48\\' fill=\\'%23cbd5e1\\'/><text x=\\'24\\' y=\\'32\\' font-size=\\'22\\' text-anchor=\\'middle\\'>👤</text></svg>'">
        <svg class="chevron-down-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      <!-- User Dropdown Menu -->
      <div id="userMenuDropdown" class="user-menu-dropdown hidden">
        <button id="menuLogin" class="dropdown-link">
          <span>🔑</span> <span>Entrar via Keychain</span>
        </button>
        <a id="menuProfile" href="#/profile" class="dropdown-link hidden">
          <span>👤</span> <span id="menuUserLabel">Meu Perfil</span>
        </a>
        <a id="menuMyVotes" href="#/my-votes" class="dropdown-link hidden">
          <span>👍</span> <span>Meus Votos</span>
        </a>
        <a id="menuMyComments" href="#/my-comments" class="dropdown-link hidden">
          <span>💬</span> <span>Meus Comentários</span>
        </a>
        <a id="menuMyReplies" href="#/my-replies" class="dropdown-link hidden">
          <span>↩️</span> <span>Minhas Respostas</span>
        </a>
        <div class="dropdown-divider"></div>
        <button id="clearCacheButton" class="dropdown-link">
          <span>🧹</span> <span>Limpar Cache Local</span>
        </button>
        <button id="menuLogout" class="dropdown-link hidden" style="color: #dc2626;">
          <span>🚪</span> <span>Sair</span>
        </button>
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
      <span class="nav-item-text">Channels</span>
    </div>
  </a>

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
    <span class="nav-badge">3</span>
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

  <div class="nav-item" id="leftNavMore" style="cursor: pointer;">
    <div class="nav-item-content">
      <span class="nav-item-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="19" cy="12" r="1"></circle>
          <circle cx="5" cy="12" r="1"></circle>
        </svg>
      </span>
      <span class="nav-item-text">More</span>
    </div>
  </div>
</div>

<!-- Your Channels Section -->
<div class="sidebar-section-header">
  <span class="sidebar-section-title">Your Channels</span>
  <button class="sidebar-add-btn" id="btnAddChannel" title="Add Channel">+</button>
</div>

<div class="channels-list" id="yourChannelsList">
  <!-- Renderizado dinamicamente pelo state.js -->
</div>

<!-- Powered by Hive Promotion Card -->
<div class="hive-promo-card">
  <div class="hive-promo-header">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e31337" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
    <span>Powered by Hive</span>
  </div>
  <p class="hive-promo-text">Real content. Real people. No middlemen.</p>
  <div class="hive-promo-logo">
    <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2L3 9.5V22.5L16 30L29 22.5V9.5L16 2Z" fill="#0f172a"/>
      <path d="M11 10L8 16L11 22H14L11 16L14 10H11Z" fill="#e31337"/>
      <path d="M18 10L15 16L18 22H21L18 16L21 10H18Z" fill="#e31337"/>
    </svg>
    <span>Hive Blockchain</span>
  </div>
</div>
`;

export const ComposerHTML = `
<div class="composer-card" id="newPostSection">
  <div class="composer-top" style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <img id="composerAvatar" class="composer-avatar" src="https://images.hive.blog/u/hive/avatar" alt="Avatar" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 48 48\\'><rect width=\\'48\\' height=\\'48\\' fill=\\'%23cbd5e1\\'/><text x=\\'24\\' y=\\'32\\' font-size=\\'22\\' text-anchor=\\'middle\\'>👤</text></svg>'">
      <h3 class="composer-title" style="margin: 0;">Create Post</h3>
    </div>
    <div id="composerChannelBadge" class="hidden" style="display: flex; align-items: center; gap: 0.35rem; background: rgba(227, 19, 55, 0.08); border: 1px solid rgba(227, 19, 55, 0.2); padding: 3px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; color: #e31337;">
      <span>Canal:</span>
      <span id="composerChannelName">#canal</span>
      <button id="btnExitChannelComposer" style="background: none; border: none; color: #e31337; font-weight: 900; font-size: 1rem; cursor: pointer; padding: 0 0 0 4px; line-height: 1;" title="Voltar ao Canal Principal (micro.fair)">&times;</button>
    </div>
  </div>

  <div class="composer-textarea-wrap">
    <textarea id="newPostContent" class="composer-textarea" rows="3" placeholder="What's on your mind? (Canal Principal micro.fair)"></textarea>
  </div>

  <div class="composer-bottom">
    <div class="composer-tools">
      <button class="tool-pill active" data-mode="text" title="Text post">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
        </svg>
        <span>Text</span>
      </button>

      <button class="tool-pill" data-mode="image" title="Add image URL">
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

      <button class="tool-pill" data-mode="video" title="Video link">
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
    <button class="filter-pill" data-filter="long">Long Posts</button>
  </div>

  <div class="sort-select-wrap">
    <button id="sortDropdownBtn" class="sort-select-btn">
      <span id="currentSortLabel">Recent</span>
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
    <button id="btnRefresh" class="btn-outline-small">Atualizar</button>
    <button id="btnBack" class="btn-outline-small hidden">← Voltar</button>
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
      <span>Trending Tags</span>
    </h4>
    <button id="btnRefreshTags" class="sidebar-header-link">Refresh</button>
  </div>

  <div id="trendingList" class="trending-tags-list">
    <div style="padding: 1rem 0.5rem; text-align: center; color: var(--text-faint); font-size: 0.8rem;">
      Carregando tags em alta...
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
      <span>Channels</span>
    </h4>
    <a href="#/channels" class="sidebar-header-link">View all</a>
  </div>

  <div class="channels-card-list" id="sidebarChannelsList">
    <!-- Renderizado dinamicamente pelo state.js -->
  </div>
</div>

<!-- Create Channel Card -->
<div class="sidebar-card">
  <div class="create-channel-box">
    <div class="create-channel-left">
      <span class="create-channel-plus-icon">+</span>
      <div>
        <h5 class="create-channel-title">Create Channel</h5>
        <p class="create-channel-subtitle">Create a channel for your community, project or topic.</p>
      </div>
    </div>
    <button class="btn-outline-small" id="btnCreateChannelTrigger">Create Channel</button>
  </div>
</div>

<!-- Quick Actions Card -->
<div class="sidebar-card">
  <div class="sidebar-card-header" style="margin-bottom: 0.75rem;">
    <h4 class="sidebar-card-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      <span>Quick Actions</span>
    </h4>
  </div>

  <div class="quick-actions-grid">
    <div class="quick-action-item" data-action="new-post">
      <span class="quick-action-icon">📝</span>
      <span class="quick-action-label">New Post</span>
    </div>
    <div class="quick-action-item" data-action="new-channel">
      <span class="quick-action-icon">#️⃣</span>
      <span class="quick-action-label">New Channel</span>
    </div>
    <div class="quick-action-item" data-action="custom-json">
      <span class="quick-action-icon">&lt;/&gt;</span>
      <span class="quick-action-label">Custom JSON</span>
    </div>
    <div class="quick-action-item" data-action="settings">
      <span class="quick-action-icon">⚙️</span>
      <span class="quick-action-label">Settings</span>
    </div>
  </div>
</div>
`;

export const LoginModalHTML = `
<div id="loginModal" class="modal-overlay hidden">
  <div class="modal-dialog">
    <button class="modal-close" id="closeLoginModal">&times;</button>
    <h3 class="modal-title">Entrar com Hive Keychain</h3>
    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
      Insira seu nome de usuário Hive para assinar com a extensão Keychain.
    </p>

    <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.35rem;">USUÁRIO HIVE</label>
    <input type="text" id="loginUsername" class="modal-input" placeholder="ex: faireye" />

    <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
      <button class="btn-outline-small" onclick="document.getElementById('loginModal').classList.add('hidden')">
        Cancelar
      </button>
      <button id="confirmLogin" class="btn-post">
        Entrar
      </button>
    </div>
  </div>
</div>
`;

export const LogoutModalHTML = `
<div id="logoutConfirmModal" class="modal-overlay hidden">
  <div class="modal-dialog">
    <h3 class="modal-title">Confirmar Saída</h3>
    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
      Deseja realmente sair da sua conta Hive?
    </p>
    <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
      <button id="cancelLogout" class="btn-outline-small">
        Cancelar
      </button>
      <button id="confirmLogout" class="btn-post" style="background: #dc2626;">
        Sair
      </button>
    </div>
  </div>
</div>
`;

export const CustomJsonModalHTML = `
<div id="customJsonModal" class="modal-overlay hidden">
  <div class="modal-dialog" style="max-width: 500px;">
    <button class="modal-close" id="closeCustomJsonModal">&times;</button>
    <h3 class="modal-title">Hive Custom JSON</h3>
    <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">
      Envie operações Custom JSON autenticadas diretamente para a blockchain Hive.
    </p>

    <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.35rem;">CUSTOM ID</label>
    <input type="text" id="customJsonId" class="modal-input" value="microblog_v1" placeholder="ex: microblog_v1" />

    <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.35rem;">JSON PAYLOAD</label>
    <textarea id="customJsonPayload" class="modal-input" rows="4" style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;" placeholder='{"type": "micro_post", "content": "Hello Hive!"}'></textarea>

    <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
      <button class="btn-outline-small" id="cancelCustomJson">Cancelar</button>
      <button id="submitCustomJson" class="btn-post">Transmitir</button>
    </div>
  </div>
</div>
`;

export const CreateChannelModalHTML = `
<div id="createChannelModal" class="modal-overlay hidden">
  <div class="modal-dialog" style="max-width: 480px;">
    <button class="modal-close" id="closeCreateChannelModal">&times;</button>
    
    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
      <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(227, 19, 55, 0.1); color: #e31337; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 800;">#</div>
      <div>
        <h3 class="modal-title" style="margin: 0; font-size: 1.15rem;">Criar Novo Canal</h3>
        <span style="font-size: 0.75rem; color: var(--text-faint);">Registro Descentralizado na Hive Blockchain</span>
      </div>
    </div>

    <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.25rem; line-height: 1.4;">
      Crie um canal público para sua comunidade ou tópico. A operação é gravada na blockchain Hive via <strong>Custom JSON</strong> (<code style="background: var(--bg-card-hover); padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 0.8rem;">micro.fair.channels</code>) e fica acessível permanentemente.
    </p>

    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <div>
        <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.35rem;">
          NOME DO CANAL
        </label>
        <input type="text" id="newChannelName" class="modal-input" placeholder="ex: Linux & Open Source, Rust Brasil, Memes" maxlength="50" autocomplete="off" />
      </div>

      <div>
        <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.35rem;">
          ID / TAG DO CANAL
          <span style="font-weight: 400; font-size: 0.75rem; color: var(--text-faint); margin-left: 0.5rem;">(Identificador único usado nos posts)</span>
        </label>
        <div style="position: relative;">
          <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-weight: 700; color: #94a3b8; font-size: 0.9rem;">#</span>
          <input type="text" id="newChannelId" class="modal-input" style="padding-left: 1.85rem;" placeholder="linux, rust-brasil, memes" maxlength="28" autocomplete="off" />
        </div>
      </div>

      <div>
        <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.35rem;">
          DESCRIÇÃO DO CANAL
        </label>
        <textarea id="newChannelDesc" class="modal-input" rows="2" placeholder="Descreva sobre o que é este canal e o que compartilhar..." maxlength="180"></textarea>
      </div>

      <div style="background: var(--bg-card-hover); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; font-size: 0.775rem; color: var(--text-muted); line-height: 1.45;">
        <span style="font-weight: 700; color: var(--text);">ℹ️ Como funciona:</span>
        O Hive Keychain solicitará sua assinatura de <em>Posting Key</em> para gravar o ID e Nome na Hive. Assim que confirmado na rede, qualquer usuário poderá visualizar e interagir com este canal.
      </div>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
      <button class="btn-outline-small" id="cancelCreateChannel">
        Cancelar
      </button>
      <button id="confirmCreateChannel" class="btn-post">
        <span>Criar Canal na Hive</span>
      </button>
    </div>
  </div>
</div>
`;

