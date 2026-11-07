import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("English is the document language and international SEO copy is consistent", () => {
  for (const file of ["index.html", "404.html"]) {
    assert.match(read(file), /<html lang="en">/, file);
  }
  const html=read("index.html");
  assert.match(html, /micro\.fair — The Hive conversation/);
  assert.match(html, /Skip to content/);
  assert.match(html, /aria-label="Mobile navigation"/);
  assert.match(html, /data-mobile-section="channels" href="#\/channels" aria-label="Communities"/);
  assert.match(html, /Keep scrolling for more posts/);
});

test("editorial theme is loaded last and has accent-aware, responsive interaction states", () => {
  const html=read("index.html");
  assert.ok(html.indexOf('href="./css/editorial.css"') > html.indexOf('href="./css/community.css"'));
  const css=read("css/editorial.css");
  for(const selector of [".brand-icon",".composer-eyebrow",".composer-network-pill",
    ".post-card", ".post-headline", ".post-action-btn", ".channel-tile",
    ".feature-empty-state", ".mobile-nav-link.active"]) {
    assert.ok(css.includes(selector),selector);
  }
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(html, /script-src 'self'/);
  assert.doesNotMatch(html, /script-src[^;]*unsafe-inline/);
});

test("internationalized templates keep complete navigation, composer and dialogs", async()=>{
  const {TopNavHTML,LeftSidebarHTML,ComposerHTML,FeedFiltersHTML,RightSidebarHTML,LoginModalHTML,
    LogoutModalHTML,CreateChannelModalHTML,CustomJsonModalHTML}=await import("../js/templates.js");
  assert.match(TopNavHTML,/id="tabForYou">For you/);
  assert.match(TopNavHTML,/id="tabFollowing">Following/);
  assert.match(LeftSidebarHTML,/>Communities</);
  assert.match(LeftSidebarHTML,/>Bookmarks</);
  assert.match(ComposerHTML,/>Start a conversation</);
  assert.match(ComposerHTML,/YOUR VOICE · ON HIVE/);
  assert.match(ComposerHTML,/id="btnPost"/);
  assert.match(ComposerHTML,/id="composerChannelBadge"/);
  assert.match(ComposerHTML,/data-mode="json"/);
  assert.match(FeedFiltersHTML,/>All</);
  assert.match(FeedFiltersHTML,/>Latest</);
  assert.match(RightSidebarHTML,/>Trending</);
  assert.match(LoginModalHTML,/>Join the conversation</);
  assert.match(LoginModalHTML,/never ask for your private keys/);
  assert.match(LogoutModalHTML,/Sign out of Micro\.fair/);
  assert.match(CreateChannelModalHTML,/Create a community/);
  assert.match(CustomJsonModalHTML,/Broadcast operation/);
});

test("dynamic feedback, empty states and valid date copy use English",async()=>{
  const {fmtDate}=await import("../js/utils.js");
  assert.equal(fmtDate("invalid-date"),"Just now");
  assert.match(fmtDate("2026-11-07T12:00:00.000Z"),/Nov 7, 2026/);

  const auth=read("js/auth.js");
  const app=read("js/app.js");
  const api=read("js/api.js");
  const state=read("js/state.js");
  const routing=read("js/routing.js");
  assert.match(auth,/Connected to Hive/);
  assert.match(app,/Post saved to bookmarks!/);
  assert.match(api,/HAFSQL is offline/);
  assert.match(state,/No posts match this view yet/);
  assert.match(routing,/COMING SOON/);
  assert.doesNotMatch(routing,/A tag #crypto e #linux/);
  assert.match(read("js/hive/moderation.js"),/Reason not specified/);
});

test("UI modules do not accidentally reintroduce localized Portuguese copy",()=>{
  const runtime=[
    "js/templates.js","js/render.js","js/routing.js","js/app.js",
    "js/auth.js","js/state.js","js/api.js","js/helpers/channels.js",
    "js/hive/moderation.js","index.html","404.html"
  ];
  for (const path of runtime) {
    // Ignore historic developer comments; audit active text/HTML and script content.
    const content=read(path).split("\n")
      .filter(line => !line.trim().startsWith("//") && !line.trim().startsWith("*")
        && !line.trim().startsWith("/*") && !line.includes(" // "))
      .join("\n");
    assert.doesNotMatch(content, /[À-ÿ]/, path);
    assert.doesNotMatch(content, />\s*(?:Sair|Entrar|Criar|Seguir|Voltar|Nenhum|Nenhuma|Desbloquear|Participar)\b/, path);
  }
});
