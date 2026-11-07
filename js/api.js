// /js/api.js

import { 
    APP_ID, POSTS_CUSTOM_ID, API_URL, VOTE_CUSTOM_ID, VOTE_API_URL, 
    ADMIN_PMUTE_CUSTOM_ID, ADMIN_POST_MUTE_API_URL,
     ADMIN, USER_BLOCK_API_URL, BLOCK_USER_CUSTOM_ID,
      USER_FOLLOW_API_URL, FOLLOW_USER_CUSTOM_ID, LIMIT,
      CHANNELS_CUSTOM_ID, CHANNELS_API_URL
} from "./config.js";
import { parseEmbeddedJson, extractTagsFromText, extractMentionsFromText, showNotification } from "./utils.js";
import { parseChannelCustomId } from "./helpers/channel-id.js";
import { safeHiveUsername } from "./security/safe-values.js";
import { resolveCustomJsonId, normalizeHiveLineChannel, channelFromCustomJsonId } from "./hive/registry.js";
import { onlyHiveLinePosts, mainHiveLinePosts } from "./hive/content-scope.js";
import {
    buildHafsqlCustomJsonUrl,
    withHafsqlCursor,
    fetchHafsqlPayload,
    getHafsqlRows,
} from "./data/hafsql.js";
import {
    PAGE_SIZE, fetchPaginatedOperations,
    syncAuxiliaryData, syncUserTargetOps
} from "./data/sync.js";
import {
    POSTS_CACHE_KEY, VOTES_CACHE_KEY, MUTES_CACHE_KEY, BLOCKS_CACHE_KEY,
    FOLLOWS_CACHE_KEY, CHANNELS_CACHE_KEY,
    getChannelPostsCacheKey
} from "./data/cache-keys.js";
import {
    buildPostPayload, buildVotePayload, buildMutePayload,
    buildUserActionPayload, buildChannelCreatePayload
} from "./hive/protocol.js";
import { hasHiveKeychain, requestHiveCustomJson } from "./hive/keychain.js";
import { processMuteData } from "./hive/moderation.js";
import { readPostCache, writePostCache, clearPostCaches } from "./data/post-cache.js";
import { mergePostSnapshots } from "./data/post-merge.js";
import { showFeedSkeleton, hideFeedSkeleton } from "./ui/feed-loading.js";
import { processChannelsData } from "./helpers/channels.js";
import { POST_CHARACTER_LIMIT } from "./ui/composer-tools.js";
export { processChannelsData } from "./helpers/channels.js";
import { 
    setAllPosts, setVoteCounts, setMutedPostIds, updateTags, renderFeed, 
    allPosts, setBlockedUsers, loggedInUser, setFollowedUsers,
    setChannels, addChannelLocally, channels, activeChannel,
    setChannelPosts, getChannelPosts, addChannelPostLocally, updateChannelsUI,
    channelPostsMap
} from "./state.js";

// Processa os dados de voto brutos da API
function processVoteData(voteData) {
    const finalCounts = {};
    const latestVotes = {};

    if (!Array.isArray(voteData)) return finalCounts;

    voteData.forEach((vote) => {
        const author = vote.required_posting_auths?.[0];
        const timestamp = new Date(vote.timestamp).getTime();
        const voteJson = parseEmbeddedJson(vote.json);
        const postId = voteJson?.content_id;
        const type = voteJson?.type;

        if (!author || !postId || (type !== "upvote" && type !== "downvote")) {
            return;
        }

        if (!latestVotes[postId]) latestVotes[postId] = {};
        if (!latestVotes[postId][author]) {
            latestVotes[postId][author] = { timestamp: 0, type: null };
        }

        if (timestamp > latestVotes[postId][author].timestamp) {
            latestVotes[postId][author] = { timestamp, type };
        }
    });

    for (const postId in latestVotes) {
        let upvote = 0;
        let downvote = 0;
        const userVotes = latestVotes[postId];
        const usersMap = {};
        for (const author in userVotes) {
            const latestType = userVotes[author].type;
            
            if (latestType === "upvote") upvote++;
            else if (latestType === "downvote") downvote++;
            
            if (latestType) {
                // NOVO: Armazena o tipo de voto final para o usuário
                usersMap[author] = latestType; 
            }
        }
        finalCounts[postId] = { upvote, downvote, users: usersMap };
    }
    return finalCounts;
}

function processUserTargetOps(opData, family = "follow") {
    const finalSet = new Set();
    
    if (!Array.isArray(opData)) return finalSet;
    
    // Filtra apenas operações do usuário logado (o Custom ID garante que sejam block/follow)
    const relevantOps = opData.filter(op => 
        op.required_posting_auths?.[0] === loggedInUser
    );

    // Ordena por data (mais antigo primeiro) para que o último estado prevaleça
    relevantOps.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    relevantOps.forEach(op => {
        const json = parseEmbeddedJson(op.json);
        if (!json || typeof json !== "object") return;
        const type = json.type;

        if (typeof json.target_user !== "string") return;
        if (type === family) finalSet.add(json.target_user);
        else if (type === (family === "block" ? "unblock" : "unfollow"))
            finalSet.delete(json.target_user);
    });
    return finalSet;
}

// A função fetchDataInLoop é agora uma versão especializada da genérica para posts
async function fetchDataInLoop() {
    // Usamos a função genérica e filtramos apenas os custom_id corretos
    const allRawPosts = await fetchPaginatedOperations(API_URL);
    return mainHiveLinePosts(allRawPosts);
}
/**
 * Função principal para buscar todos os dados (Posts e Votos).
 * Utiliza cache local e busca reversa (limit=-1000) para sincronizar posts novos.
 */

// /js/api.js (Apenas o bloco fetchData)

let feedSyncPromise = null;
let initialFeedSyncFinished = false;

// Deduplicate overlapping route changes and refreshes on the same Hive sync.
export function hasFinishedFeedSync() {
    return initialFeedSyncFinished;
}

export function fetchData() {
    if (feedSyncPromise) return feedSyncPromise;

    feedSyncPromise = syncFeedData()
        .catch(error => {
            console.error("Could not synchronize the Hive feed:", error);
            const feed = document.getElementById("feed");
            if (feed?.querySelector(".feed-skeletons")) {
                hideFeedSkeleton(feed);
                feed.innerHTML = `
                    <section class="feed-load-error" role="status">
                        <strong>Can't load posts right now</strong>
                        <p>Check your connection and try refreshing the page.</p>
                    </section>`;
            }
            showNotification("Could not sync posts. Please check your connection.", false);
            throw error;
        })
        .finally(() => {
            initialFeedSyncFinished = true;
            feedSyncPromise = null;
            hideFeedSkeleton(document.getElementById("feed"));
        });
    return feedSyncPromise;
}

async function syncFeedData() {
    showFeedSkeleton(document.getElementById("feed"));

    // Read IndexedDB, importing older localStorage data when available.
    const cachedPosts = mainHiveLinePosts(await readPostCache(POSTS_CUSTOM_ID));
    const startIdForSync = cachedPosts[0]?.id ?? null;
    if (cachedPosts.length > 0) setAllPosts(cachedPosts);
    
    // 2. PREPARA AS PROMESSE DE SINCRONIZAÇÃO COMPLETA (PARALELO)
    
    // 2a. Sincronização de Posts (Mantendo a lógica de busca em loop na 1ª carga)
    let postSyncPromise;
    let isCacheHit = !!startIdForSync;

    if (isCacheHit) {
        // Cache existente: consulta reversa para obter apenas as novas operações.
        postSyncPromise = fetchHafsqlPayload(
            withHafsqlCursor(API_URL, { limit: -PAGE_SIZE, start: startIdForSync })
        );
        
    } else {
        // Cache Vazio: Busca completa em loop (mantida para a 1ª carga)
        postSyncPromise = fetchDataInLoop();
    }

    // 2b. Sincronização de Dados Auxiliares (USANDO O NOVO HELPER)
    const voteResPromise = syncAuxiliaryData(VOTES_CACHE_KEY, VOTE_API_URL);
    const muteResPromise = syncAuxiliaryData(MUTES_CACHE_KEY, ADMIN_POST_MUTE_API_URL);
    const channelResPromise = syncAuxiliaryData(CHANNELS_CACHE_KEY, CHANNELS_API_URL);
    
    // Blocos e Follows (Podem ser simples fetch ou o novo helper, dependendo do volume)
    // Usaremos o novo helper para consistência (embora o conditionalFetch original pudesse ser mantido se fosse mais leve)
    // Both actions now use the same namespace; fetch once, then split by type.
    const relationshipResPromise = syncUserTargetOps(BLOCKS_CACHE_KEY, USER_BLOCK_API_URL, loggedInUser);
    
    
    // 3. AGUARDA E PROCESSA TUDO
    
    // A conexão pode cair: continue exibindo os dados já persistidos.
    let networkAvailable = true;
    const safePostSync = postSyncPromise.catch(error => {
        networkAvailable = false;
        console.warn("HAFSQL is unavailable. Using cached posts.", error);
        return [];
    });

    const [
        syncDataRaw, 
        voteDataRaw, 
        muteDataRaw, 
        relationshipDataRaw,
        channelsDataRaw
    ] = await Promise.all([
        safePostSync,
        voteResPromise, // Agora é o array de dados completo
        muteResPromise, // Agora é o array de dados completo
        relationshipResPromise,
        channelResPromise // Sincronização de Canais
    ]);
    
    // --- INÍCIO DO PROCESSAMENTO DE ESTADO ---
    
    // 3a. Consolida e remove duplicatas de páginas sobrepostas.
    const newPosts = mainHiveLinePosts(getHafsqlRows(syncDataRaw));
    const knownIds = new Set(cachedPosts.map(p => String(p.id)));
    const newPostsCount = newPosts.filter(p => !knownIds.has(String(p.id))).length;
    const finalPosts = mergePostSnapshots(newPosts, cachedPosts, { limit: 2000 });

    setAllPosts(finalPosts);
    await writePostCache(POSTS_CUSTOM_ID, finalPosts);

    // 3b. Processa Auxiliares (voteDataRaw, muteDataRaw, etc. são os arrays completos consolidados)
    try {
        const counts = processVoteData(voteDataRaw || []);
        setVoteCounts(counts);
        
        const mutedPostMap = processMuteData(muteDataRaw || []); // Não precisa mais de .rows
        setMutedPostIds(mutedPostMap); 
        
        const blockedSet = processUserTargetOps(relationshipDataRaw || [], "block"); // Não precisa mais de .rows
        setBlockedUsers(blockedSet);
        const followedSet = processUserTargetOps(relationshipDataRaw || [], "follow"); // Não precisa mais de .rows
        setFollowedUsers(followedSet);

        const processedChannels = processChannelsData(channelsDataRaw || []);
        setChannels(processedChannels);

        updateTags(); 
        
    } catch (e) {
        console.error("Failed to process auxiliary data after sync:", e);
    }
    
    // 4. FINALIZAÇÃO
    window.dispatchEvent(new Event('hashchange'));
    // Avoid a success toast every time the user revisits or refreshes a quiet feed.
    if (networkAvailable && newPostsCount > 0) {
        showNotification(`${newPostsCount} new ${newPostsCount === 1 ? "post" : "posts"} synced.`, true);
    } else if (!networkAvailable) {
        showNotification("HAFSQL is offline. Showing available cached posts.", false);
    }
}

// Busca posts de um canal específico na Hive blockchain
export async function fetchChannelPosts(channelId) {
    const cleanId = normalizeHiveLineChannel(channelId);
    if (!cleanId) return [];
    const channelCustomId = resolveCustomJsonId("community-post", {channel:cleanId});

    const cached = onlyHiveLinePosts(await readPostCache(channelCustomId), cleanId);

    if (cached.length > 0) {
        setChannelPosts(cleanId, cached);
    }

    try {
        const url = buildHafsqlCustomJsonUrl(channelCustomId, { limit: PAGE_SIZE });
        const data = await fetchHafsqlPayload(url);
        const rows = getHafsqlRows(data);

        // Filtra estritamente operações onde o Custom JSON ID é exatamente o ID do canal
        const validOps = onlyHiveLinePosts(rows,cleanId);

        const sorted = mergePostSnapshots(validOps, cached, { limit: 1000 });
        setChannelPosts(cleanId, sorted);
        await writePostCache(channelCustomId, sorted);
        return sorted;
    } catch (err) {
        console.error(`Failed to fetch posts from #${cleanId}:`, err);
        return getChannelPosts(cleanId);
    }
}

// Send posts and replies only to HiveLine v2 namespaces.
export function sendPost(content, replyTo = null, channelOverride = null, callbacks = {}) {
    if (typeof content !== "string" || !content.trim() || content.length > POST_CHARACTER_LIMIT) {
        showNotification("Posts must contain 1 to 2,048 characters.", false);
        return false;
    }
    const username = localStorage.getItem("hiveUser");
    if (!username) {
        showNotification("🔒 Sign in with Hive Keychain first!", false);
        return false;
    }

    // Each HiveLine community has a fresh v2 namespace, distinct from legacy
    // community IDs. The optional override can be a slug or a post namespace.
    const targetChannel = channelOverride !== null ? channelOverride : activeChannel;
    const communitySlug = targetChannel
        ? normalizeHiveLineChannel(targetChannel) : "";
    const customId = resolveCustomJsonId(replyTo ? "reply" : "post", {
        channel: targetChannel || POSTS_CUSTOM_ID
    });
    if (!customId) {
        showNotification("⚠️ Invalid community ID. Nothing was broadcast.", false);
        return false;
    }

    const tags = extractTagsFromText(content);
    const mentions = extractMentionsFromText(content);

    // Se estiver num canal específico, garante que a tag esteja indexada no json
    if (communitySlug && !tags.includes(communitySlug)) {
        tags.unshift(communitySlug);
    }

    const json = JSON.stringify(buildPostPayload({
        content, replyTo, channel: customId, mentions, tags
    }));

    const actionText = customId === POSTS_CUSTOM_ID
        ? (replyTo ? "Reply on main feed" : "Post on main feed")
        : (replyTo ? `Reply in #${customId}` : `Post in #${customId}`);

    if (hasHiveKeychain()) {
        requestHiveCustomJson(
            username,
            customId, // On-chain namespace, e.g. hive.micro.
            json,
            actionText,
            (res) => {
                if (res.success) {
                    showNotification(`✅ Successfully posted to #${customId}!`, true);

                    // Never discard a main composer draft after replying elsewhere.
                    if (!replyTo) {
                        const textarea = document.getElementById("newPostContent");
                        if (textarea && textarea.value.trim() === content.trim()) {
                            textarea.value = "";
                            textarea.dispatchEvent(new Event("input", { bubbles: true }));
                        }
                    }

                    // Cria objeto de post local imediato
                    const localPost = {
                        id: `local_${Date.now()}`,
                        custom_id: customId,
                        timestamp: new Date().toISOString(),
                        required_posting_auths: [username],
                        json: json
                    };

                    if (customId === POSTS_CUSTOM_ID) {
                        allPosts.unshift(localPost);
                        // The UI updates immediately; persistent cache runs asynchronously.
                        void writePostCache(POSTS_CUSTOM_ID, allPosts.slice(0, 2000));
                        if (!activeChannel) {
                            renderFeed(allPosts);
                        }
                    } else {
                        addChannelPostLocally(communitySlug, localPost);
                        if (activeChannel === communitySlug) {
                            renderFeed(getChannelPosts(communitySlug));
                        }
                    }

                    updateChannelsUI();
                    updateTags();
                    callbacks?.onSuccess?.(localPost);
                } else {
                    showNotification(`❌ Posting failed: ${res.message || "Operation cancelled"}`, false);
                    callbacks?.onFailure?.(res);
                }
            }
        );
        return true;
    } else {
        showNotification("❌ Hive Keychain was not detected!", false);
        return false;
    }
}

/// Nova Logica

function sendCustomJsonAction(type, targetUser, actionText) {
    const username = localStorage.getItem("hiveUser");
    if (!username) return showNotification("🔒 Sign in to perform this action.", false);
    const target = safeHiveUsername(targetUser);
    if (target === "unknown" || target === safeHiveUsername(username)) {
        return showNotification("Choose another valid Hive account.", false);
    }

    const json = JSON.stringify(buildUserActionPayload(type, target));

    const customId = resolveCustomJsonId(type, { username });
    if (!customId) {
        return showNotification("Internal error: unknown or invalid account operation.", false);
    }
    
    if (hasHiveKeychain()) {
        requestHiveCustomJson(
            username, customId, json, actionText,
            (res) => {
                if (res.success) {
                    showNotification(`✅ Success! ${actionText}`, true);
                    // Recarrega os dados e a view atual
                    fetchData().then(() => {
                        window.dispatchEvent(new Event('hashchange'));
                    });
                } else {
                    showNotification(`❌ Failed to ${type}!`, false);
                }
            }
        );
    } else {
        showNotification("Hive Keychain was not detected!", false);
    }
}


// NOVO: Envia Ação de Bloqueio
export function sendBlock(targetUser) {
    sendCustomJsonAction('block', targetUser, "Block user");
}

// NOVO: Envia Ação de Desbloqueio
export function sendUnblock(targetUser) {
    sendCustomJsonAction('unblock', targetUser, "Unblock user");
}

// NOVO: Envia Ação de Follow
export function sendFollow(targetUser) {
    sendCustomJsonAction('follow', targetUser, "Follow user");
}

// NOVO: Envia Ação de Unfollow
export function sendUnfollow(targetUser) {
    sendCustomJsonAction('unfollow', targetUser, "Unfollow user");
}

// NOVO: Helper para enviar custom_json para ações de dado (Vote, Mute)
function sendDataAction(customId, jsonPayload, actionText, requiresAdmin = false) {
    const username = localStorage.getItem("hiveUser");
    if (!username) return showNotification("🔒 Sign in to perform this action.", false);
    
    if (requiresAdmin && username !== ADMIN) {
        return showNotification("Only administrators can perform this action.", false);
    }
    
    if (hasHiveKeychain()) {
        requestHiveCustomJson(
            username, customId, jsonPayload, actionText,
            (res) => {
                if (res.success) {
                    showNotification(`✅ ${actionText} sent successfully!`, true);
                    // Recarrega os dados e a view atual
                    fetchData().then(() => {
                        window.dispatchEvent(new Event('hashchange'));
                    });
                } else {
                    showNotification(`❌ Failed to perform ${actionText.toLowerCase().split(' ')[0]}!`, false);
                }
            }
        );
    } else {
        showNotification("Hive Keychain was not detected!", false);
    }
}

// ----------------------------------------------------
// Substituições:
// ----------------------------------------------------

export function sendVote(contentId, voteType) {
    const json = JSON.stringify(buildVotePayload(contentId, voteType));
    sendDataAction(resolveCustomJsonId(voteType), json, "Vote");
}

export function sendMute(contentId, cause) {
    const json = JSON.stringify(buildMutePayload(contentId, "mute", cause));
    // O último argumento true indica que é necessária a autoridade de ADMIN
    sendDataAction(resolveCustomJsonId("mute"), json, "Mute post", true); 
}

export function sendUnmute(contentId) {
    const json = JSON.stringify(buildMutePayload(contentId, "unmute"));
    // O último argumento true indica que é necessária a autoridade de ADMIN
    sendDataAction(resolveCustomJsonId("unmute"), json, "Unmute post", true);
}

// Cria um novo canal transmitindo Custom JSON para CHANNELS_CUSTOM_ID
export function sendCreateChannel(channelId, channelName, description = "") {
    const username = localStorage.getItem("hiveUser");
    if (!username) {
        showNotification("🔒 Sign in with Hive Keychain to create a community!", false);
        document.getElementById("loginModal")?.classList.remove("hidden");
        return;
    }

    const cleanId = normalizeHiveLineChannel(channelId);
    if (!cleanId) {
        showNotification("⚠️ Invalid ID: use up to 32 letters, numbers, dots, hyphens, or underscores.", false);
        return;
    }

    const cleanName = (channelName || cleanId).trim();
    if (!cleanName) {
        showNotification("⚠️ Community name is required!", false);
        return;
    }

    const cleanDesc = (description || `Community #${cleanId} created on Hive by @${username}`).trim();

    const payload = buildChannelCreatePayload({
        id: cleanId, name: cleanName, description: cleanDesc,
        createdAt: new Date().toISOString()
    });

    const actionText = `Create community #${cleanId}`;

    if (!hasHiveKeychain()) {
        showNotification("❌ Hive Keychain was not detected in your browser!", false);
        return;
    }

    requestHiveCustomJson(
        username,
        resolveCustomJsonId("create_channel"),
        JSON.stringify(payload),
        actionText,
        (res) => {
            if (res.success) {
                showNotification(`✅ Community #${cleanId} ("${cleanName}") registered on Hive!`, true);

                const newChannelObj = {
                    id: cleanId,
                    name: cleanName,
                    description: cleanDesc,
                    creator: username,
                    timestamp: new Date().toISOString()
                };

                addChannelLocally(newChannelObj);

                try {
                    const cached = JSON.parse(localStorage.getItem(CHANNELS_CACHE_KEY) || "[]");
                    cached.unshift({
                        id: Date.now().toString(),
                        timestamp: new Date().toISOString(),
                        required_posting_auths: [username],
                        custom_id: CHANNELS_CUSTOM_ID,
                        json: JSON.stringify(payload)
                    });
                    localStorage.setItem(CHANNELS_CACHE_KEY, JSON.stringify(cached));
                } catch (e) {
                    console.error("Failed to cache communities:", e);
                }

                document.getElementById("createChannelModal")?.classList.add("hidden");
                window.location.hash = `#/channel/${cleanId}`;
            } else {
                showNotification(`❌ Failed to create community: ${res.message || "Operation cancelled"}`, false);
            }
        }
    );
}

export async function clearAllCaches() {
    // Wait for IndexedDB deletion before any refresh, avoiding stale snapshots.
    const idbCleared = await clearPostCaches();
    localStorage.removeItem(VOTES_CACHE_KEY);
    localStorage.removeItem(MUTES_CACHE_KEY);
    localStorage.removeItem(CHANNELS_CACHE_KEY);

    if (loggedInUser) {
        localStorage.removeItem(`${BLOCKS_CACHE_KEY}.${loggedInUser}`);
        localStorage.removeItem(`${FOLLOWS_CACHE_KEY}.${loggedInUser}`);
    } else {
        localStorage.removeItem(BLOCKS_CACHE_KEY);
        localStorage.removeItem(FOLLOWS_CACHE_KEY);
    }

    // Do not keep the previous data in memory after deleting the persistent cache.
    channelPostsMap.clear();
    setAllPosts([]);

    showNotification(
        idbCleared || !globalThis.indexedDB
            ? "Local cache cleared. Refreshing data..."
            : "Local cache was cleared, but IndexedDB is blocked or unavailable.",
        idbCleared || !globalThis.indexedDB
    );
    await fetchData();
}
