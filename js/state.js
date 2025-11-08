// /js/state.js

import { buildPostCard } from "./render.js";
import { parseEmbeddedJson } from "./utils.js";
import { ADMIN } from "./config.js";


// ---------- Variáveis de Estado (Centralizadas aqui) ----------
export let allPosts = []; // Todos os posts brutos
export let voteCounts = {}; // Contagem de votos processada
export let allPostsToRender = []; // Lista atual de posts (completa ou filtrada) para renderização
export let renderedCount = 0;
export let loading = false;
export const BATCH_SIZE = 50;

export let loggedInUser = null; // Armazena o usuário logado
export let mutedPostIds = new Map(); // Armazena os IDs dos posts mutados
export let blockedUsers = new Set(); // Armazena os nomes de usuários bloqueados
export let followedUsers = new Set(); // Armazena os nomes de usuários seguidos

// ---------- Funções de Mutação de Estado ----------

export function setAllPosts(posts) {
    allPosts = posts;
}

export function setVoteCounts(counts) {
    voteCounts = counts;
}

export function setLoggedInUser(user) {
    loggedInUser = user;
}

export function setMutedPostIds(newMutedPostMap) {
    mutedPostIds = newMutedPostMap;
}

export function setBlockedUsers(newBlockedSet) {
    blockedUsers = newBlockedSet; // NOVO: Define o conjunto de usuários bloqueados
}

export function setFollowedUsers(newFollowedSet) {
    followedUsers = newFollowedSet; // NOVO: Define o conjunto de usuários seguidos
}

// ---------- Funções de Renderização de Estado ----------

// Inicia a renderização do feed (com paginação)
export function renderFeed(postsToRender) {
    // REVERTIDO: A lógica de filtragem foi movida para routing.js
    
    allPostsToRender = postsToRender;
    renderedCount = 0;

    const feed = document.getElementById("feed");
    feed.innerHTML = "";
    if (allPostsToRender.length === 0) {
        feed.innerHTML = '<div class="card p-4 text-center small-muted">Nenhum post encontrado.</div>';
    }
    renderNextBatch();
}
// Renderiza o próximo lote de posts para scroll infinito
export function renderNextBatch() {
    if (loading) return;
    loading = true;
    const feed = document.getElementById("feed");

    const currentList = allPostsToRender.length > 0 ? allPostsToRender : allPosts;
    const next = currentList.slice(renderedCount, renderedCount + BATCH_SIZE);

    if (next.length === 0 && renderedCount === 0) {
        feed.innerHTML = '<div class="card p-4 text-center small-muted">Nenhum post encontrado.</div>';
    }

    // AQUI ESTÁ A MUDANÇA: O 'mutedPostIds' é passado como 4º argumento.
    next.forEach((p) => feed.appendChild(buildPostCard(p, allPosts, voteCounts, mutedPostIds)));

    renderedCount += next.length;
    loading = false;
    
    document
        .getElementById("loadingIndicator")
        .classList.toggle("hidden", renderedCount >= currentList.length);
}

// Atualiza a lista de tags na sidebar
export function updateTags() {
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