import { extractTagsFromText, extractMentionsFromText, parseEmbeddedJson } from "./utils.js";
import { buildPostCard, buildRepliesRecursive } from "./render.js";
import { setupAuthListeners, setAuthCallbacks } from "./auth.js";
import { 
    NavbarHTML, 
    LoginModalHTML, 
    NewPostSectionHTML,
    FeedHeaderHTML,
    SidebarHTML
} from "./templates.js";
import { APP_ID, API_URL } from "./config.js";

// Variáveis de Estado (Centralizadas aqui)
let allPosts = [];
let renderedCount = 0;
const BATCH_SIZE = 50;
let loading = false;

// ---------- Funções de Ação e Estado ----------

async function fetchPosts() {
  const feed = document.getElementById("feed");
  feed.innerHTML =
    '<div class="card p-4 text-center small-muted">Carregando...</div>';
  const res = await fetch(API_URL);
  const data = await res.json();
  allPosts = (Array.isArray(data) ? data : data.rows || [])
    .filter((x) => x.custom_id === APP_ID)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  feed.innerHTML = "";
  renderedCount = 0;
  renderNextBatch();
  updateTags();
}

function renderNextBatch() {
  if (loading) return;
  loading = true;
  const feed = document.getElementById("feed");
  const next = allPosts.slice(renderedCount, renderedCount + BATCH_SIZE);
  // Passamos 'allPosts' para a função de renderização
  next.forEach((p) => feed.appendChild(buildPostCard(p, allPosts)));
  renderedCount += next.length;
  loading = false;
  document
    .getElementById("loadingIndicator")
    .classList.toggle("hidden", renderedCount >= allPosts.length);
}

function updateTags() {
  const map = new Map();
  allPosts.forEach((p) => {
    const js = parseEmbeddedJson(p.json);
    const tags = js?.tags || [];
    tags.forEach((t) => map.set(t, (map.get(t) || 0) + 1));
  });
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  const tList = document.getElementById("trendingList");
  tList.innerHTML = "";
  sorted.forEach(([t, c]) => {
    const div = document.createElement("div");
    div.className = "flex justify-between";
    div.innerHTML = `<span class="text-red-600 font-medium">#${t}</span><span class="inline-code">${c}</span>`;
    tList.appendChild(div);
  });
}

// ---------- Funções de Navegação ----------

function showSinglePost(postId) {
  const post = allPosts.find((p) => p.id == postId);
  if (!post) return alert("Post não encontrado!");
  const feed = document.getElementById("feed");
  feed.innerHTML = "";
  // Passamos 'allPosts' para a função de renderização
  feed.appendChild(buildPostCard(post, allPosts));
  
  // Passamos 'allPosts' para a função de renderização de replies
  const repliesHtml = buildRepliesRecursive(post.id, allPosts); 
  const repliesContainer = document.createElement("div");
  repliesContainer.innerHTML = repliesHtml;
  feed.appendChild(repliesContainer);

  document.getElementById("pageTitle").textContent = "Thread";
  document.getElementById("btnBack").classList.remove("hidden");
  document.getElementById("newPostSection").classList.add("hidden");
  // Assumindo que a sidebar é o 'sidebar-root' no index.html e contém o SidebarHTML
  document.getElementById("sidebar-root").classList.add("hidden"); 
  window.scrollTo(0, 0);
}

function backToFeed() {
  document.getElementById("pageTitle").textContent = "Feed";
  document.getElementById("btnBack").classList.add("hidden");
  document.getElementById("newPostSection").classList.remove("hidden");
  document.getElementById("sidebar-root").classList.remove("hidden");
  fetchPosts();
}

// ---------- Funções de Postagem (Lógica de API) ----------

function sendPost(content, replyTo = null) {
  const username = localStorage.getItem("hiveUser");
  if (!username) return alert("Faça login primeiro!");
  const tags = extractTagsFromText(content);
  const mentions = extractMentionsFromText(content);
  const json = JSON.stringify({
    app: APP_ID,
    v: 1,
    type: replyTo ? "reply" : "post",
    content,
    reply_to: replyTo,
    mentions,
    tags,
  });

  if (window.hive_keychain) {
    window.hive_keychain.requestCustomJson(
      username,
      APP_ID,
      "Posting",
      json,
      replyTo ? "Responder" : "Postar",
      (res) => {
        if (res.success) {
          alert("✅ Enviado com sucesso!");
          document.getElementById("newPostContent").value = ""; // Limpa
          document.getElementById("charCount").textContent = "Characters: 0 / 512";
          fetchPosts();
        } else {
          alert("❌ Erro ao enviar!");
        }
      }
    );
  } else {
    alert("Hive Keychain não detectado!");
  }
}

// ---------- FUNÇÕES DE CONFIGURAÇÃO DO DOM E EVENT LISTENERS ----------

function setupInitialDOM() {
    // Monta a estrutura estática
    document.getElementById('navbar-root').innerHTML = NavbarHTML;
    document.getElementById('modal-root').innerHTML = LoginModalHTML;
    document.getElementById('header-root').innerHTML = FeedHeaderHTML;
    document.getElementById('new-post-root').innerHTML = NewPostSectionHTML;
    document.getElementById('sidebar-root').innerHTML = SidebarHTML;
}

function setupEventListeners() {
    // Scroll infinito
    window.addEventListener("scroll", () => {
      if (loading) return;
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
      if (nearBottom) renderNextBatch();
    });

    // Interações com o Feed (Reply, View Thread)
    document.getElementById("feed").addEventListener("click", (e) => {
      if (e.target.classList.contains("view-thread")) {
        const id = e.target.dataset.id;
        showSinglePost(id);
      }

      if (e.target.classList.contains("thread-btn")) {
        const id = e.target.dataset.id;
        // O card agora é um elemento filho injetado
        const card = e.target.closest(".card"); 
        const threadDiv = card.querySelector(".thread");
        if (!threadDiv.classList.contains("hidden")) {
          threadDiv.classList.add("hidden");
          threadDiv.innerHTML = "";
          return;
        }

        const repliesHtml = buildRepliesRecursive(id, allPosts);
        threadDiv.innerHTML =
          repliesHtml || '<div class="small-muted">Sem replies ainda.</div>';
        threadDiv.classList.remove("hidden");
      }

      if (e.target.classList.contains("reply-btn")) {
        const id = e.target.dataset.id;
        const existing = e.target.closest(".card").querySelector(".reply-form");
        if (existing) {
          existing.remove();
          return;
        }

        const replyBox = document.createElement("div");
        replyBox.className = "reply-form mt-3";
        replyBox.innerHTML = `
          <textarea class="w-full p-2 border rounded mb-2" rows="2" placeholder="Reply..."></textarea>
          <button class="px-3 py-1 bg-red-600 text-white rounded send-reply">Enviar</button>`;
        e.target.closest(".card").appendChild(replyBox);

        replyBox.querySelector(".send-reply").addEventListener("click", () => {
          const text = replyBox.querySelector("textarea").value.trim();
          if (!text) return alert("Digite algo!");
          sendPost(text, parseInt(id));
        });
      }
    });

    // Botões estáticos (Post, Refresh, Back) - Agora existem no DOM
    document.getElementById("btnPost").addEventListener("click", () => {
      const text = document.getElementById("newPostContent").value.trim();
      if (!text) return alert("Digite algo!");
      sendPost(text);
    });
    
    document.getElementById("btnBack").addEventListener("click", backToFeed);
    document.getElementById("btnRefresh").addEventListener("click", fetchPosts);
    document.getElementById("btnRefreshTags").addEventListener("click", updateTags);
    
    document.getElementById("newPostContent").addEventListener("input", (e) => {
      const len = e.target.value.length;
      document.getElementById("charCount").textContent = `Characters: ${len} / 512`;
    });
}

// ---------- Inicialização ----------

// 1. Monta o HTML no DOM
setupInitialDOM(); 

// 2. Configura os Listeners
setupEventListeners(); 

// 3. Configura a Lógica de Autenticação e seus Listeners
setAuthCallbacks(fetchPosts, fetchPosts);
setupAuthListeners();

// 4. Inicia o carregamento do feed
fetchPosts();