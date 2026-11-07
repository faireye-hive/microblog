import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  APP_ID, API_URL, VOTE_API_URL, ADMIN_POST_MUTE_API_URL,
  USER_BLOCK_API_URL, USER_FOLLOW_API_URL, CHANNELS_API_URL,
} from "../js/config.js";
import {
  buildPostPayload, buildVotePayload, buildMutePayload,
  buildUserActionPayload, buildChannelCreatePayload,
} from "../js/hive/protocol.js";
import { hasHiveKeychain, requestHiveCustomJson } from "../js/hive/keychain.js";
import {
  buildHafsqlCustomJsonUrl, withHafsqlCursor, getHafsqlRows,
  fetchHafsqlPayload,
} from "../js/data/hafsql.js";
import {
  POSTS_CACHE_KEY, VOTES_CACHE_KEY, MUTES_CACHE_KEY,
  CHANNELS_CACHE_KEY, getChannelPostsCacheKey, getUserCacheKey
} from "../js/data/cache-keys.js";

test("production protocol generates HiveLine custom_json v2", () => {
  assert.equal(APP_ID, "hiveline");
  assert.deepEqual(buildPostPayload({
    content: "Olá #hive", channel: "hive.micro", mentions: ["bob"], tags: ["hive"]
  }), {
    app: "hiveline", v: 2, type: "post", channel: "hive.micro",
    content: "Olá #hive", reply_to: null, mentions: ["bob"], tags: ["hive"]
  });
  assert.equal(buildPostPayload({content: "response", replyTo: 123}).type, "reply");
  assert.deepEqual(buildVotePayload(123,"upvote"), {
    app:"hiveline",v:2,type:"upvote",content_id:123
  });
  assert.deepEqual(buildMutePayload(8,"mute","spam"), {
    app:"hiveline",v:2,type:"mute",cause:"spam",content_id:8
  });
  assert.deepEqual(buildMutePayload(8,"unmute"), {
    app:"hiveline",v:2,type:"unmute",content_id:8
  });
  assert.deepEqual(buildUserActionPayload("follow","alice"), {
    app:"hiveline",v:2,type:"follow",target_user:"alice"
  });
  const channel = buildChannelCreatePayload({
    id:"hive.micro",name:"Hive Micro",description:"The original channel",
    createdAt:"2026-11-07T00:00:00Z"
  });
  assert.deepEqual(channel,{
    app:"hiveline",v:2,type:"create_channel",action:"create_channel",
    id:"hive.micro",name:"Hive Micro",description:"The original channel",
    created_at:"2026-11-07T00:00:00Z"
  });
});

test("HAFSQL URL builder keeps dotted IDs and user templates", () => {
  assert.equal(buildHafsqlCustomJsonUrl("hive.micro"),
    "https://rpc.mahdiyari.info/hafsql/operations/custom_json/hive.micro?limit=1000");
  assert.equal(buildHafsqlCustomJsonUrl("hive.micro",{limit:25,start:99}),
    "https://rpc.mahdiyari.info/hafsql/operations/custom_json/hive.micro?limit=25&start=99");
  assert.ok(API_URL.endsWith("/hiveline.posts?limit=1000"));
  assert.ok(VOTE_API_URL.includes("/hiveline.votes?limit=1000"));
  assert.ok(ADMIN_POST_MUTE_API_URL.includes("/hiveline.moderation?limit=1000"));
  assert.ok(CHANNELS_API_URL.includes("/hiveline.communities?limit=1000"));
  assert.ok(USER_BLOCK_API_URL.includes("hiveline.relationships?limit=1000"));
  assert.ok(USER_FOLLOW_API_URL.includes("hiveline.relationships?limit=1000"));
  assert.ok(USER_FOLLOW_API_URL.replace("{user}","bob").includes("/hiveline.relationships"));
  assert.equal(withHafsqlCursor(API_URL,{limit:-1000,start:345}),
    "https://rpc.mahdiyari.info/hafsql/operations/custom_json/hiveline.posts?limit=-1000&start=345");
});

test("HAFSQL data normalizer supports API array and rows envelopes", () => {
  const rows = [{id:1},{id:2}];
  assert.deepEqual(getHafsqlRows(rows),rows);
  assert.deepEqual(getHafsqlRows({rows}),rows);
  assert.deepEqual(getHafsqlRows({rows:null}),[]);
  assert.deepEqual(getHafsqlRows(null),[]);
});

test("HAFSQL transport handles HTTP failure and successful JSON", async () => {
  const seen=[];
  const success=await fetchHafsqlPayload("https://mock.example/x",async url=>{
    seen.push(url);
    return {ok:true,status:200,json:async()=>({rows:[{id:17}]})};
  });
  assert.deepEqual(seen,["https://mock.example/x"]);
  assert.deepEqual(getHafsqlRows(success),[{id:17}]);
  await assert.rejects(
    fetchHafsqlPayload("https://mock.example/y",async()=>({
      ok:false,status:503,json:async()=>({})
    })),
    /HTTP 503/
  );
});

test("Keychain adapter signs with Posting and forwards original parameters", () => {
  assert.equal(hasHiveKeychain(null),false);
  assert.equal(requestHiveCustomJson("alice","hive.micro","{}","Post",()=>{},null),false);
  const calls=[];
  const stub={requestCustomJson(...args){calls.push(args);}};
  const done=()=>{};
  assert.equal(hasHiveKeychain(stub),true);
  assert.equal(requestHiveCustomJson("alice","hive.micro",'{"type":"post"}',"Post",done,stub),true);
  assert.deepEqual(calls[0],[
    "alice","hive.micro","Posting",'{"type":"post"}',"Post",done
  ]);
});

test("cache names retain existing users' localStorage data", () => {
  assert.equal(POSTS_CACHE_KEY,"hivelineV2PostsCache");
  assert.equal(VOTES_CACHE_KEY,"hivelineV2VotesCache");
  assert.equal(MUTES_CACHE_KEY,"hivelineV2MutesCache");
  assert.equal(CHANNELS_CACHE_KEY,"hivelineV2CommunitiesCache");
  assert.equal(getChannelPostsCacheKey("hive.micro"),"hivelineV2ChannelPosts_hive.micro");
  assert.equal(getUserCacheKey("hivelineV2FollowsCache","alice"),"hivelineV2FollowsCache.alice");
});

test("api.js has no direct Keychain calls or HAFSQL fetch requests", () => {
  const api=readFileSync(new URL("../js/api.js",import.meta.url),"utf8");
  const app=readFileSync(new URL("../js/app.js",import.meta.url),"utf8");
  assert.doesNotMatch(api,/window\.hive_keychain/);
  assert.doesNotMatch(app,/window\.hive_keychain/);
  assert.doesNotMatch(api,/await fetch\(/);
  assert.match(api,/from "\.\/data\/hafsql\.js"/);
  assert.match(api,/from "\.\/hive\/protocol\.js"/);
  assert.match(api,/from "\.\/hive\/keychain\.js"/);
});
