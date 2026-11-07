/** Strict acceptance gate: old Micro.fair/Hive community posts stay on-chain,
 * but are NEVER imported into HiveLine v2 feeds, profiles or search. */
import { parseEmbeddedJson } from "../utils.js";
import {
  HIVE_APP_ID,HIVE_PROTOCOL_VERSION,HIVE_CUSTOM_JSON_IDS,
  isHiveLinePostNamespace,channelFromCustomJsonId
} from "./registry.js";

export function isHiveLinePost(row, community = null) {
  if(!row||typeof row!=="object")return false;
  const id=row.custom_id;
  if(!isHiveLinePostNamespace(id))return false;
  if(community!==null && channelFromCustomJsonId(id)!==community)return false;
  const data=parseEmbeddedJson(row.json);
  return data && typeof data==="object" && !Array.isArray(data) &&
    data.app===HIVE_APP_ID && data.v===HIVE_PROTOCOL_VERSION &&
    (data.type==="post"||data.type==="reply") && data.channel===id &&
    typeof data.content==="string";
}
export function onlyHiveLinePosts(rows, community=null) {
  return (Array.isArray(rows)?rows:[]).filter(row=>isHiveLinePost(row,community));
}
export function mainHiveLinePosts(rows) {
  return onlyHiveLinePosts(rows).filter(row=>row.custom_id===HIVE_CUSTOM_JSON_IDS.POSTS);
}
