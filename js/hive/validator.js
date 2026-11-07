/**
 * Offline, side-effect-free validation for Hive custom_json operation drafts.
 *
 * This checks local JSON shape/namespace consistency only. It NEVER verifies
 * a cryptographic signature, network authority or blockchain acceptance.
 * Historical v1 IDs are intentionally unchanged.
 */
import {
  HIVE_APP_ID, HIVE_PROTOCOL_VERSION, HIVE_CUSTOM_JSON_IDS,
  HIVE_ACTION_TYPES, getHiveAction, resolveCustomJsonId
} from "./registry.js";
import { safeHiveUsername } from "../security/safe-values.js";
import { ADMIN } from "../config.js";
import { parseChannelCustomId } from "../helpers/channel-id.js";

export const MAX_VALIDATOR_JSON_BYTES = 64 * 1024;
const types = new Set(Object.values(HIVE_ACTION_TYPES));
const signedAccountPattern = /^micro\.fair\.([a-z0-9._-]+)\.(follow|block)$/;
const own = (value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const validRef = value=>Number.isSafeInteger(value)&&value>0;
const isStringArray = value=>Array.isArray(value)&&value.length<=128&&
  value.every(item=>typeof item==="string"&&item.length<=80);
const push=(into,field,message)=>into.push({field,message});
const knownFields={
  post:["app","v","type","channel","content","reply_to","mentions","tags"],
  reply:["app","v","type","channel","content","reply_to","mentions","tags"],
  upvote:["app","v","type","content_id"],
  downvote:["app","v","type","content_id"],
  mute:["app","v","type","cause","content_id"],
  unmute:["app","v","type","content_id"],
  follow:["app","v","type","target_user"],
  unfollow:["app","v","type","target_user"],
  block:["app","v","type","target_user"],
  unblock:["app","v","type","target_user"],
  create_channel:["app","v","type","action","id","name","description","created_at"]
};

function classifyKnownNamespace(id,payload,signer) {
  if(id===HIVE_CUSTOM_JSON_IDS.POSTS && ["post","reply"].includes(payload.type))
    return {action:payload.type,kind:"feed"};
  if(id===HIVE_CUSTOM_JSON_IDS.VOTES)
    return {action:payload.type,kind:"votes"};
  if(id===HIVE_CUSTOM_JSON_IDS.MODERATION)
    return {action:payload.type,kind:"moderation"};
  if(id===HIVE_CUSTOM_JSON_IDS.CHANNEL_REGISTRY)
    return {action:payload.type,kind:"channels"};
  const userMatch=signedAccountPattern.exec(id);
  if(userMatch) {
    const family=userMatch[2];
    return {
      action:payload.type,kind:family,namespaceUser:userMatch[1]
    };
  }
  // A community uses its own exact ID and contains a post/reply with matching
  // channel. A random custom JSON operation must not be silently treated as
  // belonging to Micro.fair.
  if(payload.app===HIVE_APP_ID && ["post","reply"].includes(payload.type) && parseChannelCustomId(id))
    return {action:payload.type,kind:"community"};
  return null;
}

/**
 * @param {{id:string,json:string|object,signer?:string}} draft
 * @returns {{valid:boolean,recognized:boolean,requiresAcknowledgement:boolean,
 *    actionKey:string|null,errors:Array,warnings:Array,payload:object|null,id:string}}
 */
export function validateCustomJsonOperation(draft = {}) {
  const errors=[],warnings=[];
  const id=typeof draft.id==="string"?draft.id:"";
  const rawSigner=typeof draft.signer==="string"?draft.signer:"";
  const signer=safeHiveUsername(rawSigner);
  let payload=null;
  let parsed=false;
  let actionKey=null;
  let recognized=false;
  let requiresAcknowledgement=false;

  if(!id || id.trim()!==id || !/^[a-z0-9._-]+$/.test(id)) {
    push(errors,"id","Use a nonempty lowercase custom_json ID with letters, numbers, dots, underscores or hyphens.");
  }
  if(id.length>32) {
    push(errors,"id","The Custom JSON ID exceeds the supported 32-character limit.");
  }

  if(typeof draft.json==="string") {
    const raw=draft.json;
    if(!raw.trim()) push(errors,"json","Enter a JSON object before broadcasting.");
    else if(new TextEncoder().encode(raw).length>MAX_VALIDATOR_JSON_BYTES)
      push(errors,"json","The JSON payload exceeds the validator's 64 KiB safety limit.");
    else {
      try {payload=JSON.parse(raw);parsed=true;}
      catch {push(errors,"json","The JSON is not valid. Check commas, quotation marks and brackets.");}
    }
  } else if(draft.json && typeof draft.json==="object") {
    payload=draft.json;
    parsed=true;
    try {
      if(new TextEncoder().encode(JSON.stringify(payload)).length>MAX_VALIDATOR_JSON_BYTES)
        push(errors,"json","The JSON payload exceeds the validator's 64 KiB safety limit.");
    } catch {push(errors,"json","The JSON object cannot be serialized.");}
  } else {
    push(errors,"json","Enter a JSON object before broadcasting.");
  }

  if(parsed && (Array.isArray(payload)||typeof payload!=="object"||!payload)) {
    push(errors,"json","The payload must be a JSON object, not an array or primitive.");
    payload=null;
  }

  if(payload && id && errors.every(error=>error.field!=="id")) {
    const identified=classifyKnownNamespace(id,payload,signer);
    const isMicrofair=payload.app===HIVE_APP_ID || id===HIVE_APP_ID || id.startsWith(HIVE_APP_ID+".");
    if(!identified) {
      if(isMicrofair) {
        push(errors,"id","This ID/type combination is not registered in Micro.fair v1.");
      } else {
        requiresAcknowledgement=true;
        push(warnings,"id","Unregistered custom_json namespace. Micro.fair does not interpret this operation.");
      }
    } else {
      recognized=true;
      const {kind,namespaceUser}=identified;
      const type=payload.type;
      if(!types.has(type))push(errors,"type","Unsupported Micro.fair operation type.");
      const expectedActions={
        feed:["post","reply"],community:["post","reply"],
        votes:["upvote","downvote"],moderation:["mute","unmute"],
        channels:["create_channel"],follow:["follow","unfollow"],block:["block","unblock"]
      };
      if(!expectedActions[kind]?.includes(type)) {
        push(errors,"type","This operation type does not belong to the selected custom_json ID.");
      } else {
        actionKey=kind==="community"?"community-"+type:type;
      }
      if(payload.app!==HIVE_APP_ID)push(errors,"app","Expected app: micro.fair for protocol v1.");
      if(payload.v!==HIVE_PROTOCOL_VERSION)push(errors,"v","Expected v: 1 for the current on-chain protocol.");
      if(kind==="feed"||kind==="community") {
        if(payload.channel!==id)
          push(errors,"channel","The channel must exactly equal the outer custom_json ID.");
        if(typeof payload.content!=="string"||!payload.content.trim()||payload.content.length>2048)
          push(errors,"content","Content must be a nonempty string of at most 2,048 characters.");
        if(type==="reply"&&!validRef(payload.reply_to))
          push(errors,"reply_to","A reply needs a positive numeric parent operation ID.");
        if(type==="post" && payload.reply_to!==null)
          push(errors,"reply_to","A top-level post must set reply_to to null.");
        if(!isStringArray(payload.mentions)||payload.mentions.some(x=>safeHiveUsername(x)!==x))
          push(errors,"mentions","Mentions must be an array of valid lowercase Hive account names.");
        if(!isStringArray(payload.tags)||payload.tags.some(x=>!parseChannelCustomId(x)))
          push(errors,"tags","Tags must be an array of valid lowercase topic IDs.");
      }
      if(["votes","moderation"].includes(kind)&&!validRef(payload.content_id))
        push(errors,"content_id","Provide a positive numeric HAFSQL content operation ID.");
      if(kind==="moderation") {
        if(signer!==ADMIN)
          push(errors,"signer","Moderation operations require the configured admin account (@" + ADMIN + ").");
        if(type==="mute" && (typeof payload.cause!=="string"||!payload.cause.trim()))
          push(errors,"cause","Mute operations need a nonempty moderation reason.");
      }
      if(kind==="follow"||kind==="block") {
        if(signer==="unknown"||namespaceUser!==signer)
          push(errors,"id","The {user} in this namespace must match the signing Hive account.");
        const target=safeHiveUsername(payload.target_user);
        if(target==="unknown"||target!==payload.target_user||target===signer)
          push(errors,"target_user","Provide another valid, lowercase Hive username as target_user.");
      }
      if(kind==="channels") {
        if(parseChannelCustomId(payload.id)!==payload.id)
          push(errors,"id","Community ID must be valid and already normalized.");
        if(typeof payload.name!=="string"||!payload.name.trim())
          push(errors,"name","Community name is required.");
        if(typeof payload.description!=="string")
          push(errors,"description","Community description must be a string.");
        if(payload.action!=="create_channel")
          push(errors,"action","The v1 registry requires action: create_channel.");
        if(typeof payload.created_at!=="string" ||
           !/^\d{4}-\d{2}-\d{2}T/.test(payload.created_at) ||
           !Number.isFinite(Date.parse(payload.created_at)))
          push(errors,"created_at","Provide a valid ISO timestamp in created_at.");
      }
      const allowed=own(knownFields,type)?knownFields[type]:[];
      const extras=Object.keys(payload).filter(key=>!allowed.includes(key));
      if(extras.length)push(warnings,"json","Extra fields not defined in v1: "+extras.slice(0,8).join(", ")+".");
      if(errors.length===0)push(warnings,"signature",
        "Structure checked locally only. Signature authorization and blockchain acceptance are checked when submitting.");
    }
  }

  return {
    valid:errors.length===0,
    recognized,requiresAcknowledgement,actionKey,
    id,payload,errors,warnings
  };
}

export function mayBroadcastValidatedOperation(report,acknowledged=false) {
  return Boolean(report?.valid &&
    (!report.requiresAcknowledgement || acknowledged));
}
