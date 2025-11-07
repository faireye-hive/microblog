// /js/templates.js

// --- 1. Topbar (Navbar) ---
export const NavbarHTML = `
  <nav class="fixed top-0 left-0 w-full bg-white shadow-sm z-50">
    <div class="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
      
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2 text-red-600 font-bold text-lg">
          🐝 micro.feed
        </div>
        
        <div id="main-nav" class="flex items-center gap-4">
            <a href="#/" class="text-red-600 font-bold text-sm">Home</a>
            <a href="#/trending" class="small-muted text-sm">Trending</a>
            <a href="#/active" class="small-muted text-sm">Active</a>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <h1 id="pageTitle" class="text-xl font-semibold hidden sm:block">
          Feed
        </h1>
        
        <div class="relative">
          <button
            id="btnMenu"
            class="flex items-center gap-2 px-3 py-1 border rounded text-sm hover:bg-gray-50"
          >
            <span id="menuUserLabel">Login</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          <div
            id="userMenuDropdown"
            class="hidden absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-50 p-2"
          >
            <div id="userMenuContent" class="flex flex-col gap-2">
              <button
                id="menuLogin"
                class="w-full text-left px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                Entrar
              </button>
              <button
                id="menuLogout"
                class="hidden w-full text-left px-3 py-1 text-sm text-red-600 hover:bg-gray-100 rounded"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </nav>
`;
// --- 2. Modal de Login ---
export const LoginModalHTML = `
  <div
    id="loginModal"
    class="fixed inset-0 bg-black/40 flex items-center justify-center hidden z-50"
  >
    <div
      class="bg-white rounded-xl shadow-lg p-6 w-80 text-center relative"
    >
      <button
        id="closeLoginModal"
        class="absolute top-2 right-3 text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
      <h2 class="text-xl font-semibold mb-4 text-red-600">
        Login com Hive Keychain
      </h2>
      <input
        id="loginUsername"
        type="text"
        placeholder="Seu usuário Hive"
        class="w-full border rounded p-2 mb-3 text-center"
      />
      <button
        id="confirmLogin"
        class="w-full bg-red-600 hover:bg-red-700 text-white rounded py-2 font-semibold"
      >
        Entrar
      </button>
      <p class="text-sm text-gray-500 mt-3">
        Será solicitado via Hive Keychain
      </p>
    </div>
  </div>
`;

// --- 3. Seção Novo Post ---
export const NewPostSectionHTML = `
  <section id="newPostSection" class="card p-6">
    <div class="flex gap-4">
      <div
        class="w-12 h-12 rounded-full bg-yellow-300 flex items-center justify-center text-lg font-bold"
      >
        🐝
      </div>
      <div class="flex-1">
        <div class="text-lg font-semibold">New Post</div>
        <textarea
          id="newPostContent"
          rows="3"
          class="w-full mt-3 p-3 border rounded resize-none"
          placeholder="What's on your mind?"
        ></textarea>
        <div class="flex justify-between mt-3 small-muted">
          <span id="charCount">Characters: 0 / 512</span>
          <button
            id="btnPost"
            class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  </section>
`;

// --- 4. Header do Feed (Título e Botões de Ação) ---
export const FeedHeaderHTML = `
  <header class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <h1 id="pageTitle" class="text-3xl font-extrabold">Feed</h1>
    </div>
    <div class="flex items-center gap-2">
      <button
        id="btnBack"
        class="hidden px-3 py-1 border rounded text-sm small-muted"
      >
        ← Voltar
      </button>
      <button
        id="btnRefresh"
        class="px-3 py-1 border rounded text-sm small-muted"
      >
        Refresh
      </button>
    </div>
  </header>
`;

// --- 5. Sidebar (Tags) ---
export const SidebarHTML = `
  <div class="card p-4">
    <div class="flex justify-between">
      <strong>Trending Tags</strong>
      <button id="btnRefreshTags" class="text-sm small-muted">
        Refresh
      </button>
    </div>
    <div id="trendingList" class="mt-3 space-y-2"></div>
  </div>
`;