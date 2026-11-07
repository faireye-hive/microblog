/*
 * Derived discovery data from posts/communities already loaded by Micro.fair.
 * The UI is never allowed to invent global Hive results or engagement counts.
 */
import { parseEmbeddedJson } from "../utils.js";
import { safeHiveUsername, safeTag } from "../security/safe-values.js";
import { parseChannelCustomId } from "./channel-id.js";

export function normalizeDiscoveryQuery(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 100) : "";
}

export function collectDiscoveryTags(posts, limit = 12) {
  const counts = new Map();
  const items = Array.isArray(posts) ? posts : [];
  for (const post of items) {
    const data = parseEmbeddedJson(post?.json);
    const content = typeof data?.content === "string" ? data.content : "";
    const fromText = [...content.matchAll(/(?:^|\s)#([a-z0-9._-]+)/gi)].map(match => match[1]);
    const rawTags = Array.isArray(data?.tags) ? data.tags : [];
    const inPost = new Set([...rawTags, ...fromText].map(safeTag).filter(Boolean));
    for (const tag of inPost) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, Math.min(30, limit)))
    .map(([tag,count])=>({tag,count}));
}

export function getDiscoveryResults({query="",posts=[],channels=[],maxPosts=80}={}) {
  const q = normalizeDiscoveryQuery(query).toLowerCase();
  if (!q) return {query:"",posts:[],communities:[],people:[],topics:[],totalPosts:0};
  const needle = q.replace(/^[@#]/, "");
  const matchedPosts = [];
  const peopleCounts = new Map();
  const topicCounts = new Map();
  for (const post of Array.isArray(posts) ? posts : []) {
    if (!post || typeof post !== "object") continue;
    const contentJson = parseEmbeddedJson(post.json);
    const content = typeof contentJson?.content === "string" ? contentJson.content : "";
    const username = safeHiveUsername(post.required_posting_auths?.[0]);
    const tags = Array.isArray(contentJson?.tags) ? contentJson.tags : [];
    const textTags = [...content.matchAll(/(?:^|\s)#([a-z0-9._-]+)/gi)].map(m=>m[1]);
    const postTags = new Set([...tags,...textTags].map(safeTag).filter(Boolean));
    const contentMatches = !q.startsWith("@") && content.toLowerCase().includes(needle);
    const authorMatches = username !== "unknown" && username.includes(needle);
    const tagMatches = [...postTags].some(tag=>tag.includes(needle));
    if (contentMatches || authorMatches || tagMatches) {
      matchedPosts.push(post);
      if (username !== "unknown") peopleCounts.set(username,(peopleCounts.get(username)||0)+1);
    }
    for (const tag of postTags) if (tag.includes(needle)) {
      topicCounts.set(tag,(topicCounts.get(tag)||0)+1);
    }
  }

  const sortedPosts = matchedPosts.sort((a,b)=>{
    const ta = Date.parse(a.timestamp)||0, tb=Date.parse(b.timestamp)||0;
    return tb-ta;
  });
  const communities = (Array.isArray(channels)?channels:[]).filter(channel=>{
    const id=parseChannelCustomId(channel?.id);
    if(!id) return false;
    const name=typeof channel.name==="string"?channel.name:"";
    const desc=typeof channel.description==="string"?channel.description:"";
    const creator=safeHiveUsername(channel.creator);
    return id.includes(needle)||name.toLowerCase().includes(needle)||
      desc.toLowerCase().includes(needle)||creator.includes(needle);
  }).slice(0,12);
  const people=[...peopleCounts].sort((a,b)=>{
    const exactA=a[0]===needle?1:0,exactB=b[0]===needle?1:0;
    return exactB-exactA||b[1]-a[1]||a[0].localeCompare(b[0]);
  }).slice(0,12).map(([user,count])=>({user,count}));
  const topics=[...topicCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .slice(0,12).map(([tag,count])=>({tag,count}));

  return {query:q,posts:sortedPosts.slice(0,Math.max(0,Math.min(300,maxPosts))),
    communities,people,topics,totalPosts:sortedPosts.length};
}

export function discoveryPostPool(mainPosts=[],loadedChannelPosts=[],blocked=new Set(),muted=new Map()) {
  const seen = new Set();
  const result=[];
  for(const post of [...mainPosts,...loadedChannelPosts]) {
    if(!post || typeof post!=="object")continue;
    const id=String(post.id ?? "");
    if(!id||seen.has(id))continue;
    seen.add(id);
    const author=safeHiveUsername(post.required_posting_auths?.[0]);
    if(blocked.has(author)||muted.has(post.id))continue;
    result.push(post);
  }
  return result;
}
