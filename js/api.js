// /js/api.js

import { 
    APP_ID, API_URL, VOTE_CUSTOM_ID, VOTE_API_URL, 
    ADMIN_PMUTE_CUSTOM_ID, ADMIN_POST_MUTE_API_URL, ADMIN, USER_BLOCK_API_URL, BLOCK_USER_CUSTOM_ID 
} from "./config.js";
import { parseEmbeddedJson, extractTagsFromText, extractMentionsFromText } from "./utils.js";
import { setAllPosts, setVoteCounts, setMutedPostIds, updateTags, renderFeed, allPosts, setBlockedUsers,loggedInUser } from "./state.js";
import { showNotification } from "./auth.js";

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
        for (const author in userVotes) {
            const latestType = userVotes[author].type;
            if (latestType === "upvote") upvote++;
            else if (latestType === "downvote") downvote++;
        }
        finalCounts[postId] = { upvote, downvote };
    }
    return finalCounts;
}

function processMutedData(muteData) {
    const currentlyMuted = new Set();
    
    // Ordena por data (mais antigo primeiro) para que o último estado (mute/unmute) prevaleça
    muteData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    muteData.forEach(op => {
        const json = parseEmbeddedJson(op.json);
        if (json.content_id) {
            if (json.type === "mute") {
                currentlyMuted.add(json.content_id);
            } else if (json.type === "unmute") {
                currentlyMuted.delete(json.content_id);
            }
        }
    });
    return currentlyMuted;
}

// Função principal para buscar todos os dados (Posts e Votos)
export async function fetchData() {
    document.getElementById("feed").innerHTML =
        '<div class="card p-4 text-center small-muted">Carregando...</div>';

    try {
        const resPromise = fetch(API_URL).then((res) => res.json());
        const voteResPromise = fetch(VOTE_API_URL).then((res) => res.json());
        const muteResPromise = fetch(ADMIN_POST_MUTE_API_URL).then((res) => res.json()); // NOVO
                // NOVO: Adicione a busca por bloqueios ao Promise.all
        const blockResPromise = loggedInUser 
            ? fetch(USER_BLOCK_API_URL.replace(BLOCK_USER_CUSTOM_ID, `${APP_ID}.${loggedInUser}.block`)).then((res) => res.json())
            : Promise.resolve([]); // Se não logado, resolve para um array vazio
            
        const [data, voteDataRaw, muteDataRaw, blockDataRaw] = await Promise.all([resPromise, voteResPromise, muteResPromise, blockResPromise]);



        // Processa Posts
        const posts = (Array.isArray(data) ? data : data.rows || [])
            .filter((x) => x.custom_id === APP_ID)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        setAllPosts(posts); // Atualiza o estado

        // Processa Votos
        const counts = processVoteData(voteDataRaw || []);
        setVoteCounts(counts); // Atualiza o estado

        const mutedIds = processMutedData(muteDataRaw || []);
        setMutedPostIds(mutedIds);
        const mutedPostMap = processMuteData(muteDataRaw.rows || muteDataRaw); 
        setMutedPostIds(mutedPostMap); // Esta função deve ser alterada no state.js para aceitar um Map
        // NOVO: Processa Bloqueios
        const blockedSet = processBlockedData(blockDataRaw || []);
        setBlockedUsers(blockedSet);

        updateTags(); // Atualiza a UI da sidebar
        
    } catch (e) {
        console.error("Erro ao carregar dados:", e);
        document.getElementById("feed").innerHTML =
            '<div class="card p-4 text-center text-red-600">Erro ao carregar dados. Tente atualizar a página.</div>';
        throw e; // Lança o erro para o handleRoute
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

    if (window.hive_keychain) {
        window.hive_keychain.requestCustomJson(
            username, APP_ID, "Posting", json,
            replyTo ? "Responder" : "Postar",
            (res) => {
                if (res.success) {
                    showNotification("✅ Enviado com sucesso!", true);
                    document.getElementById("newPostContent").value = "";
                    document.getElementById("charCount").textContent = "Characters: 0 / 512";
                    // Após postar, volta ao feed (que recarrega os dados)
                    window.location.hash = ""; 
                } else {
                    showNotification("❌ Erro ao enviar!",false);
                }
            }
        );
    } else {
        showNotification("Hive Keychain não detectado!",false);
    }
}

// Envia um Voto
export function sendVote(contentId, voteType) {
    const username = localStorage.getItem("hiveUser");
    if (!username) return showNotification("Faça login primeiro!",false);

    const json = JSON.stringify({
        app: APP_ID, v: 1, type: voteType, content_id: contentId,
    });

    if (window.hive_keychain) {
        window.hive_keychain.requestCustomJson(
            username, VOTE_CUSTOM_ID, "Posting", json, "Votar",
            (res) => {
                if (res.success) {
                    showNotification(`✅ Voto '${voteType}' enviado com sucesso!`, true);
                    // Recarrega os dados e a view atual
                    fetchData().then(() => {
                        window.dispatchEvent(new Event('hashchange'));
                    });
                } else {
                    showNotification("❌ Erro ao enviar voto!",false);
                }
            }
        );
    } else {
        showNotification("Hive Keychain não detectado!",false);
    }
}

export function sendMute(contentId, cause) {
    const username = localStorage.getItem("hiveUser");
    if (username !== ADMIN) return showNotification("Apenas administradores podem mutar posts.", false);

    const json = JSON.stringify({
        app: APP_ID, v: 1, type: "mute",
        cause: cause,
        content_id: contentId,
    });

    if (window.hive_keychain) {
        window.hive_keychain.requestCustomJson(
            username, ADMIN_PMUTE_CUSTOM_ID, "Posting", json, "Mutar Post",
            (res) => {
                if (res.success) {
                    showNotification("✅ Post mutado com sucesso!", true);
                    fetchData().then(() => window.dispatchEvent(new Event('hashchange')));
                } else {
                    showNotification("❌ Erro ao mutar post!",false);
                }
            }
        );
    }
}

// NOVO: Envia um Unmute
export function sendUnmute(contentId) {
    const username = localStorage.getItem("hiveUser");
    if (username !== ADMIN) return showNotification("Apenas administradores podem desmutar posts.",false);

    const json = JSON.stringify({
        app: APP_ID, v: 1, type: "unmute",
        content_id: contentId,
    });

    if (window.hive_keychain) {
        window.hive_keychain.requestCustomJson(
            username, ADMIN_PMUTE_CUSTOM_ID, "Posting", json, "Desmutar Post",
            (res) => {
                if (res.success) {
                    showNotification("✅ Post desmutado com sucesso!", true);
                    fetchData().then(() => window.dispatchEvent(new Event('hashchange')));
                } else {
                    showNotification("❌ Erro ao desmutar post!",false);
                }
            }
        );
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

// Processa os dados de bloqueio brutos da API
function processBlockedData(blockData) {
    const currentlyBlocked = new Set();
    
    if (!Array.isArray(blockData)) return currentlyBlocked;
    
    // Filtra apenas operações de bloco personalizadas
    const relevantOps = blockData.filter(op => {
        const json = parseEmbeddedJson(op.json);
        // Verifica se a operação foi feita pelo usuário logado e se é uma ação de block/unblock
        return op.required_posting_auths?.[0] === loggedInUser && (json.type === 'block' || json.type === 'unblock');
    });

    // Ordena por data (mais antigo primeiro) para que o último estado (block/unblock) prevaleça
    relevantOps.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    relevantOps.forEach(op => {
        const json = parseEmbeddedJson(op.json);
        if (json.target_user) {
            if (json.type === "block") {
                currentlyBlocked.add(json.target_user);
            } else if (json.type === "unblock") {
                currentlyBlocked.delete(json.target_user);
            }
        }
    });
    return currentlyBlocked;
}

// NOVO: Função para buscar a lista de usuários bloqueados
export async function fetchBlockedUsers() {
    if (!loggedInUser) {
        setBlockedUsers(new Set()); // Limpa se deslogado
        return;
    }
    try {
        const blockRes = await fetch(USER_BLOCK_API_URL.replace(BLOCK_USER_CUSTOM_ID, `${APP_ID}.${loggedInUser}.block`));
        const blockData = await blockRes.json();
        
        const blockedUsersSet = processBlockedData(blockData || []);
        setBlockedUsers(blockedUsersSet);
        
    } catch (e) {
        console.error("Erro ao carregar lista de bloqueios:", e);
        // Não lança o erro, apenas registra e continua
    }
}

// NOVO: Envia Ação de Bloqueio
export function sendBlock(targetUser) {
    const username = localStorage.getItem("hiveUser");
    if (!username) return showNotification("🔒 Faça login para bloquear usuários.", false);

    const json = JSON.stringify({
        app: APP_ID, v: 1, type: "block", target_user: targetUser,
    });

    // Usa o Custom ID específico do usuário logado
    const customId = `${APP_ID}.${username}.block`; 

    if (window.hive_keychain) {
        window.hive_keychain.requestCustomJson(
            username, customId, "Posting", json, "Bloquear Usuário",
            (res) => {
                if (res.success) {
                    showNotification(`✅ Usuário @${targetUser} bloqueado!`, true);
                    // Recarrega os dados e a view atual
                    fetchData().then(() => {
                        window.dispatchEvent(new Event('hashchange'));
                    });
                } else {
                    showNotification("❌ Erro ao bloquear usuário!", false);
                }
            }
        );
    }
}

// NOVO: Envia Ação de Desbloqueio
export function sendUnblock(targetUser) {
    const username = localStorage.getItem("hiveUser");
    if (!username) return showNotification("🔒 Faça login para desbloquear usuários.", false);

    const json = JSON.stringify({
        app: APP_ID, v: 1, type: "unblock", target_user: targetUser,
    });

    const customId = `${APP_ID}.${username}.block`;

    if (window.hive_keychain) {
        window.hive_keychain.requestCustomJson(
            username, customId, "Posting", json, "Desbloquear Usuário",
            (res) => {
                if (res.success) {
                    showNotification(`✅ Usuário @${targetUser} desbloqueado!`, true);
                    fetchData().then(() => {
                        window.dispatchEvent(new Event('hashchange'));
                    });
                } else {
                    showNotification("❌ Erro ao desbloquear usuário!", false);
                }
            }
        );
    }
}