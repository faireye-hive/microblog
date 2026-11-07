/**
 * Hive custom_json protocol (v1).
 *
 * Keep on-chain field names and operation IDs stable. These builders only
 * assemble payloads; they do not sign, store data or access the DOM.
 */
import { APP_ID } from "../config.js";

export function buildPostPayload({
  content,
  replyTo = null,
  channel = APP_ID,
  mentions = [],
  tags = [],
}) {
  return {
    app: APP_ID,
    v: 1,
    type: replyTo ? "reply" : "post",
    channel,
    content,
    reply_to: replyTo,
    mentions,
    tags,
  };
}

export function buildVotePayload(contentId, voteType) {
  return { app: APP_ID, v: 1, type: voteType, content_id: contentId };
}

export function buildMutePayload(contentId, type, cause) {
  if (type === "mute") {
    return { app: APP_ID, v: 1, type: "mute", cause, content_id: contentId };
  }
  if (type === "unmute") {
    return { app: APP_ID, v: 1, type: "unmute", content_id: contentId };
  }
  throw new Error("Unsupported mute action");
}

export function buildUserActionPayload(type, targetUser) {
  return { app: APP_ID, v: 1, type, target_user: targetUser };
}

export function buildChannelCreatePayload({
  id,
  name,
  description,
  createdAt,
}) {
  return {
    app: APP_ID,
    v: 1,
    type: "create_channel",
    action: "create_channel",
    id,
    name,
    description,
    created_at: createdAt,
  };
}
