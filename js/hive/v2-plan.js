/** Pure namespace explorer: HiveLine v2 is active; alternative names are previews only. */
import {
  HIVE_APP_ID,HIVE_CUSTOM_JSON_IDS,LEGACY_MICROFAIR_IDS
} from "./registry.js";

export const PROTOCOL_V2_DRAFT_STATUS="proposal-only";
const namedSegments=["posts","votes","moderation","communities","relationships"];

export function proposeHiveV2Namespaces(candidate) {
  const name=typeof candidate==="string"?candidate.trim().toLowerCase():"";
  const errors=[];
  if(!/^[a-z][a-z0-9-]{1,17}$/.test(name))
    errors.push("Use 2–18 lowercase letters, numbers or hyphens, beginning with a letter.");
  if(["microfair","hive"].includes(name))
    errors.push("Use a distinct namespace rather than the legacy project or the Hive blockchain.");
  const ids=errors.length?null:Object.fromEntries(namedSegments.map(key=>[key,name+"."+key]));
  if(ids&&Object.values(ids).some(id=>id.length>32))
    errors.push("A generated ID exceeds the 32-character limit.");
  const enabled=!errors.length&&name===HIVE_APP_ID;
  return {
    status:enabled?"active":PROTOCOL_V2_DRAFT_STATUS,
    enabled,
    proposedBrandId:errors.length?null:name,
    version:2,
    ids:errors.length?null:Object.freeze({...ids,communityPosts:name+".c.{channel}"}),
    legacy:Object.freeze({
      posts:LEGACY_MICROFAIR_IDS.POSTS,
      votes:LEGACY_MICROFAIR_IDS.VOTES,
      moderation:LEGACY_MICROFAIR_IDS.MODERATION,
      communities:LEGACY_MICROFAIR_IDS.CHANNEL_REGISTRY,
      follow:LEGACY_MICROFAIR_IDS.FOLLOW_TEMPLATE,
      block:LEGACY_MICROFAIR_IDS.BLOCK_TEMPLATE,
      communityPosts:"{channel}"
    }),
    decisionsRequired:enabled ? [] : [
      "Confirm an available brand identity.",
      "Implement a new versioned registry before enabling alternative writers.",
      "Keep historic data isolated or provide an explicit archive viewer."
    ],
    errors
  };
}
