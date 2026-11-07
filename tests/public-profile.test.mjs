import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  normalizePublicHiveAccount,
  fetchPublicHiveAccount,
  HIVE_PUBLIC_PROFILE_RPC
} from "../js/hive/public-profile.js";
import {
  buildPublicProfilePage,
  collectPublicProfilePosts,
  publicUserPath
} from "../js/ui/public-profile.js";
import {getActiveMobileSection} from "../js/mobile-nav.js";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const post = (id, username, content, replyTo = null, timestamp="2026-11-07T12:00:00Z") => ({
  id, custom_id: "micro.fair", timestamp,
  required_posting_auths: [username],
  json: JSON.stringify({app:"micro.fair",v:1,type:replyTo?"reply":"post", content, reply_to:replyTo})
});

test("public Hive metadata is normalized with strict URLs and only expected account identity", () => {
  const account={
    name:"faireye",
    created:"2020-03-06T12:22:48",
    json_metadata:JSON.stringify({profile:{name:"Base name",about:"Base bio",website:"hive.io"}}),
    posting_json_metadata:JSON.stringify({profile:{
      name:'<img src=x onerror="bad()">',
      about:'Hello <script>alert(1)</script>',
      location:"Somewhere",
      profile_image:"javascript:alert(1)",
      cover_image:"https://files.example.com/cover.jpg"
    }})
  };
  const data=normalizePublicHiveAccount(account,"faireye");
  assert.equal(data.username,"faireye");
  assert.equal(data.displayName,'<img src=x onerror="bad()">');
  assert.equal(data.about,"Hello <script>alert(1)</script>");
  assert.equal(data.website,"https://hive.io/");
  assert.equal(data.profileImage,"");
  assert.equal(data.coverImage,"https://files.example.com/cover.jpg");
  assert.equal(data.location,"Somewhere");
  assert.equal(data.joined,"2020-03-06T12:22:48");
  assert.equal(data.confirmedOnChain,true);
  assert.equal(normalizePublicHiveAccount(account,"other-user"),null);
  assert.equal(normalizePublicHiveAccount(null,"faireye"),null);
});

test("public account RPC uses the already allowed origin without private keys and handles outages",async()=>{
  const calls=[];
  const fakeFetch=async (url,opts)=>{
    calls.push({url,opts});
    return {ok:true,json:async()=>({result:[{name:"profile-test-a",created:"2022-02-01T00:00:00",
      posting_json_metadata:JSON.stringify({profile:{name:"Test"}})}]})};
  };
  const found=await fetchPublicHiveAccount("profile-test-a",{fetchImpl:fakeFetch});
  assert.equal(found.status,"found");
  assert.equal(found.profile.displayName,"Test");
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,HIVE_PUBLIC_PROFILE_RPC);
  assert.equal(calls[0].opts.method,"POST");
  assert.equal(calls[0].opts.credentials,"omit");
  assert.equal(calls[0].opts.referrerPolicy,"no-referrer");
  const request=JSON.parse(calls[0].opts.body);
  assert.equal(request.method,"condenser_api.get_accounts");
  assert.deepEqual(request.params,[["profile-test-a"]]);
  const cached=await fetchPublicHiveAccount("profile-test-a",{fetchImpl:()=>{throw Error("cache missed");}});
  assert.equal(cached.status,"found");

  const unavailable=await fetchPublicHiveAccount("profile-test-b",{
    fetchImpl:async()=>{throw new Error("network offline");}
  });
  assert.deepEqual(unavailable,{status:"unavailable",profile:null});
  const missing=await fetchPublicHiveAccount("profile-test-c",{
    fetchImpl:async()=>({ok:true,json:async()=>({result:[]})})
  });
  assert.equal(missing.status,"not-found");
  const invalid=await fetchPublicHiveAccount('<img onerror=1>',{fetchImpl:()=>{throw Error("should not call");}});
  assert.equal(invalid.status,"invalid");
  assert.match(read("index.html"),/connect-src 'self' https:\/\/rpc\.mahdiyari\.info/);
});

test("loaded Micro.fair posts and replies are partitioned without pretending account-wide stats",()=>{
  const records=[
    post(1,"faireye","Welcome"),
    post(2,"sm-silva","Other user"),
    post(3,"faireye","Older reply",1,"2025-01-02T00:00:00Z"),
    post(4,"faireye","Latest",null,"2026-11-08T00:00:00Z")
  ];
  const activity=collectPublicProfilePosts("faireye",records);
  assert.deepEqual(activity.posts.map(p=>p.id),[4,1,3]);
  assert.deepEqual(activity.topLevel.map(p=>p.id),[4,1]);
  assert.deepEqual(activity.replies.map(p=>p.id),[3]);
  assert.deepEqual(collectPublicProfilePosts("<bad>",records).posts,[]);
  assert.equal(publicUserPath("Faireye"),"#/user/faireye");
  assert.equal(publicUserPath("not a user"),"#/explore");
});

test("profile hero escapes metadata and offers genuine external links",()=>{
  const input={
    username:"faireye",displayName:"<img src=x onerror=alert(1)>",
    about:'I built <script>alert(2)</script> on Hive',
    location:'<svg onload="bad()">',
    website:"https://hive.io/path?x=1&y=2",
    profileImage:"javascript:alert(1)",
    coverImage:"https://files.example.org/header.jpg",
    joined:"2020-03-06T12:22:48",
  };
  const html=buildPublicProfilePage({
    username:"faireye",account:input,status:"found",postsCount:7,repliesCount:2,allCount:9,
    signedIn:true,isFollowing:true,isBlocked:false
  });
  assert.match(html,/id="publicProfileTitle"/);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.ok(html.includes("I built &lt;script&gt;alert(2)&lt;&#x2F;script&gt; on Hive"));
  assert.match(html,/&lt;svg onload=&quot;bad\(\)&quot;&gt;/);
  assert.doesNotMatch(html,/<script>alert/);
  assert.doesNotMatch(html,/<svg onload/);
  assert.match(html,/href="https:\/\/hive\.io\/path\?x=1&amp;y=2"/);
  assert.match(html,/rel="noopener noreferrer"/);
  assert.match(html,/Posts loaded/);
  assert.match(html,/Replies loaded/);
  assert.match(html,/not account-wide totals/);
  assert.match(html,/On Hive since March 2020/);
  assert.match(html,/data-profile-action="unfollow"/);
  assert.match(html,/data-profile-action="block"/);
  assert.match(html,/href="#\/user\/faireye\/replies"/);
  assert.match(html,/href="#\/user\/faireye"/);
});

test("profile actions reflect guest, own account and block states without fake counts",()=>{
  const guest=buildPublicProfilePage({username:"peak.snaps",status:"unavailable"});
  assert.match(guest,/id="btnPublicProfileLogin"/);
  assert.match(guest,/temporarily unavailable/);
  assert.doesNotMatch(guest,/data-profile-action=/);
  const mine=buildPublicProfilePage({username:"faireye",isSelf:true,signedIn:true});
  assert.match(mine,/href="#\/profile"/);
  assert.doesNotMatch(mine,/data-profile-action="follow"/);
  const blocked=buildPublicProfilePage({
    username:"peak.snaps",signedIn:true,isBlocked:true,isFollowing:false,
    postsCount:3,repliesCount:1,allCount:4
  });
  assert.match(blocked,/data-profile-action="unblock"/);
  assert.match(blocked,/data-profile-action="follow"/);
  assert.match(blocked,/aria-pressed="true"/);
  assert.match(blocked,/Their posts are hidden/);
  const empty=buildPublicProfilePage({username:"peak.snaps",status:"not-found",tab:"replies"});
  assert.match(empty,/not found by the connected Hive RPC/);
  assert.match(empty,/No replies loaded/);
  assert.match(buildPublicProfilePage({username:"not valid"}),/Invalid Hive account/);
});

test("the author markup navigates to public profiles while quick actions remain keyboard operable",async()=>{
  globalThis.localStorage ??= {getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.document ??= {
    getElementById(){return null;},
    createElement(tag){
      return {tagName:tag.toUpperCase(),className:"",innerHTML:"",setAttribute(){}};
    }
  };
  const state=await import("../js/state.js");
  const {buildPostCard,buildRepliesRecursive,buildProfilePage}=await import("../js/render.js");
  state.setLoggedInUser("sm-silva");
  state.setFollowedUsers(new Set(["faireye"]));
  const postA=post(401,"faireye","Hello Hive");
  const card=buildPostCard(postA,[postA]).innerHTML;
  assert.match(card,/href="#\/user\/faireye"/);
  assert.match(card,/class="post-avatar-link"/);
  assert.match(card,/class="post-author-name author-profile-link"/);
  assert.match(card,/class="author-menu-toggle author-name"/);
  assert.match(card,/aria-controls="author-popover-401"/);
  assert.match(card,/class="dropdown-link author-popover-view"/);
  assert.match(card,/data-action="unfollow"/);
  const replyHtml=buildRepliesRecursive(401,[postA,post(402,"peak.snaps","Reply",401)]);
  assert.match(replyHtml,/href="#\/user\/peak\.snaps"/);
  const own=buildProfilePage();
  assert.match(own,/View public profile/);
  assert.match(own,/href="#\/user\/sm-silva"/);
  assert.match(own,/href="#\/user\/faireye"/);
  state.setLoggedInUser(null);
});

test("public profile links are in discovery, mobile navigation and safe routing",()=>{
  const ui=read("js/ui/discovery.js");
  const router=read("js/routing.js");
  const app=read("js/app.js");
  const css=read("css/public-profile.css");
  const html=read("index.html");
  assert.match(ui,/pathForPerson=name=>\`#\/user\//);
  assert.match(router,/publicUserMatch = path\.match/);
  assert.match(router,/showPublicUserProfile\(publicUserMatch\[1\]/);
  assert.match(router,/renderFeed\(visible, allLoaded\)/);
  assert.match(router,/buildPublicProfilePage/);
  assert.match(router,/renderVersion !== publicProfileRenderVersion/);
  assert.match(app,/button\[data-profile-action\]/);
  assert.match(app,/sendFollow/);
  assert.match(app,/sendUnfollow/);
  assert.match(app,/sendBlock/);
  assert.match(app,/sendUnblock/);
  assert.equal(getActiveMobileSection("#/user/faireye"),"profile");
  assert.ok(html.indexOf("css/public-profile.css")>html.indexOf("css/discovery.css"));
  for(const selector of [".public-profile-banner",".public-profile-header",".public-profile-avatar",
    ".public-profile-action",".public-profile-tabs",".author-menu-toggle",".post-avatar-link",
    ".profile-public-link",".public-profile-blocked-note"])
    assert.ok(css.includes(selector),selector);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /script-src 'self'/);
  assert.doesNotMatch(html, /script-src[^;]*unsafe-inline/);
});
