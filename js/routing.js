// /js/routing.js

import { allPosts, voteCounts, renderFeed, BATCH_SIZE } from "./state.js";
import { fetchData } from "./api.js";
import { parseEmbeddedJson, extractTagsFromText } from "./utils.js";
import { buildPostCard, buildRepliesRecursive } from "./render.js";

let currentPage = "feed";

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

function updateNavSelection(newPage) {
    currentPage = newPage;
    const navLinks = document.querySelectorAll("#main-nav a");
    navLinks.forEach((link) => {
        link.classList.remove("text-red-600", "font-bold");
        link.classList.add("small-muted");
    });

    const hashMatch = {
        "feed": "#/", "tag": "#/", "thread": "#/",
        "trending": "#/trending", "active": "#/active",
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
        alert("Post não encontrado!");
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

    // Atualiza UI
    document.getElementById("pageTitle").textContent = `#${tag}`;
    document.getElementById("pageTitle").dataset.tag = tag;
    document.getElementById("btnBack").classList.remove("hidden");
    document.getElementById("newPostSection").classList.remove("hidden");
    document.getElementById("sidebar-root").classList.remove("hidden");
    updateNavSelection("tag");

    renderFeed(filteredPosts);
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

    if (tagMatch) {
        const tag = tagMatch[1];
        filterByTag(tag, false); // Não atualiza o hash
        newPage = "tag";
    } else if (postMatch) {
        const postId = postMatch[1];
        showSinglePost(postId);
        newPage = "thread";
    } else if (path === "/trending") {
        title = "Trending (Votos)";
        //document.getElementById("newPostSection").classList.add("hidden");
        postsToRender = rankPostsByVotes(allPosts);
        newPage = "trending";
    } else if (path === "/active") {
        title = "Active (Comentários)";
        //document.getElementById("newPostSection").classList.add("hidden");
        postsToRender = rankPostsByComments(allPosts);
        newPage = "active";
    } else {
        // Rota Home/Feed Principal
        // (Já configurado para o padrão)
    }

    // Renderiza e atualiza a navegação (se não for tag/thread)
    if (newPage !== "tag" && newPage !== "thread") {
        document.getElementById("pageTitle").textContent = title;
        renderFeed(postsToRender);
        updateNavSelection(newPage);
        window.scrollTo(0, 0);
    }
}