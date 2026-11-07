import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildHafsqlCustomJsonUrl } from "../js/data/hafsql.js";
import {
  syncAuxiliaryData, syncUserTargetOps, fetchPaginatedOperations,
} from "../js/data/sync.js";

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) { return map.get(key) ?? null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    snapshot() { return Object.fromEntries(map); },
  };
}
const logger = {error() {}};

test("first auxiliary sync caches results under the legacy key", async () => {
  const storage = fakeStorage();
  const url = buildHafsqlCustomJsonUrl("hiveline.votes");
  const visited = [];
  const results = await syncAuxiliaryData("hivelineV2VotesCache", url, {
    storage, logger,
    load: async nextUrl => {
      visited.push(nextUrl);
      return {rows:[{id:42},{id:41}]};
    }
  });
  assert.deepEqual(visited,[url]);
  assert.deepEqual(results,[{id:42},{id:41}]);
  assert.equal(storage.getItem("hivelineV2VotesCache"),JSON.stringify(results));
});

test("cached auxiliary sync requests reverse cursor and preserves old records", async () => {
  const storage = fakeStorage({
    hivelineV2VotesCache: JSON.stringify([{id:40},{id:39}])
  });
  const visited=[];
  const url=buildHafsqlCustomJsonUrl("hiveline.votes");
  const result=await syncAuxiliaryData("hivelineV2VotesCache",url,{
    storage,logger,
    load:async nextUrl=>{
      visited.push(nextUrl);
      return [{id:42},{id:41}];
    }
  });
  assert.equal(new URL(visited[0]).searchParams.get("limit"),"-1000");
  assert.equal(new URL(visited[0]).searchParams.get("start"),"40");
  assert.deepEqual(result.map(x=>x.id),[42,41,40,39]);
});

test("sync falls back to cached records on network failure", async () => {
  const storage=fakeStorage({hivelineV2VotesCache:JSON.stringify([{id:20}])});
  const result=await syncAuxiliaryData("hivelineV2VotesCache",
    buildHafsqlCustomJsonUrl("hiveline.votes"),{
      storage,logger,load:async()=>{throw new Error("offline");}
    });
  assert.deepEqual(result,[{id:20}]);
  assert.equal(storage.getItem("hivelineV2VotesCache"),JSON.stringify([{id:20}]));
});

test("user-scoped block and follow sync never share caches", async () => {
  const storage=fakeStorage();
  const url=buildHafsqlCustomJsonUrl("hiveline.relationships");
  const called=[];
  const options={
    storage,logger,
    load:async u=>{
      called.push(u);
      return {rows:[{id:1}]};
    }
  };
  await syncUserTargetOps("hivelineV2FollowsCache",url,"alice",options);
  await syncUserTargetOps("hivelineV2FollowsCache",url,"bob",options);
  assert.equal(called.length,2);
  assert.ok(called[0].includes("hiveline.relationships"));
  assert.ok(called[1].includes("hiveline.relationships"));
  assert.ok(storage.getItem("hivelineV2FollowsCache.alice"));
  assert.ok(storage.getItem("hivelineV2FollowsCache.bob"));
  assert.deepEqual(await syncUserTargetOps("hivelineV2FollowsCache",url,null,options),[]);
});

test("paginated initial sync follows the last operation ID",async()=>{
  const url=buildHafsqlCustomJsonUrl("hiveline.posts",{limit:2});
  const calls=[];
  const payloads=[
    [{id:6},{id:5}],
    {rows:[{id:4},{id:3}]},
    {rows:[{id:2}]}
  ];
  const got=await fetchPaginatedOperations(url,{
    pageSize:2,maxOperations:20,delayMs:0,
    pause:async()=>{},
    load:async u=>{calls.push(u);return payloads.shift();}
  });
  assert.deepEqual(got.map(x=>x.id),[6,5,4,3,2]);
  assert.equal(calls.length,3);
  assert.equal(new URL(calls[1]).searchParams.get("start"),"5");
  assert.equal(new URL(calls[2]).searchParams.get("start"),"3");
});

test("api uses sync module instead of carrying implementation inline",()=>{
  const api=readFileSync(new URL("../js/api.js",import.meta.url),"utf8");
  assert.match(api,/from "\.\/data\/sync\.js"/);
  assert.match(api,/fetchPaginatedOperations\(API_URL\)/);
  assert.match(api,/syncAuxiliaryData\(VOTES_CACHE_KEY/);
  assert.doesNotMatch(api,/function syncAndGetAuxData\(/);
  assert.doesNotMatch(api,/function fetchDataInLoopGeneric\(/);
});
