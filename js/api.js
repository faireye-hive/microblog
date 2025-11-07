// /js/api.js

import { APP_ID, API_URL, VOTE_CUSTOM_ID, VOTE_API_URL } from "./config.js";
import { parseEmbeddedJson, extractTagsFromText, extractMentionsFromText } from "./utils.js";
import { setAllPosts, setVoteCounts, updateTags } from "./state.js";

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

// Função principal para buscar todos os dados (Posts e Votos)
export async function fetchData() {
    document.getElementById("feed").innerHTML =
        '<div class="card p-4 text-center small-muted">Carregando...</div>';

    try {
        const resPromise = fetch(API_URL).then((res) => res.json());
        const voteResPromise = fetch(VOTE_API_URL).then((res) => res.json());
        const [data, voteDataRaw] = await Promise.all([resPromise, voteResPromise]);

        // Processa Posts
        const posts = (Array.isArray(data) ? data : data.rows || [])
            .filter((x) => x.custom_id === APP_ID)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        setAllPosts(posts); // Atualiza o estado

        // Processa Votos
        const counts = processVoteData(voteDataRaw || []);
        setVoteCounts(counts); // Atualiza o estado

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
    if (!username) return alert("Faça login primeiro!");

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
                    alert("✅ Enviado com sucesso!");
                    document.getElementById("newPostContent").value = "";
                    document.getElementById("charCount").textContent = "Characters: 0 / 512";
                    // Após postar, volta ao feed (que recarrega os dados)
                    window.location.hash = ""; 
                } else {
                    alert("❌ Erro ao enviar!");
                }
            }
        );
    } else {
        alert("Hive Keychain não detectado!");
    }
}

// Envia um Voto
export function sendVote(contentId, voteType) {
    const username = localStorage.getItem("hiveUser");
    if (!username) return alert("Faça login primeiro!");

    const json = JSON.stringify({
        app: APP_ID, v: 1, type: voteType, content_id: contentId,
    });

    if (window.hive_keychain) {
        window.hive_keychain.requestCustomJson(
            username, VOTE_CUSTOM_ID, "Posting", json, "Votar",
            (res) => {
                if (res.success) {
                    alert(`✅ Voto '${voteType}' enviado com sucesso!`);
                    // Recarrega os dados e a view atual
                    fetchData().then(() => {
                        window.dispatchEvent(new Event('hashchange'));
                    });
                } else {
                    alert("❌ Erro ao enviar voto!");
                }
            }
        );
    } else {
        alert("Hive Keychain não detectado!");
    }
}