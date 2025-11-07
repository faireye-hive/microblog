// /js/app.js (Arquivo Principal Refatorado)

import {
  extractTagsFromText,
  extractMentionsFromText,
} from "./utils.js"; // Apenas o necessário para sendPost
import { buildRepliesRecursive } from "./render.js";
import { setupAuthListeners, setAuthCallbacks } from "./auth.js";
import {
  NavbarHTML,
  LoginModalHTML,
  NewPostSectionHTML,
  FeedHeaderHTML,
  SidebarHTML,
} from "./templates.js";

// Importa dos novos módulos
import { allPosts, renderNextBatch, loading } from "./state.js";
import { fetchData, sendPost, sendVote,sendMute,sendUnmute } from "./api.js";
import { handleRoute, backToFeed, showSinglePost, filterByTag } from "./routing.js";
import { updateTags,setLoggedInUser } from "./state.js";


// ---------- Funções de UI Locais (Modal) ----------

function setupImageModal() {
  const modalHtml = `
        <div id="imageModal" class="hidden fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4" onclick="this.classList.add('hidden')">
            <div class="relative max-w-full max-h-full">
                <img id="modalImage" src="" class="max-w-full max-h-[90vh] object-contain" onclick="event.stopPropagation()">
                <button class="absolute top-2 right-2 text-white text-3xl font-bold" onclick="document.getElementById('imageModal').classList.add('hidden'); event.stopPropagation();">&times;</button>
            </div>
        </div>
    `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
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

  // Delegação de Eventos no Feed (Reply, Thread, Vote, Imagem, Tag)
  document.getElementById("feed").addEventListener("click", (e) => {
    
    // VIEW THREAD (clicar em 'Em resposta a...')
    if (e.target.classList.contains("view-thread")) {
      const id = e.target.dataset.id;
      showSinglePost(id);
    }

    // THREAD BUTTON (clicar no ícone de 💬)
    if (e.target.classList.contains("thread-btn")) {
      const id = e.target.dataset.id;
      const card = e.target.closest(".card");
      const threadDiv = card.querySelector(".thread");
      if (!threadDiv) return;

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

    // REPLY BUTTON
    if (e.target.classList.contains("reply-btn")) {
      const id = e.target.dataset.id;
      const existing = e.target.closest(".card").querySelector(".reply-form");
      if (existing) {
        existing.remove(); return;
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

    // IMAGE MODAL
    if (e.target.classList.contains("post-image")) {
      const fullSrc = e.target.dataset.fullSrc;
      showImageModal(fullSrc);
    }

    // VOTE BUTTON
    if (e.target.classList.contains("vote-btn")) {
      const contentId = e.target.dataset.id;
      const voteType = e.target.dataset.vote;
      sendVote(contentId, voteType);
    }
    
    // TAG LINK (no corpo do post)
    if (e.target.classList.contains("tag-link")) {
      const tag = e.target.dataset.tag;
      filterByTag(tag); // Usa a função de roteamento
    }

    // NOVO: MUTE/UNMUTE BUTTON
    if (e.target.classList.contains("mute-btn")) {
        // CORREÇÃO: Verificar se o usuário está logado
        const loggedInUser = localStorage.getItem("hiveUser");
        if (!loggedInUser) {
            alert("Você precisa estar logado para mutar/desmutar posts.");
            return; 
        }
        
        const contentId = e.target.dataset.id;
        const type = e.target.dataset.type;

        if (type === "mute") {
            const cause = prompt("Por favor, insira o motivo para mutar este post:");
            if (cause && cause.trim() !== "") {
                sendMute(contentId, cause.trim());
            } else if (cause !== null) { // Só alerta se não clicou em "Cancelar"
                alert("O motivo é obrigatório para mutar.");
            }
        } else if (type === "unmute") {
            sendUnmute(contentId);
        }
    }


  });

  

  // Botões estáticos (Post, Refresh, Back)
  document.getElementById("btnPost").addEventListener("click", () => {
    const text = document.getElementById("newPostContent").value.trim();
    if (!text) return alert("Digite algo!");
    sendPost(text);
  });

  document.getElementById("btnBack").addEventListener("click", backToFeed);
  document.getElementById("btnRefresh").addEventListener("click", refreshCurrentView);
  document.getElementById("btnRefreshTags").addEventListener("click", updateTags); // Apenas atualiza a sidebar

  // Contador de caracteres
  document.getElementById("newPostContent").addEventListener("input", (e) => {
    const len = e.target.value.length;
    document.getElementById(
      "charCount"
    ).textContent = `Characters: ${len} / 512`;
  });

  // TAG LINK (na sidebar)
  document.getElementById("trendingList").addEventListener("click", (e) => {
    const tagSpan = e.target.closest("div").querySelector(".tag-link");
    if (tagSpan) {
      const tag = tagSpan.textContent.replace("#", "");
      filterByTag(tag); // Usa a função de roteamento
    }
  });
}

async function refreshCurrentView() {
    // 1. Força a busca de novos dados
    await fetchData(); 
    handleRoute(); 
}

async function handleInitialRoute() {
  // A lógica de roteamento agora está em handleRoute()
  // Apenas garantimos que o usuário seja verificado no início
  setLoggedInUser(localStorage.getItem("hiveUser")); 
  
  // handleRoute cuidará de chamar fetchData se necessário
  handleRoute();
}

// ---------- Inicialização ----------

// 1. Monta o HTML no DOM
setupInitialDOM();

// 2. Configura a Lógica de Autenticação e seus Listeners
setAuthCallbacks(handleRoute, handleRoute); // Recarrega a view no login/logout
setupAuthListeners();

// 3. Configura os Listeners restantes (e modais)
setupEventListeners();
setupImageModal();

// 3. Configura a Lógica de Autenticação
setAuthCallbacks(
    (user) => { // On Login
        setLoggedInUser(user);
        handleRoute();
    }, 
    () => { // On Logout
        setLoggedInUser(null);
        handleRoute();
    }
);

// 4. Inicia o carregamento do feed e o roteamento
handleRoute();

handleInitialRoute();

// 5. Adiciona listener para botões Voltar/Avançar do navegador e links de Hash
window.addEventListener("hashchange", handleRoute);