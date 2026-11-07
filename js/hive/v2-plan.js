/**
 * Preflight-only v2 migration planner. It is deliberately NOT imported by
 * the signing/writing path. Brand/domain decisions and dual-read migrations
 * require explicit approval before any on-chain v2 message is sent.
 */
import {HIVE_CUSTOM_JSON_IDS} from "./registry.js";

export const PROTOCOL_V2_DRAFT_STATUS="proposal-only";
const namedSegments=["posts","votes","moderation","communities","relationships"];

export function proposeHiveV2Namespaces(candidate) {
  const name=typeof candidate==="string"?candidate.trim().toLowerCase():"";
  const errors=[];
  if(!/^[a-z][a-z0-9-]{1,17}$/.test(name))
    errors.push("Use 2–18 lowercase letters, numbers or hyphens, beginning with a letter.");
  if(name==="micro.fair"||name==="microfair"||name==="hive")
    errors.push("Choose a distinct app namespace rather than the legacy project or the Hive blockchain.");
  const ids=errors.length?null:Object.freeze(Object.fromEntries(
    namedSegments.map(key=>[key,name+"."+key])));
  if(ids && Object.values(ids).some(id=>id.length>32))
    errors.push("A generated ID would exceed 32 characters.");
  return {
    status:PROTOCOL_V2_DRAFT_STATUS,
    enabled:false,
    proposedBrandId:errors.length?null:name,
    version:2,
    ids:errors.length?null:ids,
    legacy:Object.freeze({
      posts:HIVE_CUSTOM_JSON_IDS.POSTS,
      votes:HIVE_CUSTOM_JSON_IDS.VOTES,
      moderation:HIVE_CUSTOM_JSON_IDS.MODERATION,
      communities:HIVE_CUSTOM_JSON_IDS.CHANNEL_REGISTRY,
      follow:HIVE_CUSTOM_JSON_IDS.FOLLOW_TEMPLATE,
      block:HIVE_CUSTOM_JSON_IDS.BLOCK_TEMPLATE,
      communityPosts:HIVE_CUSTOM_JSON_IDS.COMMUNITY
    }),
    decisionsRequired:[
      "Choose and confirm the brand and available domain/repository name.",
      "Define a migration/dual-read strategy for original posts and replies.",
      "Decide how existing community IDs and community post history are mapped.",
      "Move follow/block reads to the shared relationships namespace, filtering by signed account.",
      "Decide whether v2 content identifiers reference legacy HAFSQL IDs across namespaces.",
      "Publish the versioned schema and deploy compatible readers before enabling any v2 writer."
    ],
    errors
  };
}
