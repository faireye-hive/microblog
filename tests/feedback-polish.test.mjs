import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildFeedSkeletonHTML, showFeedSkeleton, hideFeedSkeleton} from "../js/ui/feed-loading.js";
import {showNotification} from "../js/utils.js";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

function makeFeed(withPosts = false) {
  const attrs = new Map();
  let hasSkeleton = false;
  let skeletonRemoved = false;
  let markup = "";
  return {
    attrs, get skeletonRemoved(){return skeletonRemoved;},
    get innerHTML(){return markup;},
    set innerHTML(value) {
      markup = String(value);
      hasSkeleton = markup.includes('class="feed-skeletons"');
    },
    querySelector(selector) {
      if (selector === ".feed-skeletons" && hasSkeleton) {
        return {remove() {hasSkeleton = false; skeletonRemoved = true;}};
      }
      if (selector.includes(".post-card") && withPosts) return {className:"post-card"};
      return null;
    },
    setAttribute(name, value) {attrs.set(name, value);},
    removeAttribute(name){attrs.delete(name);}
  };
}

function makeElement(tagName) {
  const element = {
    tagName: tagName.toUpperCase(),
    children: [],
    attributes: {},
    className: "",
    textContent: "",
    listeners: {},
    appendChild(child) {
      this.children.push(child);
      child.parentElement = this;
      return child;
    },
    remove() {
      if (this.parentElement) {
        const parent=this.parentElement;
        parent.children=parent.children.filter(child=>child!==this);
      }
    },
    setAttribute(name, value) {this.attributes[name] = value;},
    addEventListener(type, callback) {this.listeners[type] = callback;},
    click() {this.listeners.click?.();},
    querySelector(selector) {
      const desired = selector.replace(/^\./, "");
      return this.children.find(child => child.className?.split(" ").includes(desired)) || null;
    },
    querySelectorAll(selector) {
      const desired = selector.replace(/^\./, "");
      return this.children.filter(child => child.className?.split(" ").includes(desired));
    },
  };
  element.classList = {
    add(name) {element.className += " " + name;},
    contains(name) {return element.className.split(" ").includes(name);}
  };
  return element;
}

test("skeletons are accessible, content-free and bounded",()=>{
  const html=buildFeedSkeletonHTML(2);
  assert.match(html,/role="status" aria-label="Loading posts"/);
  assert.match(html,/Loading posts/);
  assert.equal((html.match(/class="feed-skeleton-card"/g)||[]).length, 2);
  assert.equal((buildFeedSkeletonHTML(400).match(/class="feed-skeleton-card"/g)||[]).length,4);
  assert.equal((buildFeedSkeletonHTML(-12).match(/class="feed-skeleton-card"/g)||[]).length,1);
  assert.doesNotMatch(html,/https?:\/\//);
  assert.doesNotMatch(html,/\son(?:click|error|load)=/);
});

test("initial loading is visible, does not blank real posts, and ends cleanly",()=>{
  const empty=makeFeed();
  assert.equal(showFeedSkeleton(empty),true);
  assert.match(empty.innerHTML,/feed-skeletons/);
  assert.equal(empty.attrs.get("aria-busy"),"true");
  assert.equal(showFeedSkeleton(empty),true);
  hideFeedSkeleton(empty);
  assert.ok(empty.skeletonRemoved);
  assert.equal(empty.attrs.has("aria-busy"),false);

  const existing=makeFeed(true);
  existing.innerHTML='<article class="post-card">Real content</article>';
  assert.equal(showFeedSkeleton(existing),false);
  assert.equal(existing.innerHTML,'<article class="post-card">Real content</article>');
  assert.equal(existing.attrs.has("aria-busy"),false);
});

test("toasts preserve text-only content and accessibility with dismiss button",()=>{
  const originalDoc=globalThis.document;
  const originalSetTimeout=globalThis.setTimeout;
  const originalClearTimeout=globalThis.clearTimeout;
  const timers=new Map();
  let id=0;
  const body=makeElement("body");
  const doc={
    body,
    getElementById(name){return body.children.find(el=>el.id===name)||null;},
    createElement:makeElement
  };
  globalThis.document=doc;
  globalThis.setTimeout=(callback,delay)=>{const value=++id;timers.set(value,{callback,delay});return value;};
  globalThis.clearTimeout=(key)=>{timers.delete(key);};
  try {
    showNotification('❌ <img src=x onerror="alert(1)">',false);
    const stack=doc.getElementById("notification-container");
    assert.ok(stack);
    assert.equal(stack.className,"app-toast-stack");
    assert.equal(stack.children.length,1);
    const toast=stack.children[0];
    assert.match(toast.className,/app-toast-error/);
    assert.equal(toast.attributes.role,"alert");
    const message=toast.querySelector(".app-toast-text");
    assert.equal(message.textContent,'<img src=x onerror="alert(1)">');
    assert.equal(message.children.length,0);
    const close=toast.querySelector(".app-toast-close");
    assert.equal(close.attributes["aria-label"],"Dismiss notification");
    close.click();
    assert.ok(toast.classList.contains("app-toast-leaving"));
    showNotification("✅ Saved!",true);
    const success=stack.children[1];
    assert.equal(success.attributes.role,"status");
    assert.equal(success.querySelector(".app-toast-text").textContent,"Saved!");
    assert.ok([...timers.values()].some(timer=>timer.delay===4500));
  } finally {
    globalThis.document=originalDoc;
    globalThis.setTimeout=originalSetTimeout;
    globalThis.clearTimeout=originalClearTimeout;
  }
});

test("feedback is loaded after previous CSS and respects reduced-motion mobile users",()=>{
  const html=read("index.html");
  const css=read("css/feedback.css");
  assert.ok(html.indexOf('href="./css/feedback.css"') > html.indexOf('href="./css/feed-experience.css"'));
  assert.match(html,/Keep scrolling for more posts/);
  for (const selector of [
    ".feed-skeleton-card",".feed-skeleton-actions",".skeleton-shine",
    ".app-toast-stack",".app-toast-error",".app-toast-close",
    ".app-toast-leaving",".feed-load-error",".visually-hidden"
  ]) assert.ok(css.includes(selector),selector);
  assert.match(css,/@media \(max-width: 640px\)/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css,/:focus-visible/);
  assert.match(html,/script-src 'self'/);
  assert.doesNotMatch(html,/script-src[^;]*unsafe-inline/);
});

test("feed sync and routing do not recursively re-fetch an empty feed",()=>{
  const api=read("js/api.js");
  const routing=read("js/routing.js");
  const state=read("js/state.js");
  assert.match(api,/if \(feedSyncPromise\) return feedSyncPromise;/);
  assert.match(api,/initialFeedSyncFinished = true/);
  assert.match(api,/showFeedSkeleton\(document\.getElementById\("feed"\)\)/);
  assert.match(api,/hideFeedSkeleton\(document\.getElementById\("feed"\)\)/);
  assert.doesNotMatch(api,/innerHTML =\s*['"]<div class="card p-4 text-center small-muted">Loading/);
  assert.match(routing,/allPosts\.length === 0 && !hasFinishedFeedSync\(\)/);
  assert.match(routing,/showFeedSkeleton\(feed\)/);
  assert.match(routing,/hideFeedSkeleton\(feed\)/);
  assert.match(state,/hideFeedSkeleton\(feed\)/);
});
