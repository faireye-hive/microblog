
import { voteCounts } from "../state.js";
import { parseEmbeddedJson } from "../utils.js";

export function rankPostsByVotes(posts) {
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

export function rankPostsByComments(posts) {
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