import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  POST_CACHE_DB_NAME, POST_CACHE_STORE,
  createIndexedPostStore, getLegacyPostCacheKey,
  readPostCache, writePostCache, clearPostCaches
} from "../js/data/post-cache.js";
import { mergePostSnapshots } from "../js/data/post-merge.js";

function memoryDriver() {
  const snapshots = new Map();
  return {
    snapshots,
    async get(namespace) { return snapshots.get(namespace) ?? null; },
    async put(namespace, posts) { snapshots.set(namespace, structuredClone(posts)); },
    async clear() { snapshots.clear(); }
  };
}

function fakeStorage(initial = {}) {
  const storage = {
    getItem(key) { return Object.hasOwn(this, key) ? this[key] : null; },
    setItem(key, value) { this[key] = String(value); },
    removeItem(key) { delete this[key]; }
  };
  for (const [k,v] of Object.entries(initial)) storage.setItem(k,v);
  return storage;
}

const post = (id, timestamp = "2026-11-07T00:00:00Z", customId = "hiveline.posts", extra = {}) =>
  ({id, timestamp, custom_id:customId, ...extra});

test("legacy main feed migrates to IndexedDB without dropping data", async () => {
  const items = [post(3), post(2)];
  const storage = fakeStorage({hivelineV2PostsCache:JSON.stringify(items)});
  const driver = memoryDriver();
  const result = await readPostCache("hiveline.posts",{storage,driver});
  assert.deepEqual(result,items);
  assert.deepEqual(driver.snapshots.get("hiveline.posts"),items);
  assert.equal(storage.getItem("hivelineV2PostsCache"),null);
  assert.deepEqual(await readPostCache("hiveline.posts",{storage,driver}),items);
  assert.equal(getLegacyPostCacheKey("hiveline.posts"),"hivelineV2PostsCache");
});

test("dotted channels and undotted channels remain separate namespaces", async () => {
  const driver=memoryDriver(), storage=fakeStorage();
  const a=[post(3,undefined,"hiveline.c.hive.micro")];
  const b=[post(4,undefined,"hiveline.c.hivemicro")];
  assert.equal(await writePostCache("hiveline.c.hive.micro",a,{storage,driver}),"indexeddb");
  assert.equal(await writePostCache("hiveline.c.hivemicro",b,{storage,driver}),"indexeddb");
  assert.deepEqual(await readPostCache("hiveline.c.hive.micro",{storage,driver}),a);
  assert.deepEqual(await readPostCache("hiveline.c.hivemicro",{storage,driver}),b);
  assert.equal(driver.snapshots.size,2);
  assert.equal(getLegacyPostCacheKey("hiveline.c.hive.micro"),"hivelineV2ChannelPosts_hiveline.c.hive.micro");
});

test("offline IDB failure preserves legacy data",async()=>{
  const data=[post(10)];
  const storage=fakeStorage({hivelineV2PostsCache:JSON.stringify(data)});
  const driver={
    async get(){ throw new Error("IDB blocked"); },
    async put(){ throw new Error("IDB blocked"); },
    async clear(){ throw new Error("IDB blocked"); }
  };
  assert.deepEqual(await readPostCache("hiveline.posts",{storage,driver}),data);
  assert.equal(storage.getItem("hivelineV2PostsCache"),JSON.stringify(data));
  const latest=[post(11),post(10)];
  assert.equal(await writePostCache("hiveline.posts",latest,{storage,driver}),"localStorage");
  assert.deepEqual(JSON.parse(storage.getItem("hivelineV2PostsCache")),latest);
});

test("migration write failure does not delete the only copy", async()=>{
  const data=[post(11)];
  const storage=fakeStorage({hivelineV2PostsCache:JSON.stringify(data)});
  const driver={
    async get(){return null;},
    async put(){throw new Error("disk full");},
    async clear(){}
  };
  assert.deepEqual(await readPostCache("hiveline.posts",{storage,driver}),data);
  assert.equal(storage.getItem("hivelineV2PostsCache"),JSON.stringify(data));
});

test("newer fallback data supersedes a stale IndexedDB snapshot",async()=>{
  const storage=fakeStorage(), driver=memoryDriver();
  const yesterday=[post(1,"2026-11-06T00:00:00Z")];
  const today=[post(2,"2026-11-07T00:00:00Z"),...yesterday];
  await driver.put("hiveline.posts",yesterday);
  storage.setItem("hivelineV2PostsCache",JSON.stringify(today));
  assert.deepEqual(await readPostCache("hiveline.posts",{storage,driver}),today);
  assert.deepEqual(driver.snapshots.get("hiveline.posts"),today);
  assert.equal(storage.getItem("hivelineV2PostsCache"),null);
});

test("old localStorage snapshot cannot overwrite newer IndexedDB data",async()=>{
  const storage=fakeStorage(), driver=memoryDriver();
  const yesterday=[post(1,"2026-11-06T00:00:00Z")];
  const today=[post(2,"2026-11-07T00:00:00Z")];
  await driver.put("hiveline.posts",today);
  storage.setItem("hivelineV2PostsCache",JSON.stringify(yesterday));
  assert.deepEqual(await readPostCache("hiveline.posts",{storage,driver}),today);
  assert.equal(storage.getItem("hivelineV2PostsCache"),null);
});

test("clear removes main and channel caches but keeps unrelated preferences",async()=>{
  const storage=fakeStorage({
    hivelineV2PostsCache:"[]",
    "hivelineV2ChannelPosts_hiveline.c.hive.micro":"[]",
    hivelineV2VotesCache:"[]",
    micro_bookmarks:"[1]"
  }), driver=memoryDriver();
  await driver.put("hiveline.posts",[post(1)]);
  await driver.put("hiveline.c.hive.micro",[post(2)]);
  assert.equal(await clearPostCaches({storage,driver}),true);
  assert.equal(driver.snapshots.size,0);
  assert.equal(storage.getItem("hivelineV2PostsCache"),null);
  assert.equal(storage.getItem("hivelineV2ChannelPosts_hiveline.c.hive.micro"),null);
  assert.equal(storage.getItem("hivelineV2VotesCache"),"[]");
  assert.equal(storage.getItem("micro_bookmarks"),"[1]");
});

test("overlapping HAFSQL results deduplicate by namespace and operation id",()=>{
  const cached=[post(8,"2026-11-06T00:00:00Z"),post(7)];
  const fresh=[post(9,"2026-11-07T01:00:00Z"),post(8,"2026-11-07T00:30:00Z", "hiveline.posts",{json:"fresh"})];
  const merged=mergePostSnapshots(fresh,cached);
  assert.deepEqual(merged.map(p=>p.id),[9,8,7]);
  assert.equal(merged.find(p=>p.id===8).json,"fresh");
  assert.equal(mergePostSnapshots(fresh,cached,{limit:2}).length,2);
  const sameIdDifferentNamespace=mergePostSnapshots([post(8,undefined,"hiveline.c.hive.micro")],[post(8,undefined,"hiveline.c.hivemicro")]);
  assert.equal(sameIdDifferentNamespace.length,2);
});

// Minimal event-driven IndexedDB fake verifies the adapter uses transactions,
// not synchronous localStorage code paths, without a dependency on a DOM runner.
function fakeIndexedDb() {
  const records=new Map();
  let created=false, openCount=0, closed=0;
  const factory={
    open() {
      openCount++;
      const req={result:null};
      queueMicrotask(()=>{
        const db={
          objectStoreNames:{contains:()=>created},
          createObjectStore(){created=true;},
          transaction(){
            const tx={
              objectStore(){
                const query=(kind,value)=>{
                  const r={};
                  queueMicrotask(()=>{
                    if(kind==="get")r.result=records.get(value);
                    if(kind==="put")records.set(value.namespace,value);
                    if(kind==="clear")records.clear();
                    r.onsuccess?.();
                    queueMicrotask(()=>tx.oncomplete?.());
                  });
                  return r;
                };
                return {
                  get:key=>query("get",key),
                  put:value=>query("put",value),
                  clear:()=>query("clear")
                };
              }
            };
            return tx;
          },
          close(){closed++;}
        };
        req.result=db;
        if(!created)req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    }
  };
  return {factory,records,stats:()=>({openCount,closed})};
}

test("IndexedDB driver creates store and supports get/put/clear",async()=>{
  const {factory,stats}=fakeIndexedDb();
  const driver=createIndexedPostStore(factory);
  assert.equal(POST_CACHE_DB_NAME,"hiveline-v2-posts");
  assert.equal(POST_CACHE_STORE,"feeds");
  assert.equal(await driver.get("hiveline.c.hive.micro"),null);
  const value=[post(19,undefined,"hiveline.c.hive.micro")];
  await driver.put("hiveline.c.hive.micro",value);
  assert.deepEqual(await driver.get("hiveline.c.hive.micro"),value);
  await driver.clear();
  assert.equal(await driver.get("hiveline.c.hive.micro"),null);
  assert.equal(stats().openCount,stats().closed);
});

test("API and channel state use IndexedDB adapter",()=>{
  const api=readFileSync(new URL("../js/api.js",import.meta.url),"utf8");
  const state=readFileSync(new URL("../js/state.js",import.meta.url),"utf8");
  assert.match(api,/readPostCache\(POSTS_CUSTOM_ID\)/);
  assert.match(api,/writePostCache\(POSTS_CUSTOM_ID, finalPosts\)/);
  assert.match(api,/readPostCache\(cleanId\)/);
  assert.match(api,/await clearPostCaches\(\)/);
  assert.match(state,/writePostCache\(clean, list\.slice\(0, 1000\)\)/);
  assert.doesNotMatch(api,/localStorage\.setItem\(POSTS_CACHE_KEY/);
});
