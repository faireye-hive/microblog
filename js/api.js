// /js/api.js

import { 
    APP_ID, API_URL, VOTE_CUSTOM_ID, VOTE_API_URL, 
    ADMIN_PMUTE_CUSTOM_ID, ADMIN_POST_MUTE_API_URL,
     ADMIN, USER_BLOCK_API_URL, BLOCK_USER_CUSTOM_ID,
      USER_FOLLOW_API_URL, FOLLOW_USER_CUSTOM_ID, LIMIT,
      CHANNELS_CUSTOM_ID, CHANNELS_API_URL
} from "./config.js";
import { parseEmbeddedJson, extractTagsFromText, extractMentionsFromText, showNotification } from "./utils.js";
import { parseChannelCustomId } from "./helpers/channel-id.js";
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
import { readPostCache, writePostCache, clearPostCaches } from "./data/post-cache.js";
import { mergePostSnapshots } from "./data/post-merge.js";
import { processChannelsData } from "./helpers/channels.js";
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

function processUserTargetOps(opData) {
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

        if (json.target_user) {
            if (type === "block" || type === "follow") {
                finalSet.add(json.target_user);
            } else if (type === "unblock" || type === "unfollow") {
                finalSet.delete(json.target_user);
            }
        }
    });
    return finalSet;
}

// A função fetchDataInLoop é agora uma versão especializada da genérica para posts
async function fetchDataInLoop() {
    // Usamos a função genérica e filtramos apenas os custom_id corretos
    const allRawPosts = await fetchPaginatedOperations(API_URL);
    return allRawPosts.filter((x) => x.custom_id === APP_ID);
}
/**
 * Função principal para buscar todos os dados (Posts e Votos).
 * Utiliza cache local e busca reversa (limit=-1000) para sincronizar posts novos.
 */

// /js/api.js (Apenas o bloco fetchData)

export async function fetchData() {
    document.getElementById("feed").innerHTML =
        '<div class="card p-4 text-center small-muted">Carregando...</div>';

    // 1. Lê IndexedDB; na primeira execução importa o cache antigo do localStorage.
    const cachedPosts = await readPostCache(APP_ID);
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
    const blockResPromise = syncUserTargetOps(BLOCKS_CACHE_KEY, USER_BLOCK_API_URL, loggedInUser);
    const followResPromise = syncUserTargetOps(FOLLOWS_CACHE_KEY, USER_FOLLOW_API_URL, loggedInUser);
    
    
    // 3. AGUARDA E PROCESSA TUDO
    
    // A conexão pode cair: continue exibindo os dados já persistidos.
    let networkAvailable = true;
    const safePostSync = postSyncPromise.catch(error => {
        networkAvailable = false;
        console.warn("HAFSQL indisponível; utilizando publicações em cache.", error);
        return [];
    });

    const [
        syncDataRaw, 
        voteDataRaw, 
        muteDataRaw, 
        blockDataRaw, 
        followDataRaw,
        channelsDataRaw
    ] = await Promise.all([
        safePostSync,
        voteResPromise, // Agora é o array de dados completo
        muteResPromise, // Agora é o array de dados completo
        blockResPromise, // Agora é o array de dados completo
        followResPromise, // Agora é o array de dados completo
        channelResPromise // Sincronização de Canais
    ]);
    
    // --- INÍCIO DO PROCESSAMENTO DE ESTADO ---
    
    // 3a. Consolida e remove duplicatas de páginas sobrepostas.
    const newPosts = getHafsqlRows(syncDataRaw)
        .filter(op => op.custom_id === APP_ID);
    const knownIds = new Set(cachedPosts.map(p => String(p.id)));
    const newPostsCount = newPosts.filter(p => !knownIds.has(String(p.id))).length;
    const finalPosts = mergePostSnapshots(newPosts, cachedPosts, { limit: 2000 });

    setAllPosts(finalPosts);
    await writePostCache(APP_ID, finalPosts);

    // 3b. Processa Auxiliares (voteDataRaw, muteDataRaw, etc. são os arrays completos consolidados)
    try {
        const counts = processVoteData(voteDataRaw || []);
        setVoteCounts(counts);
        
        const mutedPostMap = processMuteData(muteDataRaw || []); // Não precisa mais de .rows
        setMutedPostIds(mutedPostMap); 
        
        const blockedSet = processUserTargetOps(blockDataRaw || []); // Não precisa mais de .rows
        setBlockedUsers(blockedSet);
        const followedSet = processUserTargetOps(followDataRaw || []); // Não precisa mais de .rows
        setFollowedUsers(followedSet);

        const processedChannels = processChannelsData(channelsDataRaw || []);
        setChannels(processedChannels);

        updateTags(); 
        
    } catch (e) {
        console.error("Erro ao processar dados auxiliares pós-sincronização:", e);
    }
    
    // 4. FINALIZAÇÃO
    window.dispatchEvent(new Event('hashchange'));
    showNotification(
        networkAvailable
          ? `✅ Dados carregados e sincronizados. (${newPostsCount} novos posts)`
          : "⚠️ Sem conexão com a HAFSQL. Exibindo o cache disponível.",
        networkAvailable
    );
}

// Busca posts de um canal específico na Hive blockchain
export async function fetchChannelPosts(channelId) {
    const cleanId = parseChannelCustomId(channelId);
    if (!cleanId) return [];

    const cached = await readPostCache(cleanId);

    if (cached.length > 0) {
        setChannelPosts(cleanId, cached);
    }

    try {
        const url = buildHafsqlCustomJsonUrl(cleanId, { limit: PAGE_SIZE });
        const data = await fetchHafsqlPayload(url);
        const rows = getHafsqlRows(data);

        // Filtra estritamente operações onde o Custom JSON ID é exatamente o ID do canal
        const validOps = rows.filter(op => (op.custom_id || "").toLowerCase() === cleanId);

        const sorted = mergePostSnapshots(validOps, cached, { limit: 1000 });
        setChannelPosts(cleanId, sorted);
        await writePostCache(cleanId, sorted);
        return sorted;
    } catch (err) {
        console.error(`Erro ao buscar posts do canal ${cleanId}:`, err);
        return getChannelPosts(cleanId);
    }
}

// Envia um novo Post ou Reply (para o canal ativo ou para o canal principal 'micro.fair')
export function sendPost(content, replyTo = null, channelOverride = null) {
    const username = localStorage.getItem("hiveUser");
    if (!username) return showNotification("🔒 Conecte sua conta via Hive Keychain primeiro!", false);

    // Se estiver navegando em um canal específico, o Custom JSON é emitido DIRETAMENTE para o ID do canal!
    // Exemplo: se estiver no canal 'fairmemes', o custom_id do blockchain Hive será 'fairmemes'.
    // Se for o canal principal, usa APP_ID ('micro.fair').
    const targetChannel = channelOverride !== null ? channelOverride : activeChannel;
    const customId = parseChannelCustomId(targetChannel || APP_ID);
    if (!customId) {
        showNotification("⚠️ Identificador de canal inválido. Nenhuma operação foi enviada.", false);
        return;
    }

    const tags = extractTagsFromText(content);
    const mentions = extractMentionsFromText(content);

    // Se estiver num canal específico, garante que a tag esteja indexada no json
    if (customId !== APP_ID && !tags.includes(customId)) {
        tags.unshift(customId);
    }

    const json = JSON.stringify(buildPostPayload({
        content, replyTo, channel: customId, mentions, tags
    }));

    const actionText = customId === APP_ID
        ? (replyTo ? "Responder no Feed Principal" : "Postar no Feed Principal")
        : (replyTo ? `Responder em #${customId}` : `Postar em #${customId}`);

    if (hasHiveKeychain()) {
        requestHiveCustomJson(
            username,
            customId, // On-chain namespace, e.g. hive.micro.
            json,
            actionText,
            (res) => {
                if (res.success) {
                    showNotification(`✅ Publicado com sucesso no canal #${customId}!`, true);

                    const textarea = document.getElementById("newPostContent");
                    if (textarea) textarea.value = "";
                    const charCount = document.getElementById("charCount");
                    if (charCount) charCount.textContent = "0 / 2048";

                    // Cria objeto de post local imediato
                    const localPost = {
                        id: `local_${Date.now()}`,
                        custom_id: customId,
                        timestamp: new Date().toISOString(),
                        required_posting_auths: [username],
                        json: json
                    };

                    if (customId === APP_ID) {
                        allPosts.unshift(localPost);
                        // The UI updates immediately; persistent cache runs asynchronously.
                        void writePostCache(APP_ID, allPosts.slice(0, 2000));
                        if (!activeChannel) {
                            renderFeed(allPosts);
                        }
                    } else {
                        addChannelPostLocally(customId, localPost);
                        if (activeChannel === customId) {
                            renderFeed(getChannelPosts(customId));
                        }
                    }

                    updateChannelsUI();
                    updateTags();
                } else {
                    showNotification(`❌ Erro ao postar: ${res.message || "Operação cancelada"}`, false);
                }
            }
        );
    } else {
        showNotification("❌ Hive Keychain não detectado!", false);
    }
}

function processMuteData(muteData) {
    // Retorna um Map: Map<postId, {cause: string, admin: string}>
    const finalMutes = new Map(); 

    if (!Array.isArray(muteData)) return finalMutes;

    muteData
        // Ordena para que a última operação (mute/unmute) prevaleça
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .forEach((muteOp) => {
            // A custom_json ID is not access control. Only the configured
            // administrator's signed operations may modify the mute state.
            const signers = [
                ...(muteOp.required_posting_auths || []),
                ...(muteOp.required_auths || [])
            ];
            if (!signers.includes(ADMIN)) return;
            if (muteOp.custom_id && muteOp.custom_id !== ADMIN_PMUTE_CUSTOM_ID) return;

            const muteJson = parseEmbeddedJson(muteOp.json);
            const postId = muteJson?.content_id;
            const type = muteJson?.type; // 'mute' ou 'unmute'
            const cause = muteJson?.cause || 'Motivo não especificado'; // Pega o motivo
            const admin = muteOp.required_posting_auths?.[0] || 'admin';
            
            if (!postId) return;

            if (type === 'mute') {
                // Armazena o objeto de mute, incluindo o motivo e quem mutou
                finalMutes.set(postId, { cause: cause, admin: admin });
            } else if (type === 'unmute') {
                // Remove do mapa se for um 'unmute'
                finalMutes.delete(postId);
            }
        });

    return finalMutes;
}

/// Nova Logica

function sendCustomJsonAction(type, targetUser, actionText) {
    const username = localStorage.getItem("hiveUser");
    if (!username) return showNotification("🔒 Faça login para realizar esta ação.", false);

    const json = JSON.stringify(buildUserActionPayload(type, targetUser));

    let customId;
    if (type === 'block' || type === 'unblock') {
        customId = `${APP_ID}.${username}.block`;
    } else if (type === 'follow' || type === 'unfollow') {
        customId = FOLLOW_USER_CUSTOM_ID.replace('{user}', username);
    } else {
        return showNotification("Erro interno: Ação desconhecida.", false);
    }
    
    if (hasHiveKeychain()) {
        requestHiveCustomJson(
            username, customId, json, actionText,
            (res) => {
                if (res.success) {
                    showNotification(`✅ Sucesso! ${actionText}`, true);
                    // Recarrega os dados e a view atual
                    fetchData().then(() => {
                        window.dispatchEvent(new Event('hashchange'));
                    });
                } else {
                    showNotification(`❌ Erro ao ${type}!`, false);
                }
            }
        );
    } else {
        showNotification("Hive Keychain não detectado!", false);
    }
}


// NOVO: Envia Ação de Bloqueio
export function sendBlock(targetUser) {
    sendCustomJsonAction('block', targetUser, "Bloquear Usuário");
}

// NOVO: Envia Ação de Desbloqueio
export function sendUnblock(targetUser) {
    sendCustomJsonAction('unblock', targetUser, "Desbloquear Usuário");
}

// NOVO: Envia Ação de Follow
export function sendFollow(targetUser) {
    sendCustomJsonAction('follow', targetUser, "Seguir Usuário");
}

// NOVO: Envia Ação de Unfollow
export function sendUnfollow(targetUser) {
    sendCustomJsonAction('unfollow', targetUser, "Deixar de Seguir");
}

// NOVO: Helper para enviar custom_json para ações de dado (Vote, Mute)
function sendDataAction(customId, jsonPayload, actionText, requiresAdmin = false) {
    const username = localStorage.getItem("hiveUser");
    if (!username) return showNotification("🔒 Faça login para realizar esta ação.", false);
    
    if (requiresAdmin && username !== ADMIN) {
        return showNotification("Apenas administradores podem realizar esta ação.", false);
    }
    
    if (hasHiveKeychain()) {
        requestHiveCustomJson(
            username, customId, jsonPayload, actionText,
            (res) => {
                if (res.success) {
                    showNotification(`✅ ${actionText} enviado com sucesso!`, true);
                    // Recarrega os dados e a view atual
                    fetchData().then(() => {
                        window.dispatchEvent(new Event('hashchange'));
                    });
                } else {
                    showNotification(`❌ Erro ao ${actionText.toLowerCase().split(' ')[0]}!`, false);
                }
            }
        );
    } else {
        showNotification("Hive Keychain não detectado!", false);
    }
}

// ----------------------------------------------------
// Substituições:
// ----------------------------------------------------

export function sendVote(contentId, voteType) {
    const json = JSON.stringify(buildVotePayload(contentId, voteType));
    sendDataAction(VOTE_CUSTOM_ID, json, "Votar");
}

export function sendMute(contentId, cause) {
    const json = JSON.stringify(buildMutePayload(contentId, "mute", cause));
    // O último argumento true indica que é necessária a autoridade de ADMIN
    sendDataAction(ADMIN_PMUTE_CUSTOM_ID, json, "Mutar Post", true); 
}

export function sendUnmute(contentId) {
    const json = JSON.stringify(buildMutePayload(contentId, "unmute"));
    // O último argumento true indica que é necessária a autoridade de ADMIN
    sendDataAction(ADMIN_PMUTE_CUSTOM_ID, json, "Desmutar Post", true);
}

// Cria um novo canal transmitindo Custom JSON para CHANNELS_CUSTOM_ID
export function sendCreateChannel(channelId, channelName, description = "") {
    const username = localStorage.getItem("hiveUser");
    if (!username) {
        showNotification("🔒 Conecte sua conta via Hive Keychain para criar um canal!", false);
        document.getElementById("loginModal")?.classList.remove("hidden");
        return;
    }

    const cleanId = parseChannelCustomId(channelId);
    if (!cleanId) {
        showNotification("⚠️ ID inválido: use até 32 caracteres (letras, números, ponto, hífen ou _).", false);
        return;
    }

    const cleanName = (channelName || cleanId).trim();
    if (!cleanName) {
        showNotification("⚠️ O nome do canal é obrigatório!", false);
        return;
    }

    const cleanDesc = (description || `Canal #${cleanId} criado na blockchain Hive por @${username}`).trim();

    const payload = buildChannelCreatePayload({
        id: cleanId, name: cleanName, description: cleanDesc,
        createdAt: new Date().toISOString()
    });

    const actionText = `Criar Canal #${cleanId}`;

    if (!hasHiveKeychain()) {
        showNotification("❌ Hive Keychain não detectado no navegador!", false);
        return;
    }

    requestHiveCustomJson(
        username,
        CHANNELS_CUSTOM_ID,
        JSON.stringify(payload),
        actionText,
        (res) => {
            if (res.success) {
                showNotification(`✅ Canal #${cleanId} ("${cleanName}") registrado na blockchain Hive!`, true);

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
                    console.error("Erro ao salvar cache de canais:", e);
                }

                document.getElementById("createChannelModal")?.classList.add("hidden");
                window.location.hash = `#/channel/${cleanId}`;
            } else {
                showNotification(`❌ Falha ao criar canal: ${res.message || "Operação cancelada"}`, false);
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
            ? "🗑️ Cache limpo! Recarregando dados..."
            : "⚠️ Cache local limpo; o IndexedDB está bloqueado ou indisponível.",
        idbCleared || !globalThis.indexedDB
    );
    await fetchData();
}
