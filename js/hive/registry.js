/**
 * Micro.fair's single source of truth for custom_json namespaces and actions.
 *
 * These IDs are already published on Hive. They are immutable protocol v1
 * names, NOT display labels. Any rename needs a separately planned migration
 * and read compatibility for historical operations.
 */
import { parseChannelCustomId } from "../helpers/channel-id.js";
import { safeHiveUsername } from "../security/safe-values.js";

export const HIVE_APP_ID = "micro.fair";
export const HIVE_PROTOCOL_VERSION = 1;
export const HIVE_CUSTOM_JSON_IDS = Object.freeze({
  POSTS: HIVE_APP_ID,
  COMMUNITY: "{channel}",
  VOTES: HIVE_APP_ID + ".interation", // Historical spelling. Do not "fix" it.
  MODERATION: HIVE_APP_ID + ".adpmuted", // Historical spelling. Do not rename.
  CHANNEL_REGISTRY: HIVE_APP_ID + ".channels",
  FOLLOW_TEMPLATE: HIVE_APP_ID + ".{user}.follow",
  BLOCK_TEMPLATE: HIVE_APP_ID + ".{user}.block",
});

export const HIVE_ACTION_TYPES = Object.freeze({
  POST: "post",
  REPLY: "reply",
  UPVOTE: "upvote",
  DOWNVOTE: "downvote",
  MUTE: "mute",
  UNMUTE: "unmute",
  FOLLOW: "follow",
  UNFOLLOW: "unfollow",
  BLOCK: "block",
  UNBLOCK: "unblock",
  CREATE_CHANNEL: "create_channel",
});

export const HIVE_NAMESPACE_REGISTRY = Object.freeze([
  {
    key:"feed", label:"Main feed posts & replies",
    id:HIVE_CUSTOM_JSON_IDS.POSTS, scope:"app",
    summary:"Main timeline. A reply uses this same ID and type: reply with reply_to set.",
    operations:["post","reply"],
  },
  {
    key:"community", label:"Community posts & replies",
    id:HIVE_CUSTOM_JSON_IDS.COMMUNITY, scope:"community",
    summary:"The ID is the community's exact custom_json namespace, not micro.fair plus a suffix.",
    operations:["community-post","community-reply"],
  },
  {
    key:"votes", label:"Votes",
    id:HIVE_CUSTOM_JSON_IDS.VOTES, scope:"app",
    summary:"Upvotes and downvotes share a namespace. Latest vote per signer/post is the current state.",
    operations:["upvote","downvote"],
  },
  {
    key:"moderation", label:"Post moderation",
    id:HIVE_CUSTOM_JSON_IDS.MODERATION, scope:"admin",
    summary:"Administrator-signed mute and unmute operations. An ID alone does not grant admin authority.",
    operations:["mute","unmute"],
  },
  {
    key:"follow", label:"Following",
    id:HIVE_CUSTOM_JSON_IDS.FOLLOW_TEMPLATE, scope:"user",
    summary:"The {user} segment is the signing account. Follow and unfollow share one per-user namespace.",
    operations:["follow","unfollow"],
  },
  {
    key:"block", label:"Blocking",
    id:HIVE_CUSTOM_JSON_IDS.BLOCK_TEMPLATE, scope:"user",
    summary:"The {user} segment is the signing account, never the blocked target.",
    operations:["block","unblock"],
  },
  {
    key:"channels", label:"Community registry",
    id:HIVE_CUSTOM_JSON_IDS.CHANNEL_REGISTRY, scope:"app",
    summary:"Registers community metadata. Content is posted separately to the community's own ID.",
    operations:["create_channel"],
  },
]);

export const HIVE_ACTION_REGISTRY = Object.freeze([
  {key:"post",label:"Create post",type:HIVE_ACTION_TYPES.POST,namespace:"feed",
   summary:"Publish to the main Micro.fair timeline."},
  {key:"reply",label:"Reply to a post",type:HIVE_ACTION_TYPES.REPLY,namespace:"feed",
   summary:"Reply in the same namespace as the parent, using the parent operation ID."},
  {key:"community-post",label:"Post in a community",type:HIVE_ACTION_TYPES.POST,namespace:"community",
   summary:"Publish using that community's exact custom_json ID."},
  {key:"community-reply",label:"Reply in a community",type:HIVE_ACTION_TYPES.REPLY,namespace:"community",
   summary:"The reply stays in the parent's community custom_json namespace."},
  {key:"upvote",label:"Upvote",type:HIVE_ACTION_TYPES.UPVOTE,namespace:"votes",
   summary:"Register a positive vote for a Micro.fair content operation."},
  {key:"downvote",label:"Downvote",type:HIVE_ACTION_TYPES.DOWNVOTE,namespace:"votes",
   summary:"Register a negative vote for a Micro.fair content operation."},
  {key:"mute",label:"Mute post",type:HIVE_ACTION_TYPES.MUTE,namespace:"moderation",
   summary:"Hide a post using an authorized administrator signature."},
  {key:"unmute",label:"Unmute post",type:HIVE_ACTION_TYPES.UNMUTE,namespace:"moderation",
   summary:"Remove an administrator mute."},
  {key:"follow",label:"Follow account",type:HIVE_ACTION_TYPES.FOLLOW,namespace:"follow",
   summary:"Follow a target account from the signer's own follow namespace."},
  {key:"unfollow",label:"Unfollow account",type:HIVE_ACTION_TYPES.UNFOLLOW,namespace:"follow",
   summary:"Undo a follow for a target account."},
  {key:"block",label:"Block account",type:HIVE_ACTION_TYPES.BLOCK,namespace:"block",
   summary:"Block a target account from the signer's own block namespace."},
  {key:"unblock",label:"Unblock account",type:HIVE_ACTION_TYPES.UNBLOCK,namespace:"block",
   summary:"Undo a block for a target account."},
  {key:"create_channel",label:"Create community",type:HIVE_ACTION_TYPES.CREATE_CHANNEL,namespace:"channels",
   summary:"Create or register a community by ID and metadata."},
]);

export const HIVE_FIELD_DESCRIPTIONS = Object.freeze({
  app:"App identifier, always micro.fair (not the Hive custom_json ID).",
  v:"Payload protocol version, currently 1.",
  type:"Operation action inside the JSON payload.",
  action:"Historical duplicate action field for community creation.",
  channel:"Main feed or community namespace where content is published.",
  content:"The post or reply body (maximum 2,048 characters in this app).",
  reply_to:"Parent HAFSQL operation ID; null for a new top-level post.",
  mentions:"Array of mentioned Hive account names parsed from the post text.",
  tags:"Array of hashtags; community posts include their community ID.",
  content_id:"Numeric HAFSQL custom_json operation ID of the target post or reply.",
  target_user:"Hive username being followed, unfollowed, blocked or unblocked.",
  cause:"Human-readable moderation reason, present only on mute.",
  id:"Community custom_json namespace, not a Hive account name.",
  name:"Community display title.",
  description:"Community description.",
  created_at:"Creation timestamp as an ISO 8601 string.",
});

export function getHiveAction(key) {
  return HIVE_ACTION_REGISTRY.find(op => op.key === key) || null;
}
export function getHiveNamespace(key) {
  return HIVE_NAMESPACE_REGISTRY.find(group => group.key === key) || null;
}

/**
 * Resolve the exact ID supplied to hive_keychain.requestCustomJson.
 * Returns an empty string for malformed context; never "fixes" historical IDs.
 */
export function resolveCustomJsonId(actionKey, { username, channel } = {}) {
  const action = getHiveAction(actionKey);
  if (!action) return "";
  switch (action.namespace) {
    case "feed":
      return channel === undefined || channel === null
        ? HIVE_CUSTOM_JSON_IDS.POSTS : parseChannelCustomId(channel);
    case "community":
      return parseChannelCustomId(channel);
    case "votes": return HIVE_CUSTOM_JSON_IDS.VOTES;
    case "moderation": return HIVE_CUSTOM_JSON_IDS.MODERATION;
    case "channels": return HIVE_CUSTOM_JSON_IDS.CHANNEL_REGISTRY;
    case "follow":
    case "block": {
      const user = safeHiveUsername(username);
      if (user === "unknown") return "";
      const template=action.namespace==="follow"
        ? HIVE_CUSTOM_JSON_IDS.FOLLOW_TEMPLATE : HIVE_CUSTOM_JSON_IDS.BLOCK_TEMPLATE;
      return template.replace("{user}",user);
    }
    default: return "";
  }
}
