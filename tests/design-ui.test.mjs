import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const refined=readFileSync(new URL("../css/refined.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../js/app.js",import.meta.url),"utf8");
const routing=readFileSync(new URL("../js/routing.js",import.meta.url),"utf8");
const state=readFileSync(new URL("../js/state.js",import.meta.url),"utf8");

const {
  TopNavHTML, LeftSidebarHTML, ComposerHTML, FeedFiltersHTML, RightSidebarHTML
} = await import("../js/templates.js");

test("refined neutral light theme loads last and keeps structural routes",()=>{
  const old=html.indexOf('href="./css/modern.css"');
  const fresh=html.indexOf('href="./css/refined.css"');
  assert.ok(old>=0 && fresh>old);
  assert.match(refined,/--bg:\s*#f8f9fb/);
  assert.match(refined,/--text-main:\s*#1a1d24/);
  assert.match(refined,/color-scheme|font-family/);
  assert.match(refined,/@media \(max-width: 840px\)/);
  assert.match(refined,/@media \(max-width: 640px\)/);
  assert.match(refined,/\.mobile-bottom-nav\s*\{/);
  assert.match(refined,/:focus-visible|focus-visible/);
  assert.match(html,/id="mobileBottomNav"/);
});

test("top tabs focus on feed and following while sidebar keeps essential routes",()=>{
  assert.equal((TopNavHTML.match(/class="top-nav-tab(?: active)?"/g)||[]).length,2);
  assert.match(TopNavHTML,/id="tabForYou">For you/);
  assert.match(TopNavHTML,/id="tabFollowing">Following/);
  assert.match(TopNavHTML,/id="topSearchInput"/);
  assert.match(TopNavHTML,/id="btnNotificationsTop"/);
  assert.match(TopNavHTML,/id="userMenuDropdown"/);
  assert.match(TopNavHTML,/aria-expanded="false"/);
  for (const id of ["leftNavHome","leftNavExplore","leftNavChannels",
    "leftNavBookmarks","leftNavProfile","btnAddChannel","yourChannelsList"]) {
    assert.ok(LeftSidebarHTML.includes('id="'+id+'"'),id);
  }
  assert.match(LeftSidebarHTML,/<details class="nav-more" id="leftNavMoreMenu">/);
  for(const id of ["leftNavMessages","leftNavNotifications","leftNavCustomJson"])
    assert.ok(LeftSidebarHTML.includes('id="'+id+'"'),id);
  assert.doesNotMatch(LeftSidebarHTML,/hive-promo-card/);
  assert.match(routing,/moreMenu\.open = true/);
});

test("composer keeps all six functional modes but groups advanced tools",()=>{
  for(const id of ["newPostContent","btnPost","charCount","composerAvatar",
    "composerChannelBadge","btnExitChannelComposer"]){
    assert.ok(ComposerHTML.includes('id="'+id+'"'),id);
  }
  for(const mode of ["text","image","link","video","file","json"]){
    assert.equal((ComposerHTML.match(new RegExp('data-mode="'+mode+'"','g'))||[]).length,1,mode);
  }
  const extra=ComposerHTML.indexOf('<details class="composer-extra">');
  assert.ok(extra>0);
  for(const mode of ["text","image","link"])assert.ok(ComposerHTML.indexOf('data-mode="'+mode+'"')<extra,mode);
  for(const mode of ["video","file","json"])assert.ok(ComposerHTML.indexOf('data-mode="'+mode+'"')>extra,mode);
  assert.match(ComposerHTML,/class="composer-extra-menu"/);
  assert.match(ComposerHTML,/>Start a conversation</);
  assert.match(ComposerHTML,/>Post</);
  assert.match(state,/btnPostSpan\.textContent = "Post"/);
  const composerController = readFileSync(new URL("../js/ui/composer-controller.js",import.meta.url),"utf8");
  assert.match(composerController,/advanced\.open=false/);
});

test("right sidebar preserves active widgets but removes redundant cards",()=>{
  for(const id of ["btnCreateChannelTrigger","sidebarChannelsList","trendingList","btnRefreshTags"]){
    assert.ok(RightSidebarHTML.includes('id="'+id+'"'),id);
  }
  assert.match(RightSidebarHTML,/>Trending</);
  assert.doesNotMatch(RightSidebarHTML,/quick-actions-grid/);
  assert.doesNotMatch(RightSidebarHTML,/create-channel-box/);
  assert.match(app,/btnCreateChannelTrigger/);
  assert.match(app,/btnNotificationsTop/);
});

test("filters retain the same behavior keys with clearer labels",()=>{
  for(const name of ["all","text","media","links","long"]){
    assert.ok(FeedFiltersHTML.includes('data-filter="'+name+'"'),name);
  }
  assert.match(FeedFiltersHTML,/>All</);
  assert.match(FeedFiltersHTML,/>Latest</);
  assert.match(app,/setActiveFilter\(filter\)/);
  assert.match(app,/setCurrentSort\("votes"\)/);
});

test("first line of a multi-line post is not repeated as body text",async()=>{
  globalThis.localStorage ??= {getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.document ??= {
    createElement(tag){return {tagName:tag.toUpperCase(),setAttribute(){},innerHTML:"",className:""};}
  };
  const { buildPostCard }=await import("../js/render.js");
  const post={id:101,custom_id:"micro.fair",required_posting_auths:["faireye"],
    timestamp:"2026-11-07T00:00:00Z",
    json:JSON.stringify({app:"micro.fair",type:"post",content:"Simple title\nThe post body with further details."})};
  const markup=buildPostCard(post,[post]).innerHTML;
  assert.equal((markup.match(/Simple title/g)||[]).length,1);
  assert.match(markup,/<h4 class="post-headline">Simple title<\/h4>/);
  assert.match(markup,/The post body with further details/);
});

test("design changes do not add inline JavaScript or weaken CSP",()=>{
  for(const path of ["../js/templates.js","../js/render.js","../index.html"]){
    const text=readFileSync(new URL(path,import.meta.url),"utf8");
    assert.doesNotMatch(text,/\son(?:click|load|error)=["']/i,path);
  }
  assert.match(html,/script-src 'self'/);
  assert.doesNotMatch(html,/script-src[^;]*unsafe-inline/);
});
