// /js/routing.js

import { allPosts, voteCounts, renderFeed, BATCH_SIZE, mutedPostIds, loggedInUser, followedUsers } from "./state.js";
import { fetchData } from "./api.js";
import { parseEmbeddedJson, extractTagsFromText } from "./utils.js";
import { buildPostCard, buildRepliesRecursive, buildProfilePage } from "./render.js";
import { ADMIN } from "./config.js";
import { showNotification  } from "./auth.js";

export let currentPage = "feed";

// ---------- Funções de Classificação (Ranking) ----------

function rankPostsByVotes(posts) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const ranked = posts.map((p) => {
        const postDate = new Date(p.timestamp);
        let score = 0;
        if (postDate >= oneMonthAgo) {
            const upvotes = voteCounts[p.id]?.upvote || 0;
            const downvotes = voteCounts[p.id]?.downvote || 0;
            score = upvotes - downvotes;
        }
        return { ...p, score };
    });
    return ranked.sort((a, b) => b.score - a.score);
}

function rankPostsByComments(posts) {
    // 1. Mapa pai -> [filhos]
    const replyToMap = new Map();
    for (const p of posts) {
        const data = parseEmbeddedJson(p.json);
        const replyTo = data?.reply_to;
        if (replyTo) {
            const parent = Number(replyTo);
            if (!replyToMap.has(parent)) replyToMap.set(parent, []);
            replyToMap.get(parent).push(Number(p.id));
        }
    }
    // 2. Cache
    const cache = new Map();
    function countRepliesRecursively(postId) {
        if (cache.has(postId)) return cache.get(postId);
        const replies = replyToMap.get(postId);
        if (!replies) {
            cache.set(postId, 0); return 0;
        }
        let count = replies.length;
        for (const childId of replies) {
            count += countRepliesRecursively(childId);
        }
        cache.set(postId, count); return count;
    }
    // 3. Calcular e filtrar
    const ranked = posts
        .map((p) => ({
            ...p,
            commentCount: countRepliesRecursively(Number(p.id)),
            isReply: !!parseEmbeddedJson(p.json)?.reply_to,
        }))
        .filter((p) => !p.isReply);
    // 4. Ordenar
    return ranked.sort((a, b) => b.commentCount - a.commentCount);
}

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

    // Atualiza UI
    document.getElementById("pageTitle").textContent = `#${tag}`;
    document.getElementById("pageTitle").dataset.tag = tag;
    document.getElementById("btnBack").classList.remove("hidden");
    document.getElementById("newPostSection").classList.remove("hidden");
    document.getElementById("sidebar-root").classList.remove("hidden");
    updateNavSelection("tag");

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
            return; // Erro já tratado no fetchData
        }
    }

    // 2. Analisa o Hash da URL
    const path = window.location.hash.substring(1); // Remove o '#' inicial
    const tagMatch = path.match(/^\/hashtag\/([a-z0-9-_]+)$/i);
    const postMatch = path.match(/^\/thread\/(\d+)$/i);

    // Configura UI padrão
    document.getElementById("btnBack").classList.add("hidden");
    document.getElementById("newPostSection").classList.remove("hidden");
    document.getElementById("sidebar-root").classList.remove("hidden");
    document.getElementById("pageTitle").removeAttribute("data-tag");
    
    let postsToRender = allPosts;
    let title = "Feed";
    let newPage = "feed";
    let isMural = false;

if (tagMatch) {
        const tag = tagMatch[1];
        filterByTag(tag, false); // Não atualiza o hash
        newPage = "tag";
        return; // Retorna para evitar a lógica de renderização abaixo
    } else if (postMatch) {
        const postId = postMatch[1];
        showSinglePost(postId);
        newPage = "thread";
        return; // Retorna para evitar a lógica de renderização abaixo
    } else if (path === "/followed" && loggedInUser) { // Rota de Seguidos
        title = "Posts de Quem Você Segue";
        postsToRender = allPosts.filter(p => followedUsers.has(p.required_posting_auths?.[0]));
        newPage = "followed";
    } else if (path === "/profile" && loggedInUser) { // Rota de Perfil
        title = "Meu Perfil";
        newPage = "profile";
        
        // REMOVIDA A LÓGICA DE ESCONDER UI E RENDERIZAR AQUI, AGORA ESTÁ NO FINAL
        
    }else if (path === "/my-votes" && loggedInUser) { // NOVO: Meus Votos
        title = "⬆️ Meus Votos";
        newPage = "my-votes";
        
        const votedPostIds = new Set();
        for (const postIdStr in voteCounts) {
            const votes = voteCounts[postIdStr];
            
            // Verifica se o objeto votes existe e se o usuário logado votou.
            // O valor do voto pode ser "upvote" ou "downvote".
            if (votes && votes.users && votes.users[loggedInUser]) {
                votedPostIds.add(postIdStr);
            }
        }
        postsToRender = allPosts.filter(p => votedPostIds.has(String(p.id)));   

    } else if (path === "/my-comments" && loggedInUser) { // NOVO: Meus Comentários
        title = "💬 Meus Comentários";
        newPage = "my-comments";
        
        // Comentários: Posts feitos pelo usuário logado que são respostas
        postsToRender = allPosts.filter(p => {
            const isMyPost = p.required_posting_auths?.[0] === loggedInUser;
            const isReply = !!parseEmbeddedJson(p.json)?.reply_to;
            return isMyPost && isReply;
        });
        
    } else if (path === "/my-replies" && loggedInUser) { // CORREÇÃO: Respostas aos Meus Posts
        title = "↩️ Respostas aos Meus Posts";
        newPage = "my-replies";
        
        // 1. Encontra os IDs de TODOS os posts do usuário logado (top-level e replies).
        // Usamos String(p.id) para garantir a consistência do tipo.
        const myPostIds = new Set(
            allPosts
                .filter(p => p.required_posting_auths?.[0] === loggedInUser) // Filtrar por autor logado
                .map(p => Number(p.id)) 
        );
        
        // 2. Filtra todos os posts que são respostas de outros usuários aos meus posts.
        postsToRender = allPosts.filter(p => {
            const isMyPost = p.required_posting_auths?.[0] === loggedInUser;
            const replyTo = parseEmbeddedJson(p.json)?.reply_to;

            // É uma resposta válida se:
            // a) O autor NÃO sou eu (!isMyPost)
            // b) O post é uma resposta (replyTo é truthy)
            // c) O ID do post pai está na lista de TODOS os meus posts (myPostIds).

            return !isMyPost && replyTo && myPostIds.has(Number(replyTo));
        });

    }  else if (path === "/trending") {
        title = "Trending (Votos)";
        postsToRender = rankPostsByVotes(allPosts);
        newPage = "trending";
    } else if (path === "/active") {
        title = "Active (Comentários)";
        postsToRender = rankPostsByComments(allPosts);
        newPage = "active";
    }else if (path === "/muted") {
        title = "Mural (Posts Mutados)";
        postsToRender = allPosts.filter(p => mutedPostIds.has(p.id));
        newPage = "muted";
        isMural = true;
    } else {
        // Rota Home/Feed Principal (Já configurado para o padrão)
    }
    
    // Lógica de filtro de mute/bloqueio para não-admins
    const isAdmin = loggedInUser === ADMIN;
    
    if (!isAdmin && newPage !== "muted") {
        postsToRender = postsToRender.filter(p => !mutedPostIds.has(p.id));
    }

    // NOVO: Define se a UI lateral/superior deve ser escondida 
    const routesToHideUI = new Set(["profile", "thread", "my-votes", "my-comments", "my-replies"]);
    const shouldHideUI = routesToHideUI.has(newPage);

    // Aplica a lógica de esconder a UI
    document.getElementById("newPostSection").classList.toggle("hidden", shouldHideUI);
    document.getElementById("sidebar-root").classList.toggle("hidden", shouldHideUI);

    // Renderiza e atualiza a navegação
    document.getElementById("pageTitle").textContent = title;

    if (newPage === "profile") {
        // ÚNICA ROTA QUE USA O HTML ESTÁTICO DE PERFIL
        document.getElementById("feed").innerHTML = buildProfilePage(); 
    } else {
        // TODAS AS OUTRAS ROTAS DE FEED (Home, Trending, Followed, Meus Votos, etc.)
        renderFeed(postsToRender); 
    }

    updateNavSelection(newPage);
    window.scrollTo(0, 0);
}
