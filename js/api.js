// /js/api.js

import { 
    APP_ID, API_URL, VOTE_CUSTOM_ID, VOTE_API_URL, 
    ADMIN_PMUTE_CUSTOM_ID, ADMIN_POST_MUTE_API_URL,
     ADMIN, USER_BLOCK_API_URL, BLOCK_USER_CUSTOM_ID,
      USER_FOLLOW_API_URL, FOLLOW_USER_CUSTOM_ID, LIMIT, 
} from "./config.js";
import { parseEmbeddedJson, extractTagsFromText, extractMentionsFromText, showNotification } from "./utils.js";
import { setAllPosts, setVoteCounts, setMutedPostIds, updateTags, renderFeed, allPosts, setBlockedUsers,loggedInUser,setFollowedUsers } from "./state.js";

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

// NOVO: Função para abstrair a lógica de busca condicional
async function conditionalFetch(urlTemplate, customId, defaultValue = []) {
    if (!loggedInUser) {
        return defaultValue;
    }
    try {
        // Substitui o placeholder no template se necessário
        const url = urlTemplate
            .replace(BLOCK_USER_CUSTOM_ID, `${APP_ID}.${loggedInUser}.block`)
            .replace('{user}', loggedInUser); 
            
        const res = await fetch(url);
        return res.json();
    } catch (e) {
        console.error(`Erro ao buscar dados para ${customId}:`, e);
        return defaultValue;
    }
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

const LOCAL_STORAGE_KEY = 'hiveAppPostsCache';
const API_LIMIT = 1000; 
const MAX_OPS_TO_FETCH = 20000; // Limite alto para garantir completude dos votos, mutes, etc.


const POSTS_CACHE_KEY = 'hiveAppPostsCache';
const VOTES_CACHE_KEY = 'hiveAppVotesCache';
const MUTES_CACHE_KEY = 'hiveAppMutesCache';
// Opcional, dependendo da necessidade de cache para Blocks/Follows
const BLOCKS_CACHE_KEY = 'hiveAppBlocksCache'; 
const FOLLOWS_CACHE_KEY = 'hiveAppFollowsCache'; 


// /js/api.js

async function syncAndGetTargetOps(baseCacheKey, urlTemplate, customId) {
    // É crucial checar o login aqui
    if (!loggedInUser) {
        return []; 
    }
    
    // 1. Constrói a CHAVE DE CACHE EXCLUSIVA PARA ESTE USUÁRIO
    const userSpecificCacheKey = `${baseCacheKey}.${loggedInUser}`;

    // 2. Constrói a URL para a API
    const finalUrl = urlTemplate
        .replace('{user}', loggedInUser); 
        
    // 3. Chama a lógica de cache e sincronização com a chave específica
    try {
        // Passamos a chave específica do usuário
        const data = await syncAndGetAuxData(userSpecificCacheKey, finalUrl); 
        return data;
    } catch (e) {
        console.error(`Erro ao sincronizar target ops para ${customId}:`, e);
        return [];
    }
}

/**
 * Carrega dados auxiliares do cache, sincroniza apenas os novos (limit=-1000)
 * e retorna o conjunto consolidado.
 * @param {string} cacheKey - Chave de LocalStorage (VOTES_CACHE_KEY, etc.)
 * @param {string} apiUrl - URL da API (VOTE_API_URL, ADMIN_POST_MUTE_API_URL, etc.)
 * @returns {Promise<Array<Object>>} - Dados auxiliares consolidados
 */
async function syncAndGetAuxData(cacheKey, apiUrl) {
    let cachedData = [];
    let startIdForSync = null;

    // 1. Tenta carregar do cache
    try {
        const cachedJson = localStorage.getItem(cacheKey);
        if (cachedJson) {
            cachedData = JSON.parse(cachedJson);
            // O registro mais novo está no índice 0
            if (cachedData.length > 0) {
                startIdForSync = cachedData[0].id;
            }
        }
    } catch (e) {
        console.error(`Erro ao carregar cache ${cacheKey}:`, e);
    }

    let allUpdatedData = [...cachedData];
    let syncApiUrl = apiUrl; 

    try {
        // 2. Constrói a URL para Sincronização
        if (startIdForSync) {
            // Se o cache existir, faz a busca reversa (sync)
            const url = new URL(apiUrl);
            url.searchParams.delete('limit');
            url.searchParams.set('limit', '-1000'); // Busca reversa rápida
            url.searchParams.set('start', startIdForSync);
            syncApiUrl = url.toString();
        } 
        // Se startIdForSync for null (primeira carga), syncApiUrl usa a URL padrão (limit=1000)

        const res = await fetch(syncApiUrl);
        const syncDataRaw = await res.json();
        
        const newRecords = (Array.isArray(syncDataRaw) ? syncDataRaw : syncDataRaw.rows || []);

        // 3. Consolidação
        if (newRecords.length > 0) {
            // Concatena os novos (mais recentes) na frente do cache antigo
            allUpdatedData = newRecords.concat(cachedData);
            
            // Limita o tamanho total do cache (ex: 20000 operações de voto/mute)
            allUpdatedData = allUpdatedData.slice(0, 20000); 
            
            // Salva o novo cache
            localStorage.setItem(cacheKey, JSON.stringify(allUpdatedData));
        } else if (!startIdForSync) {
             // Se não havia cache e não vieram dados, salvamos um array vazio para o futuro
             localStorage.setItem(cacheKey, JSON.stringify([]));
        }

    } catch (e) {
        console.error(`Erro ao sincronizar dados auxiliares para ${cacheKey}:`, e);
        // Em caso de falha, retorna os dados cacheados (se existirem)
    }

    return allUpdatedData;
}
/**
 * Helper genérico para buscar TODOS os registros de um custom_json em loop.
 * @param {string} baseUrl - URL da API base (ex: VOTE_API_URL).
 */
async function fetchDataInLoopGeneric(baseUrl) {
    let hasMore = true;
    let startId = null;
    const allFetchedData = [];
    
    do {
        let apiUrl = baseUrl;
        if (startId) {
            // A URL base já contém o limite (ex: ?limit=1000)
            apiUrl = `${baseUrl.replace(`limit=${API_LIMIT}`, `limit=${API_LIMIT}`)}&start=${startId}`;
        }
        
        const res = await fetch(apiUrl);
        const data = await res.json();
        
        const newRows = (Array.isArray(data) ? data : data.rows || []);
        
        const currentBatchCount = newRows.length;
        
        if (currentBatchCount > 0) {
            allFetchedData.push(...newRows);
            // Usa o 'id' do último registro (mais antigo) para a próxima paginação
            startId = newRows[newRows.length - 1].id; 
        }

        hasMore = currentBatchCount === API_LIMIT && allFetchedData.length < MAX_OPS_TO_FETCH;
        
        if (hasMore) await new Promise(resolve => setTimeout(resolve, 50)); 
        
    } while (hasMore);
    
    return allFetchedData;
}


// A função fetchDataInLoop é agora uma versão especializada da genérica para posts
async function fetchDataInLoop() {
    // Usamos a função genérica e filtramos apenas os custom_id corretos
    const allRawPosts = await fetchDataInLoopGeneric(API_URL);
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

    // 1. CARGA IMEDIATA DO CACHE DE POSTS (SÍNCRONA) - INALTERADO
    let cachedPosts = [];
    let startIdForSync = null;

    try {
        const cachedData = localStorage.getItem(POSTS_CACHE_KEY); // Usa nova chave
        if (cachedData) {
            cachedPosts = JSON.parse(cachedData);
            if (cachedPosts.length > 0) {
                startIdForSync = cachedPosts[0].id; 
                setAllPosts(cachedPosts); 
            }
        }
    } catch (e) {
        console.error("Erro ao carregar cache de posts:", e);
    }
    
    // 2. PREPARA AS PROMESSE DE SINCRONIZAÇÃO COMPLETA (PARALELO)
    
    // 2a. Sincronização de Posts (Mantendo a lógica de busca em loop na 1ª carga)
    let postSyncPromise;
    let isCacheHit = !!startIdForSync;

    if (isCacheHit) {
        // Cache Cheio: Busca reversa (max 1000)
        const url = new URL(API_URL);
        url.searchParams.delete('limit');
        url.searchParams.set('limit', '-1000');
        url.searchParams.set('start', startIdForSync);
        
        postSyncPromise = fetch(url.toString()).then(res => res.json());
        
    } else {
        // Cache Vazio: Busca completa em loop (mantida para a 1ª carga)
        postSyncPromise = fetchDataInLoop();
    }

    // 2b. Sincronização de Dados Auxiliares (USANDO O NOVO HELPER)
    const voteResPromise = syncAndGetAuxData(VOTES_CACHE_KEY, VOTE_API_URL);
    const muteResPromise = syncAndGetAuxData(MUTES_CACHE_KEY, ADMIN_POST_MUTE_API_URL);
    
    // Blocos e Follows (Podem ser simples fetch ou o novo helper, dependendo do volume)
    // Usaremos o novo helper para consistência (embora o conditionalFetch original pudesse ser mantido se fosse mais leve)
    const blockResPromise = syncAndGetTargetOps(BLOCKS_CACHE_KEY, USER_BLOCK_API_URL, BLOCK_USER_CUSTOM_ID);
    const followResPromise = syncAndGetTargetOps(FOLLOWS_CACHE_KEY, USER_FOLLOW_API_URL, FOLLOW_USER_CUSTOM_ID);
    
    
    // 3. AGUARDA E PROCESSA TUDO
    
    const [
        syncDataRaw, 
        voteDataRaw, 
        muteDataRaw, 
        blockDataRaw, 
        followDataRaw
    ] = await Promise.all([
        postSyncPromise,
        voteResPromise, // Agora é o array de dados completo
        muteResPromise, // Agora é o array de dados completo
        blockResPromise, // Agora é o array de dados completo
        followResPromise // Agora é o array de dados completo
    ]);
    
    // --- INÍCIO DO PROCESSAMENTO DE ESTADO ---
    
    // 3a. Processa Posts (Consolidação) - Lógica inalterada
    let finalPosts = cachedPosts;
    let newPostsCount = 0;
    
    if (isCacheHit) {
        // ... (Lógica de concatenação dos posts)
        const newPosts = (Array.isArray(syncDataRaw) ? syncDataRaw : syncDataRaw.rows || [])
            .filter((x) => x.custom_id === APP_ID);
        
        newPostsCount = newPosts.length;
        finalPosts = newPosts.concat(cachedPosts);
    } else {
        // ... (Lógica de primeira carga)
        finalPosts = syncDataRaw;
        newPostsCount = finalPosts.length;
    }
    
    finalPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    finalPosts = finalPosts.slice(0, 2000); 
    
    setAllPosts(finalPosts); 
    localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(finalPosts)); // Usa nova chave

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

        updateTags(); 
        
    } catch (e) {
        console.error("Erro ao processar dados auxiliares pós-sincronização:", e);
    }
    
    // 4. FINALIZAÇÃO
    window.dispatchEvent(new Event('hashchange'));
    showNotification(`✅ Dados carregados e sincronizados com sucesso. (${newPostsCount} novos posts)`, true);
}

function handlePostKeychainResponse(res, actionText) {
    if (res.success) {
        showNotification(`✅ ${actionText} enviado com sucesso!`, true);
        
        // Lógica única do post
        document.getElementById("newPostContent").value = "";
        document.getElementById("charCount").textContent = "Characters: 0 / 512";
        window.location.hash = ""; // Volta ao feed
        
    } else {
        showNotification(`❌ Erro ao ${actionText.toLowerCase().split(' ')[0]}!`, false);
    }
}

// Envia um novo Post ou Reply
export function sendPost(content, replyTo = null) {
    const username = localStorage.getItem("hiveUser");
    if (!username) return showNotification("Faça login primeiro!", false);

    const tags = extractTagsFromText(content);
    const mentions = extractMentionsFromText(content);
    const json = JSON.stringify({
        app: APP_ID, v: 1, type: replyTo ? "reply" : "post",
        content, reply_to: replyTo, mentions, tags,
    });

    const actionText = replyTo ? "Responder" : "Postar";

    if (window.hive_keychain) {
        window.hive_keychain.requestCustomJson(
            username, APP_ID, "Posting", json, actionText,
            (res) => handlePostKeychainResponse(res, actionText)
        );
    } else {
        showNotification("Hive Keychain não detectado!",false);
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

    const json = JSON.stringify({
        app: APP_ID, v: 1, type: type, target_user: targetUser,
    });

    let customId;
    if (type === 'block' || type === 'unblock') {
        customId = `${APP_ID}.${username}.block`;
    } else if (type === 'follow' || type === 'unfollow') {
        customId = FOLLOW_USER_CUSTOM_ID.replace('{user}', username);
    } else {
        return showNotification("Erro interno: Ação desconhecida.", false);
    }
    
    if (window.hive_keychain) {
        window.hive_keychain.requestCustomJson(
            username, customId, "Posting", json, actionText,
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
    
    if (window.hive_keychain) {
        window.hive_keychain.requestCustomJson(
            username, customId, "Posting", jsonPayload, actionText,
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
    const json = JSON.stringify({
        app: APP_ID, v: 1, type: voteType, content_id: contentId,
    });
    sendDataAction(VOTE_CUSTOM_ID, json, "Votar");
}

export function sendMute(contentId, cause) {
    const json = JSON.stringify({
        app: APP_ID, v: 1, type: "mute", cause: cause, content_id: contentId,
    });
    // O último argumento true indica que é necessária a autoridade de ADMIN
    sendDataAction(ADMIN_PMUTE_CUSTOM_ID, json, "Mutar Post", true); 
}

export function sendUnmute(contentId) {
    const json = JSON.stringify({
        app: APP_ID, v: 1, type: "unmute", content_id: contentId,
    });
    // O último argumento true indica que é necessária a autoridade de ADMIN
    sendDataAction(ADMIN_PMUTE_CUSTOM_ID, json, "Desmutar Post", true);
}


export function clearAllCaches() {
    // 1. Chaves de Cache Globais
    localStorage.removeItem(POSTS_CACHE_KEY);
    localStorage.removeItem(VOTES_CACHE_KEY);
    localStorage.removeItem(MUTES_CACHE_KEY);

    // 2. Chaves de Cache de Usuário (Block/Follow)
    // O cache de Block/Follow usa a chave de cache + o nome do usuário logado.
    // É necessário remover o cache específico do usuário logado.
    if (loggedInUser) {
        localStorage.removeItem(`${BLOCKS_CACHE_KEY}.${loggedInUser}`);
        localStorage.removeItem(`${FOLLOWS_CACHE_KEY}.${loggedInUser}`);
    } else {
        // Se o usuário não está logado, remove chaves antigas que podem ter sido geradas sem o sufixo.
        localStorage.removeItem(BLOCKS_CACHE_KEY);
        localStorage.removeItem(FOLLOWS_CACHE_KEY);
    }

    // 3. Feedback e Recarga
    showNotification("🗑️ Todos os caches foram limpos! Recarregando dados...", true);
    
    // Força a recarga completa dos dados na próxima chamada de fetchData()
    // Como os caches estão vazios, ele fará o loop completo (primeira carga).
    fetchData(); 
    
    // Opcional: Recarrega a página inteira para garantir que o estado in-memory também seja limpo
    // window.location.reload(); 
}