import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {HIVE_APP_ID,HIVE_PROTOCOL_VERSION,HIVE_CUSTOM_JSON_IDS,
  LEGACY_MICROFAIR_IDS,MAX_HIVELINE_CHANNEL_LENGTH,normalizeHiveLineChannel,
  resolveCustomJsonId,channelFromCustomJsonId} from "../js/hive/registry.js";
import {onlyHiveLinePosts,mainHiveLinePosts} from "../js/hive/content-scope.js";
import {processHiveLineRelationshipOps} from "../js/hive/relationships.js";
import {processChannelsData} from "../js/helpers/channels.js";
import {buildPostPayload,buildChannelCreatePayload} from "../js/hive/protocol.js";
import {proposeHiveV2Namespaces} from "../js/hive/v2-plan.js";
import {validateCustomJsonOperation} from "../js/hive/validator.js";
import {POSTS_CACHE_KEY,VOTES_CACHE_KEY,CHANNELS_CACHE_KEY,
  getChannelPostsCacheKey} from "../js/data/cache-keys.js";
import {POST_CACHE_DB_NAME,readPostCache} from "../js/data/post-cache.js";
import {POSTS_CUSTOM_ID,APP_ID,API_URL,VOTE_API_URL,CHANNELS_API_URL} from "../js/config.js";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const post=(id,outer="hiveline.posts",app="hiveline",v=2,channel=outer)=>({
  id,custom_id:outer,timestamp:"2026-11-07T12:00:00Z",required_posting_auths:["alice"],
  json:JSON.stringify({app,v,type:"post",channel,content:"Test",reply_to:null,mentions:[],tags:[]})
});
const relation=(id,signer,type,target)=>({
  id,custom_id:"hiveline.relationships",
  timestamp:"2026-11-07T12:00:"+String(id).padStart(2,"0")+"Z",
  required_posting_auths:[signer],
  json:JSON.stringify({app:"hiveline",v:2,type,target_user:target})
});

test("production IDs switched to HiveLine v2 and retain legacy IDs only as references",()=>{
  assert.equal(HIVE_APP_ID,"hiveline");
  assert.equal(APP_ID,"hiveline");
  assert.equal(HIVE_PROTOCOL_VERSION,2);
  assert.equal(POSTS_CUSTOM_ID,"hiveline.posts");
  assert.equal(HIVE_CUSTOM_JSON_IDS.POSTS,"hiveline.posts");
  assert.equal(HIVE_CUSTOM_JSON_IDS.VOTES,"hiveline.votes");
  assert.equal(HIVE_CUSTOM_JSON_IDS.MODERATION,"hiveline.moderation");
  assert.equal(HIVE_CUSTOM_JSON_IDS.CHANNEL_REGISTRY,"hiveline.communities");
  assert.equal(HIVE_CUSTOM_JSON_IDS.RELATIONSHIPS,"hiveline.relationships");
  assert.equal(HIVE_CUSTOM_JSON_IDS.COMMUNITY,"hiveline.c.{channel}");
  assert.equal(LEGACY_MICROFAIR_IDS.POSTS,"micro.fair");
  assert.equal(LEGACY_MICROFAIR_IDS.VOTES,"micro.fair.interation");
  for(const [action,id] of Object.entries({
    post:"hiveline.posts",reply:"hiveline.posts",upvote:"hiveline.votes",
    mute:"hiveline.moderation",follow:"hiveline.relationships",
    block:"hiveline.relationships",create_channel:"hiveline.communities"
  }))assert.equal(resolveCustomJsonId(action,{username:"alice"}),id);
  assert.ok(API_URL.includes("/hiveline.posts?limit=1000"));
  assert.ok(VOTE_API_URL.includes("/hiveline.votes?limit=1000"));
  assert.ok(CHANNELS_API_URL.includes("/hiveline.communities?limit=1000"));
});

test("community namespaces are new, prefixed and limited to 21 slug characters",()=>{
  assert.equal(MAX_HIVELINE_CHANNEL_LENGTH,21);
  assert.equal(resolveCustomJsonId("community-post",{channel:"dev"}),"hiveline.c.dev");
  assert.equal(resolveCustomJsonId("community-reply",{channel:"hiveline.c.dev"}),"hiveline.c.dev");
  assert.equal(resolveCustomJsonId("reply",{channel:"hiveline.c.dev"}),"hiveline.c.dev");
  assert.equal(channelFromCustomJsonId("hiveline.c.dev"),"dev");
  assert.equal(channelFromCustomJsonId("dev"),"");
  assert.equal(normalizeHiveLineChannel("Dev"),"dev");
  assert.equal(normalizeHiveLineChannel("x".repeat(21)),"x".repeat(21));
  assert.equal(normalizeHiveLineChannel("x".repeat(22)),"");
  assert.equal(resolveCustomJsonId("community-post",{channel:"bad/id"}),"");
});

test("all legacy posts are rejected even if found in cached data or wrong v2 namespace",()=>{
  const rows=[
    post(1),post(2,"hiveline.c.dev"),post(3,"micro.fair","micro.fair",1,"micro.fair"),
    post(4,"dev","micro.fair",1,"dev"),post(5,"hiveline.posts","micro.fair",1),
    post(6,"hiveline.posts","hiveline",1),
    post(7,"hiveline.posts","hiveline",2,"micro.fair"),
    post(8,"hiveline.c.dev","hiveline",2,"dev")
  ];
  assert.deepEqual(onlyHiveLinePosts(rows).map(x=>x.id),[1,2]);
  assert.deepEqual(mainHiveLinePosts(rows).map(x=>x.id),[1]);
  assert.deepEqual(onlyHiveLinePosts(rows,"dev").map(x=>x.id),[2]);
});

test("a fresh IndexedDB/localStorage namespace never imports old cached Micro.fair posts",async()=>{
  assert.equal(POST_CACHE_DB_NAME,"hiveline-v2-posts");
  assert.equal(POSTS_CACHE_KEY,"hivelineV2PostsCache");
  assert.equal(VOTES_CACHE_KEY,"hivelineV2VotesCache");
  assert.equal(CHANNELS_CACHE_KEY,"hivelineV2CommunitiesCache");
  assert.equal(getChannelPostsCacheKey("hiveline.c.dev"),"hivelineV2ChannelPosts_hiveline.c.dev");
  const values={"hiveAppPostsCache":JSON.stringify([post(7,"micro.fair","micro.fair",1,"micro.fair")])};
  const storage={getItem:k=>values[k]??null,setItem:(k,v)=>{values[k]=v;},removeItem:k=>{delete values[k];}};
  const driver={get:async()=>null,put:async()=>{},clear:async()=>{}};
  assert.deepEqual(await readPostCache("hiveline.posts",{storage,driver}),[]);
  assert.ok(values.hiveAppPostsCache);
  const state=read("js/state.js");
  assert.match(state,/hiveline_bookmarks_v2/);
  assert.match(state,/hiveline_joined_channels_v2/);
  assert.match(state,/allPosts = onlyHiveLinePosts\(posts\)/);
  assert.match(state,/allPostsToRender = onlyHiveLinePosts\(postsToRender\)/);
});

test("one shared relationships namespace separates actions and verifies signer",()=>{
  const ops=[
    relation(1,"alice","follow","bob"),relation(2,"alice","block","carol"),
    relation(3,"alice","unfollow","bob"),relation(4,"alice","follow","dave"),
    relation(5,"bob","follow","carol"),relation(6,"alice","unblock","carol"),
    relation(7,"alice","block","eve"),
    {...relation(8,"alice","follow","eve"),custom_id:"micro.fair.alice.follow"}
  ];
  assert.deepEqual([...processHiveLineRelationshipOps(ops,"alice","follow")],["dave"]);
  assert.deepEqual([...processHiveLineRelationshipOps(ops,"alice","block")],["eve"]);
  assert.deepEqual([...processHiveLineRelationshipOps(ops,"bob","follow")],["carol"]);
  assert.deepEqual([...processHiveLineRelationshipOps(ops,"alice","bad")],[]);
});

test("new community directory ignores all old registry entries",()=>{
  const payload=buildChannelCreatePayload({id:"dev",name:"Dev",description:"New",createdAt:"2026-11-07T12:00:00Z"});
  const mk=(id,outer,body)=>({id,custom_id:outer,required_posting_auths:["alice"],
    timestamp:"2026-11-07T12:00:00Z",json:JSON.stringify(body)});
  assert.deepEqual(processChannelsData([
    mk(1,"micro.fair.channels",{...payload,app:"micro.fair",v:1}),
    mk(2,"hiveline.communities",{...payload,app:"micro.fair",v:1}),
    mk(3,"hiveline.communities",payload)
  ]).map(x=>x.id),["dev"]);
});

test("v2 validator rejects legacy messages and identity preview reports active HiveLine",()=>{
  const payload=buildPostPayload({content:"New post"});
  assert.equal(payload.app,"hiveline");assert.equal(payload.v,2);
  assert.equal(payload.channel,"hiveline.posts");
  assert.equal(validateCustomJsonOperation({id:"hiveline.posts",json:payload,signer:"alice"}).valid,true);
  const old=validateCustomJsonOperation({
    id:"micro.fair",signer:"alice",json:{...payload,app:"micro.fair",v:1,channel:"micro.fair"}
  });
  assert.equal(old.valid,false);
  assert.match(old.errors.map(x=>x.message).join(" "),/Legacy Micro.fair IDs are disabled/);
  const plan=proposeHiveV2Namespaces("hiveline");
  assert.equal(plan.status,"active");assert.equal(plan.enabled,true);
  assert.equal(plan.ids.communityPosts,"hiveline.c.{channel}");
  assert.equal(proposeHiveV2Namespaces("anotherbrand").enabled,false);
});

test("application reads and writes are pinned to fresh namespaces",()=>{
  const api=read("js/api.js"),routing=read("js/routing.js"),templates=read("js/templates.js");
  assert.match(api,/readPostCache\(POSTS_CUSTOM_ID\)/);
  assert.match(api,/mainHiveLinePosts\(getHafsqlRows\(syncDataRaw\)\)/);
  assert.match(api,/relationshipResPromise/);
  assert.match(api,/processUserTargetOps\(relationshipDataRaw \|\| \[\], "follow"\)/);
  assert.match(routing,/cid === HIVE_CUSTOM_JSON_IDS.POSTS/);
  assert.match(templates,/>HiveLine</);
  assert.match(read("index.html"),/<title>HiveLine/);
  assert.match(read("docs/hive-protocol.md"),/hiveline.relationships/);
});
