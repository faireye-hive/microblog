import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/community.css", import.meta.url), "utf8");
const stateJs = readFileSync(new URL("../js/state.js", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const routingJs = readFileSync(new URL("../js/routing.js", import.meta.url), "utf8");

globalThis.localStorage ??= {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};
globalThis.document ??= { getElementById() { return null; } };
globalThis.window ??= { dispatchEvent() {} };
globalThis.CustomEvent ??= class CustomEvent { constructor(type) { this.type=type; } };

const state = await import("../js/state.js");
const { buildProfilePage, buildChannelsPage } = await import("../js/render.js");
const { LogoutModalHTML, CustomJsonModalHTML, CreateChannelModalHTML } =
  await import("../js/templates.js");

test("community theme loads last without altering existing CSP", () => {
  assert.ok(html.indexOf('href="./css/community.css"') > html.indexOf('href="./css/refined.css"'));
  for (const selector of [
    ".profile-hero", ".profile-panels", ".profile-list-empty",
    ".profile-guest", ".channels-grid", ".channel-tile",
    ".community-empty-state", ".community-dialog", ".community-dialog-form",
    ".community-danger-btn", ".community-input", ".community-dialog-actions",
  ]) assert.ok(css.includes(selector), selector);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(html, /script-src 'self'/);
  assert.doesNotMatch(html, /script-src[^;]*unsafe-inline/);
});

test("guest profile has clear account-entry CTA and no fake stats", () => {
  state.setLoggedInUser(null);
  const output = buildProfilePage();
  assert.match(output, /class="profile-page profile-guest"/);
  assert.match(output, /id="btnProfileLogin"/);
  assert.match(output, /Hive Keychain/);
  assert.doesNotMatch(output, /id="btnProfileLogout"/);
  assert.doesNotMatch(output, /id="followedUsersList"/);
});

test("authenticated profile uses real lists, counts and safe usernames", () => {
  state.setLoggedInUser("faireye");
  state.setFollowedUsers(new Set(["sm-silva", "peak.snaps", '<img src=x onerror=alert(1)>']));
  state.setBlockedUsers(new Set(["bad.user"]));
  const output = buildProfilePage();
  for (const id of ["profileUsername","btnProfileLogout","followedUsersList","blockedUsersList"])
    assert.match(output, new RegExp('id="'+id+'"'));
  assert.match(output, />@faireye</);
  assert.match(output, /2<\/strong>\s*<span>Following/);
  assert.match(output, /1<\/strong>\s*<span>Blocked/);
  assert.match(output, /@sm-silva/);
  assert.match(output, /@peak\.snaps/);
  assert.doesNotMatch(output, /<img src=x onerror=alert\(1\)>/);
  assert.match(output, /data-action="unblock"/);
  assert.match(output, /data-user="bad.user"/);
  assert.ok(output.includes('href="#/user/sm-silva"'));
  assert.ok(output.includes('href="#/user/peak.snaps"'));
  assert.match(output, /View public profile/);
  state.setFollowedUsers(new Set());
  state.setBlockedUsers(new Set());
  const empty = buildProfilePage();
  assert.match(empty, /You're not following anyone yet/);
  assert.match(empty, /No blocked accounts/);
  state.setLoggedInUser(null);
});

test("channel directory keeps real channel state, inputs, event IDs and XSS escaping", () => {
  state.setChannels([
    {id:"dev",name:"Development <script>alert(1)</script>",description:"Programming & community",creator:"faireye"},
    {id:"news",name:"Hive news",description:"Posts and news",creator:"sm-silva"}
  ]);
  const out = buildChannelsPage();
  for (const id of ["btnCreateChannelFromPage","channelsDirectorySearch","channelsDirectoryGrid"])
    assert.match(out, new RegExp('id="'+id+'"'));
  assert.match(out, /class="channel-tile"/);
  assert.equal((out.match(/class="channel-tile"/g)||[]).length,2);
  assert.match(out, /data-channel="dev"/);
  assert.match(out, /data-channel="news"/);
  // escapeHtml intentionally encodes / as &#x2F; as well as < and >.
  assert.match(out, /Development &lt;script&gt;alert\(1\)&lt;&#x2F;script&gt;/);
  assert.doesNotMatch(out, /<script>alert\(1\)<\/script>/);
  assert.match(out, /#\/channel\/dev/);
  const none = buildChannelsPage("xyz-inexistente");
  assert.match(none, /No communities found/);
  assert.match(none, /id="btnCreateChannelNotFound"/);
  assert.doesNotMatch(none, /class="channel-tile"/);
  const filtered = buildChannelsPage("dev");
  assert.equal((filtered.match(/class="channel-tile"/g)||[]).length,1);
  state.setChannels([]);
  const first = buildChannelsPage();
  assert.match(first, /Start the first community/);
});

test("all auxiliary modal controls and labels survive the redesign", () => {
  const examples = [
    [LogoutModalHTML, ["logoutConfirmModal","cancelLogout","confirmLogout","logoutDialogTitle"]],
    [CustomJsonModalHTML, ["customJsonModal","closeCustomJsonModal","customJsonId","customJsonPayload","cancelCustomJson","submitCustomJson","customJsonDialogTitle"]],
    [CreateChannelModalHTML, ["createChannelModal","closeCreateChannelModal","newChannelName","newChannelId","newChannelDesc","cancelCreateChannel","confirmCreateChannel","createChannelDialogTitle"]],
  ];
  for (const [content, ids] of examples) {
    for (const id of ids) assert.match(content, new RegExp('id="'+id+'"'), id);
    assert.match(content,/role="dialog" aria-modal="true"/);
    assert.match(content,/class="modal-dialog community-dialog/);
    assert.doesNotMatch(content,/\son(?:click|load|error)=/i);
  }
  for (const [content, id] of [
    [CustomJsonModalHTML,"customJsonId"],[CustomJsonModalHTML,"customJsonPayload"],
    [CreateChannelModalHTML,"newChannelName"],[CreateChannelModalHTML,"newChannelId"],[CreateChannelModalHTML,"newChannelDesc"],
  ]) assert.match(content, new RegExp('for="'+id+'"'));
  assert.match(appJs, /setupSecondaryDialogAccessibility\(\)/);
  assert.match(appJs, /event\.key === "Escape"/);
  assert.match(appJs, /btnProfileLogout/);
  assert.match(appJs, /btnProfileLogin/);
});

test("filter and channel empty state use the same design vocabulary", () => {
  assert.match(stateJs,/class="community-empty-state"/);
  // Channel loading now uses the same accessible feed skeleton as initial sync.
  assert.match(routingJs,/showFeedSkeleton\(feed\)/);
  assert.match(routingJs,/id="btnFocusChannelComposer"/);
  assert.match(routingJs,/isJoined \? "Joined" : "Join"/);
  assert.match(routingJs, /\["feed", "profile", "channels", "explore", "trending", "active", "search"\]\.includes\(newPage\)/);
});
