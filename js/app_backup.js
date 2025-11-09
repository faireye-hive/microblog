// /js/app.js
import {
  extractTagsFromText,
  extractMentionsFromText,
  showNotification,
} from "./utils.js"; // Apenas o necessário para sendPost
import { buildRepliesRecursive } from "./render.js";
import { setupAuthListeners, setAuthCallbacks } from "./auth.js";
import {
  NavbarHTML,
  LoginModalHTML,
  NewPostSectionHTML,
  FeedHeaderHTML,
  SidebarHTML,
  LogoutModalHTML,
} from "./templates.js";

// Importa dos novos módulos
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
} from "./api.js";
import {
  handleRoute,
  backToFeed,
  showSinglePost,
  filterByTag,
  currentPage,
} from "./routing.js";
import { allPosts, renderNextBatch, loading, loggedInUser, setLoggedInUser, updateTags } from "./state.js";

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
function showMuteReasonModal(contentId) {
  // Cria um overlay temporário no DOM ou usa um modal pré-existente
  const modalHtml = `
        <div id="muteReasonModal" class="fixed inset-0 bg-black bg-opacity-75 z-[90] flex items-center justify-center p-4">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                <h3 class="text-lg font-semibold mb-4">Mutar Post</h3>
                <p class="mb-3">Insira o motivo para mutar este post:</p>
                <textarea id="muteReasonInput" class="w-full p-2 border rounded resize-none mb-4" rows="3" placeholder="Motivo obrigatório"></textarea>
                <div class="flex justify-end gap-3">
                    <button id="cancelMute" class="px-4 py-2 border rounded small-muted hover:bg-gray-100">
                        Cancelar
                    </button>
                    <button id="confirmMute" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                        Mutar
                    </button>
                </div>
            </div>
        </div>`;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const modal = document.getElementById("muteReasonModal");
  const input = document.getElementById("muteReasonInput");

  // Foca no input
  input.focus();

  // Listener para o botão Confirmar
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

  // Listener para o botão Cancelar
  document.getElementById("cancelMute").addEventListener("click", () => {
    modal.remove();
  });

  // Listener para fechar clicando fora
  modal.addEventListener("click", (e) => {
    if (e.target.id === "muteReasonModal") {
      modal.remove();
    }
  });
}

// ---------- FUNÇÕES DE CONFIGURAÇÃO DO DOM E EVENT LISTENERS ----------

function setupInitialDOM() {
  // Monta a estrutura estática
  document.getElementById("navbar-root").innerHTML = NavbarHTML;
  document.getElementById("modal-root").innerHTML = LoginModalHTML;
  document.getElementById("logout-root").innerHTML = LogoutModalHTML;
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
        if (!text)
          return showNotification("⚠️ Digite algo para responder!", false);
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
      if (!loggedInUser) {
        showNotification(
          "🔒 Você precisa estar logado para mutar/desmutar posts.",
          false
        );
        return;
      }

      const contentId = e.target.dataset.id;
      const type = e.target.dataset.type;

      if (type === "mute") {
        showMuteReasonModal(contentId);
      } else if (type === "unmute") {
        sendUnmute(contentId);
        showNotification("✅ Desmutando post...", true);
      }
    }
    const popoverSelector = ".user-popover-menu"; 

    // NOVO: Lógica para mostrar/esconder o Popover de Perfil
    if (e.target.classList.contains("author-name")) {
      const author = e.target.dataset.author;
      // Busca o popover dentro do mesmo post
      const currentPostCard = e.target.closest(".card");
      const popover = currentPostCard
        ? currentPostCard.querySelector(
            `${popoverSelector}[data-author="${author}"]`
          )
        : null;

      // Esconde todos os outros popovers abertos
      document.querySelectorAll(popoverSelector).forEach((p) => {
        if (p !== popover) {
          p.classList.add("hidden");
        }
      });

      // Mostra/Esconde o popover do autor clicado
      if (popover) {
        popover.classList.toggle("hidden");
      }
    }
    
    // !!! REMOVIDO: A lógica de ação do Popover foi movida para o listener global abaixo
    // !!! REMOVIDO: A lógica de unblock na página de perfil foi movida para o listener global abaixo

  });

  // NOVO: Listener global para AÇÕES de USUÁRIO (Block/Follow) E UNBLOCK de perfil
  document.addEventListener('click', (e) => {
      const popoverSelector = '.user-popover-menu';
      const btn = e.target.closest(`${popoverSelector} button`); // Procura o botão DENTRO de um popover

      // Ações dentro do Popover (Block/Unblock/Follow/Unfollow)
      if (btn) {
          const action = btn.dataset.action;
          const targetUser = btn.dataset.user;
          
          if (action && targetUser) {
              // Esconde o popover após a ação
              btn.closest(popoverSelector)?.classList.add('hidden'); 

              if (action === 'block') {
                  sendBlock(targetUser);
              } else if (action === 'unblock') {
                  sendUnblock(targetUser);
              } else if (action === 'follow') {
                  sendFollow(targetUser);
              } else if (action === 'unfollow') {
                  sendUnfollow(targetUser);
              }
          }
      }
      
      // Ação de Desbloqueio na Página de Perfil (Botão fora do Popover)
      const profileUnblockBtn = e.target.closest('button[data-action="unblock"]');
      if (profileUnblockBtn && currentPage === "profile") { 
          const targetUser = profileUnblockBtn.dataset.user;
          sendUnblock(targetUser);
          // Opcional: Remover o item da lista imediatamente
          profileUnblockBtn.closest('.flex.justify-between').remove();
      }

      // Listener global para fechar Popover ao clicar fora
      // Se o clique não foi no Popover e não foi no nome do autor
      if (!e.target.closest(popoverSelector) && !e.target.classList.contains('author-name')) {
          document.querySelectorAll(popoverSelector).forEach(p => { 
              p.classList.add('hidden');
          });
      }
  });


  // Botões estáticos (Post, Refresh, Back)
  document.getElementById("btnPost").addEventListener("click", () => {
    const text = document.getElementById("newPostContent").value.trim();
    if (!text) return showNotification("⚠️ Digite algo para publicar!", false);
    sendPost(text);
  });

  document.getElementById("btnBack").addEventListener("click", backToFeed);
  document
    .getElementById("btnRefresh")
    .addEventListener("click", refreshCurrentView);
  document
    .getElementById("btnRefreshTags")
    .addEventListener("click", updateTags); // Apenas atualiza a sidebar

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
// Nota: Seu código tinha este bloco duplicado, mantenha apenas um
setAuthCallbacks(
  async (user) => {
    // On Login Success (Agora 'user' recebe o username)

    // 1. CORREÇÃO: ATUALIZA O ESTADO loggedInUser IMEDIATAMENTE
    setLoggedInUser(user);

    // 2. Força a recarga de TODOS os dados (usa o novo usuário no estado)
    await fetchData();

    // 3. Reseta o hash e processa a nova rota
    window.location.hash = "#/";
    handleRoute();
  },
  async () => {
    // On Logout Success

    // 1. MELHORIA: Limpa o estado loggedInUser IMEDIATAMENTE
    setLoggedInUser(null);

    // 2. Força a recarga de TODOS os dados (agora para usuário deslogado)
    await fetchData();

    // 3. Reseta o hash e processa a nova rota
    window.location.hash = "#/";
    handleRoute();
  }
);
setupAuthListeners();

// 3. Configura os Listeners restantes (e modais)
setupEventListeners();
setupImageModal();

// 4. Inicia o carregamento do feed e o roteamento
handleInitialRoute();

// 5. Adiciona listener para botões Voltar/Avançar do navegador e links de Hash
window.addEventListener("hashchange", handleRoute);
