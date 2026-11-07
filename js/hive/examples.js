/**
 * Executable documentation examples.
 *
 * All payloads are built with the SAME functions used for real broadcasts.
 * A change to a payload builder therefore updates the reference examples.
 */
import { HIVE_APP_ID, HIVE_ACTION_TYPES, getHiveAction, resolveCustomJsonId } from "./registry.js";
import { ADMIN } from "../config.js";
import {
  buildPostPayload, buildVotePayload, buildMutePayload,
  buildUserActionPayload, buildChannelCreatePayload
} from "./protocol.js";

export const PROTOCOL_EXAMPLE_SIGNER = "alice";
export const PROTOCOL_EXAMPLE_COMMUNITY = "hive.micro";
export const PROTOCOL_EXAMPLE_CONTENT_ID = 12345;

export function getExampleForAction(key, {
  username = PROTOCOL_EXAMPLE_SIGNER,
  community = PROTOCOL_EXAMPLE_COMMUNITY
} = {}) {
  const action = getHiveAction(key);
  if (!action) return null;
  const isCommunity = action.namespace === "community";
  const signer = action.namespace === "moderation" ? ADMIN : username;
  const id = resolveCustomJsonId(key, {
    username: signer,
    channel: isCommunity ? community : undefined
  });
  if (!id) return null;

  let payload;
  switch (action.type) {
    case HIVE_ACTION_TYPES.POST:
    case HIVE_ACTION_TYPES.REPLY: {
      const isReply = action.type === HIVE_ACTION_TYPES.REPLY;
      payload = buildPostPayload({
        content: isReply ? "Thanks for sharing! #hive" : "Hello Hive! #hive @bob",
        replyTo: isReply ? PROTOCOL_EXAMPLE_CONTENT_ID : null,
        channel: isCommunity ? id : HIVE_APP_ID,
        mentions: isReply ? [] : ["bob"],
        tags: isCommunity ? [id, "hive"] : ["hive"]
      });
      break;
    }
    case HIVE_ACTION_TYPES.UPVOTE:
    case HIVE_ACTION_TYPES.DOWNVOTE:
      payload = buildVotePayload(PROTOCOL_EXAMPLE_CONTENT_ID, action.type);
      break;
    case HIVE_ACTION_TYPES.MUTE:
      payload = buildMutePayload(PROTOCOL_EXAMPLE_CONTENT_ID, HIVE_ACTION_TYPES.MUTE, "Spam");
      break;
    case HIVE_ACTION_TYPES.UNMUTE:
      payload = buildMutePayload(PROTOCOL_EXAMPLE_CONTENT_ID, HIVE_ACTION_TYPES.UNMUTE);
      break;
    case HIVE_ACTION_TYPES.FOLLOW:
    case HIVE_ACTION_TYPES.UNFOLLOW:
    case HIVE_ACTION_TYPES.BLOCK:
    case HIVE_ACTION_TYPES.UNBLOCK:
      payload = buildUserActionPayload(action.type, "bob");
      break;
    case HIVE_ACTION_TYPES.CREATE_CHANNEL:
      payload = buildChannelCreatePayload({
        id: community,
        name: "Hive Micro",
        description: "A community about Hive",
        createdAt: "2026-11-07T12:00:00.000Z"
      });
      break;
    default: return null;
  }

  // On Hive, json is a STRING containing serialized JSON, not a nested object.
  // Keychain requests the Posting authority and serializes this exact payload.
  return {
    id,
    action,
    payload,
    authority: "Posting",
    hiveOperation: {
      required_auths: [],
      required_posting_auths: [signer],
      id,
      json: JSON.stringify(payload)
    }
  };
}
