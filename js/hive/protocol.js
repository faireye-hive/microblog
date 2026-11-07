/**
 * HiveLine custom_json protocol (v2).
 *
 * Keep on-chain field names and operation IDs stable. These builders only
 * assemble payloads; they do not sign, store data or access the DOM.
 */
import { APP_ID, POSTS_CUSTOM_ID } from "../config.js";
import { HIVE_PROTOCOL_VERSION, HIVE_ACTION_TYPES } from "./registry.js";

export function buildPostPayload({
  content,
  replyTo = null,
  channel = POSTS_CUSTOM_ID,
  mentions = [],
  tags = [],
}) {
  return {
    app: APP_ID,
    v: HIVE_PROTOCOL_VERSION,
    type: replyTo ? HIVE_ACTION_TYPES.REPLY : HIVE_ACTION_TYPES.POST,
    channel,
    content,
    reply_to: replyTo,
    mentions,
    tags,
  };
}

export function buildVotePayload(contentId, voteType) {
  if (![HIVE_ACTION_TYPES.UPVOTE, HIVE_ACTION_TYPES.DOWNVOTE].includes(voteType))
    throw new Error("Unsupported vote action");
  return { app: APP_ID, v: HIVE_PROTOCOL_VERSION, type: voteType, content_id: contentId };
}

export function buildMutePayload(contentId, type, cause) {
  if (type === HIVE_ACTION_TYPES.MUTE) {
    return { app: APP_ID, v: HIVE_PROTOCOL_VERSION, type: HIVE_ACTION_TYPES.MUTE, cause, content_id: contentId };
  }
  if (type === HIVE_ACTION_TYPES.UNMUTE) {
    return { app: APP_ID, v: HIVE_PROTOCOL_VERSION, type: HIVE_ACTION_TYPES.UNMUTE, content_id: contentId };
  }
  throw new Error("Unsupported mute action");
}

export function buildUserActionPayload(type, targetUser) {
  if (![HIVE_ACTION_TYPES.FOLLOW, HIVE_ACTION_TYPES.UNFOLLOW,
        HIVE_ACTION_TYPES.BLOCK, HIVE_ACTION_TYPES.UNBLOCK].includes(type))
    throw new Error("Unsupported user action");
  return { app: APP_ID, v: HIVE_PROTOCOL_VERSION, type, target_user: targetUser };
}

export function buildChannelCreatePayload({
  id,
  name,
  description,
  createdAt,
}) {
  return {
    app: APP_ID,
    v: HIVE_PROTOCOL_VERSION,
    type: HIVE_ACTION_TYPES.CREATE_CHANNEL,
    action: HIVE_ACTION_TYPES.CREATE_CHANNEL,
    id,
    name,
    description,
    created_at: createdAt,
  };
}
