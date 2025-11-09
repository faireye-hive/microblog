// /js/routing.js

import { allPosts, voteCounts, renderFeed, BATCH_SIZE, mutedPostIds, loggedInUser, followedUsers } from "./state.js";
import { fetchData } from "./api.js";
import { parseEmbeddedJson, extractTagsFromText,showNotification } from "./utils.js";
import { buildPostCard, buildRepliesRecursive, buildProfilePage } from "./render.js";
import { rankPostsByVotes, rankPostsByComments } from "./helpers/ranking.js";
import { ADMIN } from "./config.js";

export let currentPage = "feed";

// ---------- Funções de Classificação (Ranking) ----------

// ---------- Funções de View (Navegação) ----------

export function updateNavSelection(newPage) {
    currentPage = newPage;
    const navLinks = document.querySelectorAll("#main-nav a");
    navLinks.forEach((link) => {
        link.classList.remove("text-red-600", "font-bold");
        link.classList.add("small-muted");
    });

    const hashMatch = {
        "feed": "#/", "tag": "#/", "thread": "#/",
        "trending": "#/trending", "active": "#/active",
        "muted": "#/muted",
        "followed": "#/followed",

        "profile": "#/profile", 
        "my-votes": "#/my-votes", 
        "my-comments": "#/my-comments",
        "my-replies": "#/my-replies",
    };
    const targetHash = hashMatch[newPage] || "#/";
    const activeLink = document.querySelector(`a[href="${targetHash}"]`);
    
    if (activeLink) {
        activeLink.classList.add("text-red-600", "font-bold");
        activeLink.classList.remove("small-muted");
    }
}

export function showSinglePost(postId) {
    const post = allPosts.find((p) => p.id == postId);
    if (!post) {
        showNotification("❌ Post não encontrado ou não carregado!", false);
        window.location.hash = ""; // Volta para o feed
        return;
    }

    const feed = document.getElementById("feed");
    feed.innerHTML = "";
    
    feed.appendChild(buildPostCard(post, allPosts, voteCounts));

    const repliesHtml = buildRepliesRecursive(post.id, allPosts);
    const repliesContainer = document.createElement("div");
    repliesContainer.innerHTML = repliesHtml;
    feed.appendChild(repliesContainer);

    // Atualiza UI
    document.getElementById("pageTitle").textContent = "Thread";
    document.getElementById("btnBack").classList.remove("hidden");
    document.getElementById("newPostSection").classList.add("hidden");
    document.getElementById("sidebar-root").classList.add("hidden");
    updateNavSelection("thread");
    window.scrollTo(0, 0);
}

export function filterByTag(tag, pushHistory = true) {
    if (pushHistory) {
        window.location.hash = `/hashtag/${tag}`; // ATENÇÃO: Verifique o prefixo
    }

    const filteredPosts = allPosts.filter((p) => {
        const js = parseEmbeddedJson(p.json);
        return js?.tags?.map((t) => t.toLowerCase()).includes(tag.toLowerCase());
    });
    
    // NOVO: Aplica o filtro de mute para não-admins
    let finalPosts = filteredPosts;
    const isAdmin = loggedInUser === ADMIN;
    
    if (!isAdmin) {
        finalPosts = filteredPosts.filter(p => !mutedPostIds.has(p.id));
    }
    renderFeed(finalPosts); // Usa a lista final filtrada
    window.scrollTo(0, 0);
}

export function backToFeed() {
    window.location.hash = "";
}

// Lógica principal de roteamento
export async function handleRoute() {
    // 1. Busca os dados se ainda não foram carregados
    if (allPosts.length === 0) {
        try {
            await fetchData();
        } catch (e) {
            return; 
        }
    }

    // 2. Analisa o Hash da URL
    const path = window.location.hash.substring(1);
    const tagMatch = path.match(/^\/hashtag\/([a-z0-9-_]+)$/i);
    const postMatch = path.match(/^\/thread\/(\d+)$/i);

    // Configurações de UI Padrão
    document.getElementById("pageTitle").removeAttribute("data-tag");
    
    // Roteamento para Tag ou Thread (que usam funções separadas e saem)
    if (tagMatch) {
        const tag = tagMatch[1];
    
        // Lógica de UI da Rota de Tag (MOVIDA PARA CÁ)
        document.getElementById("pageTitle").textContent = `#${tag}`;
        document.getElementById("pageTitle").dataset.tag = tag;
        document.getElementById("btnBack").classList.remove("hidden");
        document.getElementById("newPostSection").classList.remove("hidden");
        document.getElementById("sidebar-root").classList.remove("hidden");
        updateNavSelection("tag");
        
        filterByTag(tag, false); // Apenas filtra e renderiza
        return; // Retorna para evitar a lógica de renderização abaixo
    } else if (postMatch) {
        showSinglePost(postMatch[1]);
        return; 
    }
    
    // 3. Determina os dados da rota
    const { title, postsToRender, newPage } = getRouteData(path);
    let finalPosts = postsToRender; // Usa uma nova variável para o filtro final
    
    // 4. Lógica de filtro de mute/bloqueio para não-admins
    const isAdmin = loggedInUser === ADMIN;
    
    if (!isAdmin && newPage !== "muted") {
        finalPosts = finalPosts.filter(p => !mutedPostIds.has(p.id));
    }

    // 5. Configuração da UI (Centralizada e Limpa)
    const routesToHideUI = new Set(["profile", "my-votes", "my-comments", "my-replies"]);
    const shouldHideUI = routesToHideUI.has(newPage);

    // O botão 'Voltar' é sempre escondido, exceto em 'tag' e 'thread' (que saem antes)
    document.getElementById("btnBack").classList.add("hidden"); 
    document.getElementById("newPostSection").classList.toggle("hidden", shouldHideUI);
    document.getElementById("sidebar-root").classList.toggle("hidden", shouldHideUI);

    // 6. Renderização
    document.getElementById("pageTitle").textContent = title;

    if (newPage === "profile") {
        document.getElementById("feed").innerHTML = buildProfilePage(); 
    } else {
        renderFeed(finalPosts); 
    }

    updateNavSelection(newPage);
    window.scrollTo(0, 0);
}

function getRouteData(path) {

    const route = {
        title: "Feed",
        postsToRender: allPosts,
        newPage: "feed"
    };

    if (path === "/followed" && loggedInUser) {
        route.title = "Posts de Quem Você Segue";
        route.postsToRender = allPosts.filter(p => followedUsers.has(p.required_posting_auths?.[0]));
        route.newPage = "followed";
    } else if (path === "/profile" && loggedInUser) {
        route.title = "Meu Perfil";
        route.newPage = "profile";
    } else if (path === "/my-votes" && loggedInUser) {
        route.title = "⬆️ Meus Votos";
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
        route.title = "💬 Meus Comentários";
        route.newPage = "my-comments";
        route.postsToRender = allPosts.filter(p => {
            const isMyPost = p.required_posting_auths?.[0] === loggedInUser;
            const isReply = !!parseEmbeddedJson(p.json)?.reply_to;
            return isMyPost && isReply;
        });
        
    } else if (path === "/my-replies" && loggedInUser) {
        route.title = "↩️ Respostas aos Meus Posts";
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

    } else if (path === "/trending") {
        route.title = "Trending (Votos)";
        route.postsToRender = rankPostsByVotes(allPosts);
        route.newPage = "trending";
    } else if (path === "/active") {
        route.title = "Active (Comentários)";
        route.postsToRender = rankPostsByComments(allPosts);
        route.newPage = "active";
    } else if (path === "/muted") {
        route.title = "Mural (Posts Mutados)";
        route.postsToRender = allPosts.filter(p => mutedPostIds.has(p.id));
        route.newPage = "muted";
    } // Se o path não for encontrado, retorna o padrão (Feed)

    return route;
}
