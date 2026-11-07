/** Resolve v2 follow and block states from one shared Hive namespace.
 * Neither the payload's target nor the ID string proves who signed an action.
 */
import { parseEmbeddedJson } from "../utils.js";
import { safeHiveUsername } from "../security/safe-values.js";
import { HIVE_APP_ID,HIVE_PROTOCOL_VERSION,HIVE_CUSTOM_JSON_IDS } from "./registry.js";

export function processHiveLineRelationshipOps(rows,signer,family) {
  const account=safeHiveUsername(signer);
  if(account==="unknown"||!["follow","block"].includes(family))return new Set();
  const positive=family;
  const negative=family==="follow"?"unfollow":"unblock";
  const matches=(Array.isArray(rows)?rows:[]).filter(row=>
    row?.custom_id===HIVE_CUSTOM_JSON_IDS.RELATIONSHIPS &&
    row.required_posting_auths?.[0]===account);
  matches.sort((a,b)=>(Date.parse(a.timestamp)||0)-(Date.parse(b.timestamp)||0) ||
    Number(a.id||0)-Number(b.id||0));
  const result=new Set();
  for(const row of matches) {
    const data=parseEmbeddedJson(row.json);
    if(!data||data.app!==HIVE_APP_ID||data.v!==HIVE_PROTOCOL_VERSION)continue;
    if(data.type!==positive&&data.type!==negative)continue;
    const target=safeHiveUsername(data.target_user);
    if(target==="unknown"||target!==data.target_user||target===account)continue;
    if(data.type===positive)result.add(target);
    else result.delete(target);
  }
  return result;
}
