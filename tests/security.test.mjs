import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeExternalUrl, safeHiveUsername, hiveAvatarUrl, safeTag } from "../js/security/safe-values.js";
import { sanitizeUrl, extractImages, escapeAttr } from "../js/utils.js";
import { processMuteData } from "../js/hive/moderation.js";
import { processChannelsData } from "../js/helpers/channels.js";
import { imageFallbackUrl, installImageErrorHandling } from "../js/security/image-errors.js";

const channelOperation = (author, id, name, stamp) => ({
  timestamp:stamp,
  custom_id:"hiveline.communities",
  required_posting_auths:[author],
  json:JSON.stringify({app:"hiveline",v:2,type:"create_channel",id,name})
});
const moderationOp = (author, type, id, time, extra={}) => ({
  timestamp:time,
  custom_id:"hiveline.moderation",
  required_posting_auths:[author],
  json:JSON.stringify({app:"hiveline",v:2,type,content_id:id,cause:"spam"}),
  ...extra
});

test("raw HTTP URLs are validated and escaped separately for HTML attributes",()=>{
  assert.equal(safeExternalUrl("javascript:alert(1)"),"");
  assert.equal(safeExternalUrl("data:image/svg+xml,<svg>"),"");
  assert.equal(safeExternalUrl("//evil.test/"),"");
  assert.equal(safeExternalUrl("https://u:p@example.com/path"),"");
  assert.equal(safeExternalUrl('https://ok.test/" onerror="x'),"");
  assert.equal(safeExternalUrl("https://ok.test/\njavascript:alert(1)"),"");
  assert.equal(safeExternalUrl("file:///etc/passwd"),"");
  assert.equal(safeExternalUrl("https://ok.test/?a=1&b=2"),"https://ok.test/?a=1&b=2");
  assert.equal(escapeAttr(safeExternalUrl("https://ok.test/?a=1&b=2")),
    "https://ok.test/?a=1&amp;b=2");
  assert.equal(sanitizeUrl("#/channel/hive.micro"),"#/channel/hive.micro");
  assert.equal(sanitizeUrl("//evil.test"),"");
  assert.equal(sanitizeUrl("javascript:alert(1)"),"");
  assert.deepEqual(extractImages("![Image](https://ok.test/a.png?x=1&y=2)"),
    ["https://ok.test/a.png?x=1&y=2"]);
});

test("public username, avatar and tag validators reject markup",()=>{
  assert.equal(safeHiveUsername("Sm-Silva"),"sm-silva");
  assert.equal(safeHiveUsername('bad" onerror="alert(1)'),"unknown");
  assert.equal(safeHiveUsername("<svg>"),"unknown");
  assert.equal(hiveAvatarUrl('bad" onerror="1'),"https://images.hive.blog/u/unknown/avatar");
  assert.equal(safeTag("hive.micro"),"hive.micro");
  assert.equal(safeTag('hive" onclick="x'),"");
});

test("forged moderator operations cannot mute or unmute somebody's post",()=>{
  const ops=[
    moderationOp("attacker","mute",123,"2026-01-01T00:00:00Z"),
    moderationOp("faireye","mute",123,"2026-01-02T00:00:00Z"),
    moderationOp("attacker","unmute",123,"2026-01-03T00:00:00Z")
  ];
  const order=[...ops];
  const muteMap=processMuteData(ops);
  assert.equal(muteMap.get(123)?.admin,"faireye");
  assert.equal(muteMap.get(123)?.cause,"spam");
  assert.deepEqual(ops,order);
  ops.push(moderationOp("faireye","unmute",123,"2026-01-04T00:00:00Z"));
  assert.equal(processMuteData(ops).has(123),false);
});

test("moderation ignores wrong namespaces, unsigned records and malformed JSON",()=>{
  const ops=[
    moderationOp("faireye","mute",11,"2026-01-01", {custom_id:"other.app"}),
    moderationOp("attacker","mute",12,"2026-01-01", {required_posting_auths:[]}),
    moderationOp("faireye","mute",13,"2026-01-01", {json:"bad json"}),
    moderationOp("faireye","mute",14,"2026-01-01", {json:JSON.stringify({type:"mute",content_id:14,cause:{toString:"oops"}})}),
    moderationOp("faireye","mute",15,"2026-01-01", {required_posting_auths:[],required_auths:["faireye"]}),
  ];
  const result=processMuteData(ops);
  assert.equal(result.size,1);
  assert.equal(result.has(14),false);
  assert.ok(result.has(15));
});

test("channel registry accepts owner updates but ignores later foreign overwrites",()=>{
  const ops=[
    channelOperation("creator","hive.micro","Original","2026-01-01T00:00:00Z"),
    channelOperation("attacker","hive.micro","Hijacked","2026-01-02T00:00:00Z"),
    channelOperation("creator","hive.micro","Updated","2026-01-03T00:00:00Z"),
    channelOperation("other","hivemicro","Different","2026-01-04T00:00:00Z"),
    channelOperation("creator","fake","Cross namespace","2026-01-05T00:00:00Z"),
  ];
  ops[4].custom_id="not-a-channel-registry";
  ops.push(channelOperation("creator","missing-auth","Invisible","2026-01-06T00:00:00Z"));
  ops[5].required_posting_auths=[];
  const channels=processChannelsData(ops);
  assert.deepEqual(channels.map(c=>c.id).sort(),["hive.micro","hivemicro"]);
  assert.equal(channels.find(c=>c.id==="hive.micro").name,"Updated");
  assert.equal(channels.find(c=>c.id==="hive.micro").creator,"creator");
});

test("avatar fallback uses event listeners instead of inline JavaScript",()=>{
  const observers=[];
  installImageErrorHandling({addEventListener(type,handler,capture){
    observers.push({type,handler,capture});
  }});
  assert.equal(observers.length,1);
  assert.equal(observers[0].type,"error");
  assert.equal(observers[0].capture,true);
  const attrs=[];
  const img={tagName:"IMG",dataset:{avatarFallback:"user"},style:{},
    removeAttribute(name){attrs.push(name);delete this.dataset.avatarFallback;},
    src:"https://images.hive.blog/u/unknown/avatar"
  };
  observers[0].handler({target:img});
  assert.match(img.src,/^data:image\/svg\+xml/);
  assert.deepEqual(attrs,["data-avatar-fallback"]);
  assert.ok(imageFallbackUrl("hive").includes("data:image/svg+xml"));
});

test("untrusted post content and attributes cannot inject executable markup",async()=>{
  globalThis.localStorage ??= {getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.document ??= {
    createElement(tag){
      return {tagName:tag.toUpperCase(),className:"",setAttribute(){},innerHTML:""};
    }
  };
  const { buildPostCard, buildProfilePage } = await import("../js/render.js");
  const {setLoggedInUser, setFollowedUsers}=await import("../js/state.js");
  const maliciousId='9" onmouseover="alert(1)';
  const content='<img src=x onerror=alert(1)> https://ok.test/?a=1&b=2';
  const post={
    id:maliciousId,
    custom_id:"hiveline.posts",
    timestamp:"2026-11-07T00:00:00Z",
    required_posting_auths:['bad" onclick="alert(1)'],
    json:JSON.stringify({app:"hiveline",v:2,type:"post",channel:"hiveline.posts",content,tags:['evil" onfocus="x']})
  };
  const markup=buildPostCard(post,[post]).innerHTML;
  assert.ok(markup.includes("data-id=\"9&quot; onmouseover=&quot;alert(1)\""));
  assert.ok(!markup.includes('data-id="9" onmouseover='));
  assert.ok(!markup.includes("<img src=x onerror=alert(1)>"));
  assert.ok(!markup.includes("onerror=\""));
  assert.ok(markup.includes("href=\"https://ok.test/?a=1&amp;b=2\""));
  assert.ok(markup.includes("https://images.hive.blog/u/unknown/avatar"));
  setLoggedInUser('bad" onfocus="alert(1)');
  setFollowedUsers(new Set(['evil" onfocus="1']));
  const profile=buildProfilePage();
  assert.ok(!profile.includes('onfocus="'));
  assert.ok(profile.includes("@unknown"));
});

test("no inline script event attributes remain in active UI templates",()=>{
  for(const path of [
    "js/render.js","js/state.js","js/auth.js",
    "js/app.js","js/routing.js","js/templates.js","index.html"
  ]){
    const content=readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
    assert.doesNotMatch(content,/\son(?:click|error|load)="/,path);
  }
});
