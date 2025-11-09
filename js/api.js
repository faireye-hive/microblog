// /js/api.js

import { 
    APP_ID, API_URL, VOTE_CUSTOM_ID, VOTE_API_URL, 
    ADMIN_PMUTE_CUSTOM_ID, ADMIN_POST_MUTE_API_URL,
     ADMIN, USER_BLOCK_API_URL, BLOCK_USER_CUSTOM_ID,
      USER_FOLLOW_API_URL, FOLLOW_USER_CUSTOM_ID 
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

// Função principal para buscar todos os dados (Posts e Votos)
export async function fetchData() {
    document.getElementById("feed").innerHTML =
        '<div class="card p-4 text-center small-muted">Carregando...</div>';

    try {
        const resPromise = fetch(API_URL).then((res) => res.json());
        const voteResPromise = fetch(VOTE_API_URL).then((res) => res.json());
        const muteResPromise = fetch(ADMIN_POST_MUTE_API_URL).then((res) => res.json());

        // Usa o novo helper para buscas condicionais e com substituição de URL
        const blockResPromise = conditionalFetch(USER_BLOCK_API_URL, BLOCK_USER_CUSTOM_ID);
        const followResPromise = conditionalFetch(USER_FOLLOW_API_URL, FOLLOW_USER_CUSTOM_ID);
            
        const [data, voteDataRaw, muteDataRaw, blockDataRaw, followDataRaw] = await Promise.all([
            resPromise, 
            voteResPromise, 
            muteResPromise, 
            blockResPromise, 
            followResPromise
        ]);


        // Processa Posts
        const posts = (Array.isArray(data) ? data : data.rows || [])
            .filter((x) => x.custom_id === APP_ID)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        setAllPosts(posts); // Atualiza o estado

        // Processa Votos
        const counts = processVoteData(voteDataRaw || []);
        setVoteCounts(counts); // Atualiza o estado

        const mutedPostMap = processMuteData(muteDataRaw.rows || muteDataRaw); 
        setMutedPostIds(mutedPostMap); // Esta função deve ser alterada no state.js para aceitar um Map
        // NOVO: Processa Bloqueios
        const blockedSet = processUserTargetOps(blockDataRaw || []);
        setBlockedUsers(blockedSet);
        const followedSet = processUserTargetOps(followDataRaw || []);
        setFollowedUsers(followedSet);

        updateTags(); // Atualiza a UI da sidebar
        
    } catch (e) {
        console.error("Erro ao carregar dados:", e);
        document.getElementById("feed").innerHTML =
            '<div class="card p-4 text-center text-red-600">Erro ao carregar dados. Tente atualizar a página.</div>';
        throw e; // Lança o erro para o handleRoute
    }
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

