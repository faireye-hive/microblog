// /js/render.js
import { parseEmbeddedJson, escapeHtml, stripMarkdown, extractImages, fmtDate } from "./utils.js";

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
    let threadHTML = "";
    let current = post;
    while (true) {
        const parsed = parseEmbeddedJson(current.json);
        if (!parsed?.reply_to) break;
        const parent = findPost(parsed.reply_to, allPosts);
        if (!parent) break;
        const pj = parseEmbeddedJson(parent.json);
        threadHTML = `
            <div class="reply-box small-muted">
                <em class="view-thread" data-id="${parent.id}">Em resposta a @${
                    parent.required_posting_auths?.[0] || "user"
                }</em><br>
                ${escapeHtml(pj.content?.slice(0, 120) || "")}...
                ${threadHTML}
            </div>`;
        current = parent;
    }
    return threadHTML;
}

export function buildPostCard(p, allPosts) {
    const author =
        (p.required_posting_auths && p.required_posting_auths[0]) || "unknown";
    const parsed = parseEmbeddedJson(p.json);
    const content = parsed?.content || "";
    const text = stripMarkdown(content);
    const imgs = extractImages(content);
    const replies = allPosts.filter(
        (r) => parseEmbeddedJson(r.json)?.reply_to == p.id
    );

    const el = document.createElement("article");
    el.className = "card p-4";
    el.innerHTML = `
        <div class="flex gap-3">
            <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center font-bold">${
                author[0]?.toUpperCase() || "U"
            }</div>
            <div class="flex-1">
                ${parsed?.reply_to ? buildThreadAbove(p, allPosts) : ""}
                <div class="flex justify-between">
                    <div>
                        <div class="text-red-600 font-semibold">@${author}</div>
                        <div class="small-muted">#${p.id} • ${fmtDate(p.timestamp)}</div>
                    </div>
                    <div class="flex gap-2">
                        <button class="px-2 py-1 border rounded small-muted thread-btn" data-id="${
                            p.id
                        }">💬 ${replies.length}</button>
                        <button class="px-2 py-1 border rounded small-muted reply-btn" data-id="${
                            p.id
                        }">Reply</button>
                    </div>
                </div>
                <div class="mt-3 text-sm">${escapeHtml(text).replace(
                    /\n/g,
                    "<br>"
                )}</div>
                ${
                    imgs.length
                        ? `<div class="mt-3 grid gap-3 ${
                              imgs.length > 1 ? "grid-cols-2" : ""
                          }">
                        ${imgs
                            .map(
                                (u) =>
                                    `<img src="${u}" class="rounded w-full max-h-64 object-cover">`
                            )
                            .join("")}
                    </div>`
                        : ""
                }
                <div class="thread hidden mt-4"></div>
            </div>
        </div>`;
    return el;
}