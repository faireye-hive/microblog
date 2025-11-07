// /js/render.js
import { parseEmbeddedJson, escapeHtml, stripMarkdown, extractImages, fmtDate, linkifyText } from "./utils.js";

// Função Helper local
function findPost(postId, allPosts) {
    return allPosts.find((p) => p.id == postId);
}

export function buildRepliesRecursive(parentId, allPosts, depth = 1) {
    const replies = allPosts.filter(
        (r) => parseEmbeddedJson(r.json)?.reply_to == parentId
    );
    if (replies.length === 0) return "";
    return replies
        .map((r) => {
            const rj = parseEmbeddedJson(r.json);
            const nestedHTML = buildRepliesRecursive(r.id, allPosts, depth + 1);
            return `
            <div class="reply-box nested small-muted">
                <strong>@${
                    r.required_posting_auths?.[0] || "user"
                }:</strong> ${escapeHtml(rj.content || "")}
                <div class="flex gap-2 mt-1">
                    <button class="px-2 py-1 border rounded small-muted reply-btn" data-id="${
                        r.id
                    }">Reply</button>
                </div>
                ${nestedHTML}
            </div>`;
        })
        .join("");
}

export function buildThreadAbove(post, allPosts) {
    const parsed = parseEmbeddedJson(post.json);
    
    // 1. Verifica se o post atual é uma resposta
    if (!parsed?.reply_to) return ""; 

    // 2. Busca o post PARENTAL imediato
    const parent = findPost(parsed.reply_to, allPosts);
    
    // 3. Se não encontrar o pai, ou se o pai não tiver conteúdo
    if (!parent) return ""; 
    
    const pj = parseEmbeddedJson(parent.json);

    // 4. Retorna o HTML APENAS para o pai imediato
    return `
        <div class="reply-box small-muted">
            <em class="view-thread" data-id="${parent.id}">Em resposta a @${
                parent.required_posting_auths?.[0] || "user"
            }</em><br>
            ${escapeHtml(pj.content?.slice(0, 120) || "")}...
        </div>`;
    // Nota: O loop 'while' e o uso de 'threadHTML' para empilhar foram removidos
}

// /js/render.js (Função buildPostCard REESTRUTURADA)

export function buildPostCard(p, allPosts, voteCounts = {}) {
    const author =
        (p.required_posting_auths && p.required_posting_auths[0]) || "unknown";
    const parsed = parseEmbeddedJson(p.json); //
    const content = parsed?.content || ""; //
    let text = stripMarkdown(content); //
    const imgs = extractImages(content); //

    if (imgs.length === 1 && text.trim() === imgs[0]) {
        text = ''; // Se o texto for idêntico à única imagem extraída, limpa o texto para evitar duplicidade.
    } else {
        text = stripMarkdown(content); // Se for conteúdo misto, mantém a lógica original
    }
    const replies = allPosts.filter(
        (r) => parseEmbeddedJson(r.json)?.reply_to == p.id
    ); //


    // NOVO: Pega a contagem de votos
    const votes = voteCounts[p.id] || { upvote: 0, downvote: 0 };
    const upvoteCount = votes.upvote;
    const downvoteCount = votes.downvote;

    const el = document.createElement("article");
    el.className = "card p-4";
    el.innerHTML = `
        <div class="flex gap-3">
            <img 
                src="https://images.hive.blog/u/${author}/avatar" 
                alt="Avatar de @${author}" 
                class="w-12 h-12 rounded-full object-cover bg-gray-100"
            >
            <div class="flex-1">
                
                <div class="flex justify-between">
                    <div>
                        <div class="text-red-600 font-semibold">@${author}</div>
                        <div class="small-muted">#${p.id} • ${fmtDate(p.timestamp)}</div>
                    </div>
                </div>
                
                ${parsed?.reply_to ? buildThreadAbove(p, allPosts) : ""}
                
                <div class="mt-3 text-sm">${
                    // NOVO: Usamos linkifyText para transformar #tags e @mentions em links
                    linkifyText(escapeHtml(text)).replace( 
                        /\n/g,
                        "<br>"
                    )
                }</div>
                ${
                    imgs.length
                        ? `<div class="mt-3 grid gap-3 ${
                              imgs.length > 1 ? "grid-cols-2" : ""
                          }">
                        ${imgs
                            .map(
                                (u) =>
                                    `<img 
                                      src="${u}" 
                                      class="rounded w-full max-h-64 object-cover cursor-pointer post-image" 
                                      data-full-src="${u}"
                                    >`
                            )
                            .join("")}
                    </div>`
                        : ""
                }
                
                <div class="flex mt-3 justify-between">
                    <div class="flex gap-2">
                        <button class="px-2 py-1 border rounded small-muted vote-btn upvote-btn" data-id="${p.id}" data-vote="upvote">👍 ${upvoteCount}</button>
                        <button class="px-2 py-1 border rounded small-muted vote-btn downvote-btn" data-id="${p.id}" data-vote="downvote">👎 ${downvoteCount}</button>
                    </div>
                    <div class="flex gap-2 justify-end">
                        <button class="px-2 py-1 border rounded small-muted thread-btn" data-id="${
                            p.id
                        }">💬 ${replies.length}</button>
                        <button class="px-2 py-1 border rounded small-muted reply-btn" data-id="${
                            p.id
                        }">Reply</button>
                    </div>
                </div>
                
                <div class="thread hidden mt-4"></div>
            </div>
        </div>`;
    return el;
}