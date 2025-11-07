import {
  extractTagsFromText,
  extractMentionsFromText,
  parseEmbeddedJson,
} from "./utils.js";
import { buildPostCard, buildRepliesRecursive } from "./render.js";
import { setupAuthListeners, setAuthCallbacks } from "./auth.js";
import {
  NavbarHTML,
  LoginModalHTML,
  NewPostSectionHTML,
  FeedHeaderHTML,
  SidebarHTML,
} from "./templates.js";
import { APP_ID, API_URL, VOTE_CUSTOM_ID,VOTE_API_URL } from "./config.js";

// Variáveis de Estado (Centralizadas aqui)
let allPosts = [];
let renderedCount = 0;
const BATCH_SIZE = 50;
let loading = false;
let voteCounts = {}; // NOVO: Estrutura para armazenar as contagens de votos
let allPostsToRender = []; // NOVO: Lista atual de posts (completa ou filtrada) para renderização



// ---------- Funções de Ação e Estado ----------

// NOVO: Função para filtrar posts por tag
// NOVO: Função para buscar todos os dados (Posts e Votos)
async function fetchData() {
    document.getElementById("feed").innerHTML =
        '<div class="card p-4 text-center small-muted">Carregando...</div>';
    
    // 1. Fetch Posts e Votes em paralelo
    const resPromise = fetch(API_URL).then(res => res.json());
    const voteResPromise = fetch(VOTE_API_URL).then(res => res.json());

    const [data, voteDataRaw] = await Promise.all([resPromise, voteResPromise]).catch(e => {
        console.error("Erro ao carregar dados:", e);
        return [{}, {}];
    });
    
    // Processa Posts
    allPosts = (Array.isArray(data) ? data : data.rows || [])
      .filter((x) => x.custom_id === APP_ID)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Processa Votos
    voteCounts = processVoteData(voteDataRaw || []); 

    // Atualiza tags na sidebar (Trending)
    updateTags();
}


// NOVO: Função para iniciar a renderização do feed (com paginação)
function renderFeed(postsToRender) {
  allPostsToRender = postsToRender; 
  renderedCount = 0;
  
  const feed = document.getElementById("feed");
  feed.innerHTML = ""; // Limpa antes de renderizar
  
  renderNextBatch();
}

function filterByTag(tag, pushHistory = true) {
    const currentTag = document.getElementById("pageTitle").dataset.tag;
    
    // Lógica para voltar ao feed principal se clicar na tag já selecionada
    if (currentTag === tag && pushHistory) {
        document.getElementById("pageTitle").removeAttribute("data-tag");
        window.history.pushState(null, "", window.location.pathname.split('/hashtag/')[0]);
        return backToFeed();
    }
    
    // Atualiza a URL apenas se for um clique (não um carregamento inicial)
    if (pushHistory) {
        const newPath = `/hashtag/${tag}`;
        window.history.pushState(null, "", newPath);
    }
    
    const filteredPosts = allPosts.filter((p) => {
        const js = parseEmbeddedJson(p.json);
        // Filtro case-insensitive
        return js?.tags?.map(t => t.toLowerCase()).includes(tag.toLowerCase()); 
    });

    document.getElementById("pageTitle").textContent = `#${tag}`;
    document.getElementById("pageTitle").dataset.tag = tag;
    document.getElementById("btnBack").classList.remove("hidden");
    
    // CORREÇÃO UI: Garante que a seção New Post e a Sidebar estão visíveis
    document.getElementById("newPostSection").classList.remove("hidden");
    document.getElementById("sidebar-root").classList.remove("hidden");

    renderFeed(filteredPosts);
}
// NOVO: Função para lidar com o roteamento inicial (URL direta ou botão Voltar/Avançar)
function handleInitialRoute() {
    // 1. Busca todos os dados primeiro
    fetchData().then(() => {
        // 2. Analisa a URL
        const path = window.location.pathname;
        const tagMatch = path.match(/^\/hashtag\/([a-z0-9]+)$/i);
        
        if (tagMatch) {
            // Acesso direto à URL de tag: filtra (sem alterar history)
            const tag = tagMatch[1];
            filterByTag(tag, false); 
        } else {
            // Rota principal: renderiza o feed completo
            renderFeed(allPosts);
        }
    }).catch(e => {
        document.getElementById("feed").innerHTML =
            '<div class="card p-4 text-center text-red-600">Erro ao carregar dados. Tente atualizar a página.</div>';
    });
}

// NOVO: Função para processar os dados de voto
function processVoteData(voteData) {
  const finalCounts = {};
  
  // Estrutura temporária: Map<postId, Map<username, latestVote>>
  // Ex: { "433581157599152658": { "faireye": { timestamp: '...', type: 'upvote' }, ... } }
  const latestVotes = {}; 

  if (!Array.isArray(voteData)) return finalCounts;
  
  voteData.forEach((vote) => {
    // 1. Extrai o autor (username) e o timestamp
    const author = vote.required_posting_auths?.[0];
    const timestamp = new Date(vote.timestamp).getTime();
    
    // 2. Extrai o JSON e o content_id
    const voteJson = parseEmbeddedJson(vote.json);
    const postId = voteJson?.content_id;
    const type = voteJson?.type; // "upvote" ou "downvote"
    
    // 3. Validação básica
    if (!author || !postId || (type !== 'upvote' && type !== 'downvote')) {
        return; // Ignora dados inválidos
    }
    
    // Inicializa a estrutura para o post se necessário
    if (!latestVotes[postId]) {
      latestVotes[postId] = {};
    }
    
    // Inicializa a estrutura para o usuário neste post
    if (!latestVotes[postId][author]) {
      latestVotes[postId][author] = { timestamp: 0, type: null };
    }
    
    // Verifica se este voto é MAIS RECENTE que o voto atual armazenado para este usuário neste post
    if (timestamp > latestVotes[postId][author].timestamp) {
      latestVotes[postId][author] = { timestamp, type };
    }
  });
  
  // 4. Calcula a contagem final baseada apenas nos votos mais recentes
  for (const postId in latestVotes) {
    let upvote = 0;
    let downvote = 0;
    
    const userVotes = latestVotes[postId];
    
    for (const author in userVotes) {
      const latestType = userVotes[author].type;
      
      if (latestType === 'upvote') {
        upvote++;
      } else if (latestType === 'downvote') {
        downvote++;
      }
      // Se o último voto foi um "unvote" ou outro tipo, ele não é contado.
    }
    
    finalCounts[postId] = { upvote, downvote };
  }

  return finalCounts;
}
async function fetchPosts() { // Agora é a ação de 'Voltar ao Feed Principal'
    await fetchData(); 
    
    document.getElementById("pageTitle").textContent = "Feed";
    document.getElementById("pageTitle").removeAttribute("data-tag");
    
    renderFeed(allPosts);
}


// NOVO: Função para enviar Votos
function sendVote(contentId, voteType) {
    const username = localStorage.getItem("hiveUser");
    if (!username) return alert("Faça login primeiro!");

    const json = JSON.stringify({
        app: APP_ID, 
        v: 1,
        type: voteType, // "upvote" or "downvote"
        content_id: contentId,
    });

    if (window.hive_keychain) {
        window.hive_keychain.requestCustomJson(
            username,
            VOTE_CUSTOM_ID, // "micro.fair.interation"
            "Posting",
            json,
            "Votar",
            (res) => {
                if (res.success) {
                    alert(`✅ Voto '${voteType}' enviado com sucesso!`);
                    // Futuramente, você pode adicionar fetchPosts() aqui para atualizar a contagem de votos.
                } else {
                    alert("❌ Erro ao enviar voto!");
                }
            }
        );
    } else {
        alert("Hive Keychain não detectado!");
    }
}

function renderNextBatch() {
  if (loading) return;
  loading = true;
  const feed = document.getElementById("feed");
  
  const currentList = allPostsToRender.length > 0 ? allPostsToRender : allPosts;
  const next = currentList.slice(renderedCount, renderedCount + BATCH_SIZE);

  next.forEach((p) => feed.appendChild(buildPostCard(p, allPosts, voteCounts)));
  
  renderedCount += next.length;
  loading = false;
  document
    .getElementById("loadingIndicator")
    .classList.toggle("hidden", renderedCount >= currentList.length);
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
    div.innerHTML = `<span class="text-red-600 font-medium cursor-pointer tag-link" data-tag="${t}">#${t}</span><span class="inline-code">${c}</span>`;
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
  feed.appendChild(buildPostCard(post, allPosts, voteCounts));

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

  console.log('this is content: ', content);
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
          document.getElementById("charCount").textContent =
            "Characters: 0 / 512";
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

function setupImageModal() {
    // Insere a estrutura do modal no DOM (pode ser no final do body ou em 'modal-root')
    const modalHtml = `
        <div id="imageModal" class="hidden fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4" onclick="this.classList.add('hidden')">
            <div class="relative max-w-full max-h-full">
                <img id="modalImage" src="" class="max-w-full max-h-[90vh] object-contain" onclick="event.stopPropagation()">
                <button class="absolute top-2 right-2 text-white text-3xl font-bold" onclick="document.getElementById('imageModal').classList.add('hidden'); event.stopPropagation();">&times;</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function showImageModal(src) {
    const modal = document.getElementById("imageModal");
    const img = document.getElementById("modalImage");
    img.src = src;
    modal.classList.remove("hidden");
}

// ---------- FUNÇÕES DE CONFIGURAÇÃO DO DOM E EVENT LISTENERS ----------

function setupInitialDOM() {
  // Monta a estrutura estática
  document.getElementById("navbar-root").innerHTML = NavbarHTML;
  document.getElementById("modal-root").innerHTML = LoginModalHTML;
  document.getElementById("header-root").innerHTML = FeedHeaderHTML;
  document.getElementById("new-post-root").innerHTML = NewPostSectionHTML;
  document.getElementById("sidebar-root").innerHTML = SidebarHTML;
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

    if (e.target.classList.contains("post-image")) {
      const fullSrc = e.target.dataset.fullSrc;
      showImageModal(fullSrc);
    }

    if (e.target.classList.contains("vote-btn")) {
      const contentId = e.target.dataset.id;
      const voteType = e.target.dataset.vote; // "upvote" or "downvote"
      sendVote(contentId, voteType);
    }
    if (e.target.classList.contains("tag-link")) {
      const tag = e.target.dataset.tag;
      filterByTag(tag);
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
  document
    .getElementById("btnRefreshTags")
    .addEventListener("click", updateTags);

  document.getElementById("newPostContent").addEventListener("input", (e) => {
    const len = e.target.value.length;
    document.getElementById(
      "charCount"
    ).textContent = `Characters: ${len} / 512`;
  });
  document.getElementById("trendingList").addEventListener("click", (e) => {
    // O texto da tag está dentro do span com a classe 'text-red-600'
    const tagSpan = e.target.closest("div").querySelector(".text-red-600");
    if (tagSpan) {
        // Remove o '#' e a tag na URL para obter o nome limpo
        const tag = tagSpan.textContent.replace("#", ""); 
        filterByTag(tag);
    }
  });
}

// ---------- Inicialização ----------

// 1. Monta o HTML no DOM
setupInitialDOM();

// 2. Configura os Listeners
setupEventListeners();

setupImageModal();

// 3. Configura a Lógica de Autenticação e seus Listeners
setAuthCallbacks(fetchPosts, fetchPosts);
setupAuthListeners();

// 4. Inicia o carregamento do feed
handleInitialRoute();

// Adiciona listener para botões Voltar/Avançar do navegador
window.addEventListener('popstate', handleInitialRoute);
