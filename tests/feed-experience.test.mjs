import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
globalThis.localStorage ??= {getItem(){return null;},setItem(){},removeItem(){}};
globalThis.document ??= {
  createElement(tag) {
    const attrs={};
    return {
      tagName:tag.toUpperCase(),className:"",innerHTML:"",
      setAttribute:(key,val)=>{attrs[key]=String(val);},
      getAttribute:key=>attrs[key]??null
    };
  },
  getElementById(){return null;}
};

const state=await import("../js/state.js");
const {buildPostCard,buildRepliesRecursive,buildThreadAbove}=await import("../js/render.js");
const post=(id,author,content,replyTo=null)=>({
  id,
  required_posting_auths:[author],
  timestamp:"2026-11-07T12:00:00Z",
  custom_id:"micro.fair",
  json:JSON.stringify({app:"micro.fair",v:1,type:replyTo?"reply":"post",content,
    ...(replyTo?{reply_to:replyTo}:{})})
});

test("the new feed design loads after the editorial layer and stays responsive",()=>{
  const html=read("index.html");
  const css=read("css/feed-experience.css");
  assert.ok(html.indexOf('href="./css/feed-experience.css"')>
    html.indexOf('href="./css/editorial.css"'));
  for(const sel of [
    ".post-vote-group",".post-actions-primary",".post-actions-secondary",
    ".post-reply-cta",".post-external-link",".post-image-trigger",
    ".post-parent-context",".reply-input-box",".reply-thread-item",
    ".conversation-panel",".post-lightbox",".user-popover-menu"
  ])assert.ok(css.includes(sel),sel);
  assert.match(css,/@media \(max-width: 640px\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/:focus-visible/);
  assert.match(html,/script-src 'self'/);
});

test("post cards keep on-chain actions and make UI controls accessible",()=>{
  state.setLoggedInUser("sm-silva");
  state.setFollowedUsers(new Set());
  state.setBlockedUsers(new Set());
  const root=post(101,"faireye","Testing the new feed");
  const reply=post(102,"peak.snaps","Great news!",101);
  const html=buildPostCard(root,[root,reply],{101:{upvote:15,downvote:2}}).innerHTML;
  assert.match(html,/data-vote="upvote"/);
  assert.match(html,/data-vote="downvote"/);
  assert.match(html,/aria-label="Upvote: 15 votes"/);
  assert.match(html,/aria-label="Downvote: 2 votes"/);
  assert.match(html,/class="post-vote-group"/);
  assert.match(html,/class="post-actions-primary"/);
  assert.match(html,/class="post-actions-secondary"/);
  assert.match(html,/class="post-action-btn thread-btn"/);
  assert.match(html,/aria-expanded="false" aria-controls="thread-101"/);
  assert.match(html,/View replies: 1/);
  assert.match(html,/class="post-action-btn reply-btn post-reply-cta"/);
  assert.match(html,/class="post-action-btn post-share-btn"/);
  assert.match(html,/aria-pressed="false"/);
  assert.match(html,/id="author-popover-101"/);
  assert.match(html,/aria-controls="author-popover-101"/);
  assert.match(html,/data-action="follow"/);
  assert.match(html,/data-action="block"/);
  assert.doesNotMatch(html,/post-more-btn/,"do not keep inert more actions");
  state.setLoggedInUser(null);
});

test("links show actual hostname without invented captions or stock thumbnails",()=>{
  const root=post(110,"faireye","Explore https://example.org/research?utm=abc");
  const html=buildPostCard(root,[root]).innerHTML;
  assert.match(html,/class="preview-box post-external-link"/);
  assert.match(html,/EXTERNAL LINK/);
  assert.match(html,/example\.org/);
  assert.match(html,/rel="noopener noreferrer"/);
  assert.doesNotMatch(html,/images\.unsplash\.com/);
  assert.doesNotMatch(html,/Live price, volume/);
  assert.doesNotMatch(html,/Click to explore content on Hive network/);
});

test("image grids expose keyboard-native triggers and validated image sources",()=>{
  const root=post(120,"faireye",
    "Photos ![one](https://images.example.org/1.png) ![two](https://images.example.org/2.png)");
  const html=buildPostCard(root,[root]).innerHTML;
  assert.match(html,/post-image-grid-multi/);
  assert.equal((html.match(/class="post-image-trigger"/g)||[]).length,2);
  assert.match(html,/aria-label="Open image 1 of 2"/);
  assert.match(html,/aria-label="Open image 2 of 2"/);
  assert.match(html,/data-full-src="https:\/\/images\.example\.org\/1\.png"/);
  const single=buildPostCard(post(121,"faireye","![one](https://images.example.org/1.png)"),[]).innerHTML;
  assert.match(single,/post-image-grid-single/);
  assert.doesNotMatch(single,/javascript:alert/);
});

test("nested replies are escaped, readable and individually replyable",()=>{
  const root=post(130,"faireye","Hello");
  const reply=post(131,"peak.snaps","Thanks <img src=x onerror=alert(1)>",130);
  const nested=post(132,"sm-silva","Nested reply",131);
  const pool=[root,reply,nested];
  const html=buildRepliesRecursive(130,pool);
  assert.match(html,/class="reply-thread-item" data-depth="1"/);
  assert.match(html,/class="reply-thread-item" data-depth="2"/);
  assert.match(html,/class="reply-inline-action reply-btn"/);
  assert.match(html,/data-id="131"/);
  assert.match(html,/aria-label="Reply to @peak.snaps"/);
  assert.doesNotMatch(html,/<img src=x onerror=alert\(1\)>/);
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  const context=buildThreadAbove(reply,pool);
  assert.match(context,/class="view-thread post-context-author"/);
  assert.match(context,/data-id="130"/);
});

test("app keeps working actions, keyboard behavior and focus return for image lightbox",()=>{
  const app=read("js/app.js");
  const routes=read("js/routing.js");
  for(const snippet of [
    'e.target.closest(".post-image-trigger")',
    'e.target.closest(".post-share-btn")',
    'await navigator.share(',
    'navigator.clipboard?.writeText',
    'sharePostLink(shareBtn.dataset.id)',
    'showImageModal(image?.dataset.fullSrc, imageTrigger)',
    'imageModalReturnFocus?.focus?.()',
    'event.key === "Escape"',
    'threadBtn.setAttribute("aria-expanded", "true")',
    'threadBtn.setAttribute("aria-expanded", "false")',
    'replyBtn.setAttribute("aria-expanded", "true")',
    'const mount = replyItem || card.querySelector(".post-card-main")',
    'sendPost(text,',
    'toggleBookmark(id)',
    'sendVote(contentId, voteType)'
  ]) assert.ok(app.includes(snippet),snippet);
  assert.match(app,/maxlength="2048"/);
  assert.match(routes,/className = "conversation-panel"/);
  assert.match(routes,/countDirectReplies\(pool, post.id\)/);
  assert.match(app,/role="dialog" aria-modal="true" aria-labelledby="imageModalTitle"/);
  for(const path of ["js/render.js","js/app.js","js/routing.js"])
    assert.doesNotMatch(read(path),/\son(?:click|load|error)=["']/i,path);
});

test("temporary local IDs do not produce invalid public conversation URLs",()=>{
  const local=post("local_17310000","faireye","Pending confirmation");
  const html=buildPostCard(local,[local]).innerHTML;
  assert.doesNotMatch(html,/class="post-action-btn post-share-btn"/);
});
