import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getPostIndex, postKey, getPostById, getDirectReplies,
  countDirectReplies, invalidatePostIndex
} from "../js/data/post-index.js";

const op=(id, replyTo=null, extra={})=>({
  id, timestamp:"2026-11-07T00:00:00Z",
  json: JSON.stringify({type:replyTo ? "reply":"post",reply_to:replyTo,content:`post ${id}`}),
  required_posting_auths:["alice"],...extra
});

test("index groups replies and lookup accepts numeric/string identifiers",()=>{
  const posts=[op(100),op(101,"100"),op(102,100),op(103,101),op(104)];
  const index=getPostIndex(posts);
  assert.equal(index.byId.size,5);
  assert.equal(getPostById(posts,"100"),posts[0]);
  assert.equal(getPostById(posts,100),posts[0]);
  assert.deepEqual(getDirectReplies(posts,100).map(x=>x.id),[101,102]);
  assert.equal(countDirectReplies(posts,"100"),2);
  assert.equal(countDirectReplies(posts,101),1);
  assert.equal(countDirectReplies(posts,104),0);
  assert.equal(postKey(123),"123");
});

test("cached index is reused without re-parsing the same JSON",()=>{
  const posts=[op(1),op(2,1),op(3,1)];
  const first=getPostIndex(posts);
  assert.equal(getPostIndex(posts),first);
  assert.equal(countDirectReplies(posts,1),2);
});

test("array additions invalidate the cached index automatically",()=>{
  const posts=[op(1),op(2,1)];
  const first=getPostIndex(posts);
  posts.unshift(op(3,1));
  assert.notEqual(getPostIndex(posts),first);
  assert.equal(countDirectReplies(posts,1),2);
});

test("explicit invalidation supports in-place post edits",()=>{
  const posts=[op(1),op(2)];
  const first=getPostIndex(posts);
  posts[1].json=JSON.stringify({type:"reply",reply_to:1,content:"new"});
  assert.equal(getPostIndex(posts),first);
  invalidatePostIndex(posts);
  assert.equal(countDirectReplies(posts,1),1);
});

test("invalid input and malformed JSON do not crash the index",()=>{
  assert.equal(getPostById(null,1),undefined);
  assert.deepEqual(getDirectReplies(null,1),[]);
  const posts=[op(1), {id:2,json:"not json"}, null];
  assert.equal(getPostIndex(posts).byId.size,2);
  assert.equal(countDirectReplies(posts,1),0);
});

test("post ID collision across different list snapshots cannot mix index results",()=>{
  const main=[op(9),op(10,9)];
  const channel=[op(9),op(11,9),op(12,9)];
  assert.equal(countDirectReplies(main,9),1);
  assert.equal(countDirectReplies(channel,9),2);
  assert.notEqual(getPostIndex(main),getPostIndex(channel));
});

test("render, state and routing use shared indexed lookups",()=>{
  const render=readFileSync(new URL("../js/render.js",import.meta.url),"utf8");
  const state=readFileSync(new URL("../js/state.js",import.meta.url),"utf8");
  const routing=readFileSync(new URL("../js/routing.js",import.meta.url),"utf8");
  assert.match(render,/countDirectReplies\(allPosts, p\.id\)/);
  assert.match(render,/getDirectReplies\(allPosts, parentId\)/);
  assert.match(render,/getPostById\(allPosts, parsed\.reply_to\)/);
  assert.match(state,/getPostIndex\(allPosts\)\.replyCounts/);
  assert.match(state,/const postPool = activeChannel \? getChannelPosts\(activeChannel\) : allPosts/);
  assert.match(state,/buildPostCard\(p, postPool, voteCounts, mutedPostIds\)/);
  assert.match(routing,/getPostById\(allPosts, postId\)/);
  assert.doesNotMatch(render,/allPosts\.filter\(/);
});

test("recursive thread rendering skips malformed reference cycles",async()=>{
  globalThis.localStorage ??= {
    getItem(){ return null; },
    setItem(){},
    removeItem(){}
  };
  const {buildRepliesRecursive}=await import("../js/render.js");
  const posts=[op(1,2),op(2,1),op(3,1)];
  const result=buildRepliesRecursive(1,posts);
  assert.match(result,/post 2/);
  assert.match(result,/post 3/);
  assert.ok(result.length<20000, "cycles must not yield unbounded HTML");
});
