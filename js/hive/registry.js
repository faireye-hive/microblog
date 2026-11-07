/**
 * HiveLine production protocol v2. Historical Micro.fair v1 operations remain
 * on Hive but are NOT read into the new test network/feed.
 *
 * Outer custom_json IDs and the inner "app" field have different meanings.
 */
import { parseChannelCustomId } from "../helpers/channel-id.js";
import { safeHiveUsername } from "../security/safe-values.js";

export const HIVE_APP_ID = "hiveline";
export const HIVE_PROTOCOL_VERSION = 2;
export const LEGACY_MICROFAIR_IDS = Object.freeze({
  POSTS: "micro.fair",
  VOTES: "micro.fair.interation",
  MODERATION: "micro.fair.adpmuted",
  CHANNEL_REGISTRY: "micro.fair.channels",
  FOLLOW_TEMPLATE: "micro.fair.{user}.follow",
  BLOCK_TEMPLATE: "micro.fair.{user}.block",
});
export const HIVE_CUSTOM_JSON_IDS = Object.freeze({
  POSTS: "hiveline.posts",
  COMMUNITY: "hiveline.c.{channel}",
  VOTES: "hiveline.votes",
  MODERATION: "hiveline.moderation",
  CHANNEL_REGISTRY: "hiveline.communities",
  RELATIONSHIPS: "hiveline.relationships",
  // Old config exports can share one v2 relationships namespace.
  FOLLOW_TEMPLATE: "hiveline.relationships",
  BLOCK_TEMPLATE: "hiveline.relationships",
});
export const HIVE_CHANNEL_PREFIX = "hiveline.c.";
export const MAX_HIVELINE_CHANNEL_LENGTH = 32 - HIVE_CHANNEL_PREFIX.length;

export function normalizeHiveLineChannel(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  const candidate = raw.startsWith(HIVE_CHANNEL_PREFIX)
    ? raw.slice(HIVE_CHANNEL_PREFIX.length) : raw;
  const clean = parseChannelCustomId(candidate);
  return clean && clean.length <= MAX_HIVELINE_CHANNEL_LENGTH ? clean : "";
}
export function channelFromCustomJsonId(customId) {
  if (typeof customId !== "string" || !customId.startsWith(HIVE_CHANNEL_PREFIX)) return "";
  return normalizeHiveLineChannel(customId);
}
export function isHiveLinePostNamespace(customId) {
  return customId === HIVE_CUSTOM_JSON_IDS.POSTS ||
    Boolean(channelFromCustomJsonId(customId));
}

export const HIVE_ACTION_TYPES = Object.freeze({
  POST:"post", REPLY:"reply", UPVOTE:"upvote", DOWNVOTE:"downvote",
  MUTE:"mute", UNMUTE:"unmute", FOLLOW:"follow", UNFOLLOW:"unfollow",
  BLOCK:"block", UNBLOCK:"unblock", CREATE_CHANNEL:"create_channel"
});
export const HIVE_NAMESPACE_REGISTRY = Object.freeze([
  {key:"feed",label:"Main feed posts & replies",id:HIVE_CUSTOM_JSON_IDS.POSTS,scope:"app",
   summary:"New HiveLine v2 posts and replies. Old micro.fair posts are not displayed.",
   operations:["post","reply"]},
  {key:"community",label:"Community posts & replies",id:HIVE_CUSTOM_JSON_IDS.COMMUNITY,scope:"community",
   summary:"A fresh ID per community: hiveline.c.{channel}. The channel slug is limited to 21 characters.",
   operations:["community-post","community-reply"]},
  {key:"votes",label:"Votes",id:HIVE_CUSTOM_JSON_IDS.VOTES,scope:"app",
   summary:"Upvotes and downvotes share the new v2 vote namespace.",
   operations:["upvote","downvote"]},
  {key:"moderation",label:"Post moderation",id:HIVE_CUSTOM_JSON_IDS.MODERATION,scope:"admin",
   summary:"Only the configured HiveLine administrator may mute or unmute a post.",
   operations:["mute","unmute"]},
  {key:"follow",label:"Following",id:HIVE_CUSTOM_JSON_IDS.RELATIONSHIPS,scope:"user",
   summary:"Follows and blocks share the new relationships namespace and are filtered by signer and action.",
   operations:["follow","unfollow"]},
  {key:"block",label:"Blocking",id:HIVE_CUSTOM_JSON_IDS.RELATIONSHIPS,scope:"user",
   summary:"Blocks and follows share a namespace; signer identity and action still define each state.",
   operations:["block","unblock"]},
  {key:"channels",label:"Community registry",id:HIVE_CUSTOM_JSON_IDS.CHANNEL_REGISTRY,scope:"app",
   summary:"Only new HiveLine communities are discovered. Historical micro.fair.channels records are excluded.",
   operations:["create_channel"]}
]);
export const HIVE_ACTION_REGISTRY = Object.freeze([
  {key:"post",label:"Create post",type:"post",namespace:"feed",
   summary:"Publish a new post to HiveLine."},
  {key:"reply",label:"Reply",type:"reply",namespace:"feed",
   summary:"Reply using the new HiveLine post namespace."},
  {key:"community-post",label:"Community post",type:"post",namespace:"community",
   summary:"Publish to the independent namespace hiveline.c.{channel}."},
  {key:"community-reply",label:"Community reply",type:"reply",namespace:"community",
   summary:"Reply in that community namespace."},
  {key:"upvote",label:"Upvote",type:"upvote",namespace:"votes",summary:"Vote on new HiveLine content."},
  {key:"downvote",label:"Downvote",type:"downvote",namespace:"votes",summary:"Vote on new HiveLine content."},
  {key:"mute",label:"Mute post",type:"mute",namespace:"moderation",summary:"Admin-only action."},
  {key:"unmute",label:"Unmute post",type:"unmute",namespace:"moderation",summary:"Admin-only action."},
  {key:"follow",label:"Follow account",type:"follow",namespace:"follow",summary:"Follow from the signer account."},
  {key:"unfollow",label:"Unfollow account",type:"unfollow",namespace:"follow",summary:"Unfollow from the signer account."},
  {key:"block",label:"Block account",type:"block",namespace:"block",summary:"Block from the signer account."},
  {key:"unblock",label:"Unblock account",type:"unblock",namespace:"block",summary:"Unblock from the signer account."},
  {key:"create_channel",label:"Create community",type:"create_channel",namespace:"channels",
   summary:"Register a new HiveLine community."}
]);
export const HIVE_FIELD_DESCRIPTIONS = Object.freeze({
  app:"Application identity; must be hiveline for v2.",
  v:"Schema version; must be 2 for HiveLine.",
  type:"Action name (post, reply, upvote, etc.).",
  action:"Community creation compatibility field; same value as type.",
  channel:"Exact outer custom_json ID for posts and replies.",
  content:"Post/reply content (up to 2,048 characters in the current client).",
  reply_to:"Numeric HAFSQL operation ID of parent; null on top-level posts.",
  mentions:"Mentioned Hive usernames parsed from the text.",
  tags:"Hashtags; community posts may include the channel slug.",
  content_id:"Positive numeric HAFSQL operation ID of the target post.",
  target_user:"Hive username to follow/unfollow or block/unblock.",
  cause:"Admin moderation reason (required for mute).",
  id:"Community slug; the actual post namespace adds hiveline.c. prefix.",
  name:"Community name.",
  description:"Community description.",
  created_at:"ISO timestamp when the community was registered."
});
export function getHiveAction(key) {
  return HIVE_ACTION_REGISTRY.find(x=>x.key===key)||null;
}
export function getHiveNamespace(key) {
  return HIVE_NAMESPACE_REGISTRY.find(x=>x.key===key)||null;
}
/** Return an exact v2 namespace for a known operation; never return a v1 ID. */
export function resolveCustomJsonId(actionKey,{username,channel}={}) {
  const action=getHiveAction(actionKey);
  if(!action)return "";
  switch(action.namespace){
    case "feed": {
      if(channel===undefined||channel===null||channel===HIVE_APP_ID||
         channel===HIVE_CUSTOM_JSON_IDS.POSTS)return HIVE_CUSTOM_JSON_IDS.POSTS;
      const slug=normalizeHiveLineChannel(channel);
      return slug ? HIVE_CHANNEL_PREFIX+slug : "";
    }
    case "community": {
      const slug=normalizeHiveLineChannel(channel);
      return slug ? HIVE_CHANNEL_PREFIX+slug : "";
    }
    case "votes":return HIVE_CUSTOM_JSON_IDS.VOTES;
    case "moderation":return HIVE_CUSTOM_JSON_IDS.MODERATION;
    case "channels":return HIVE_CUSTOM_JSON_IDS.CHANNEL_REGISTRY;
    case "follow":
    case "block":
      return safeHiveUsername(username)==="unknown"?"":HIVE_CUSTOM_JSON_IDS.RELATIONSHIPS;
    default:return "";
  }
}
