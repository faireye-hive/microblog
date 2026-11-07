import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  normalizeDiscoveryQuery, collectDiscoveryTags,
  getDiscoveryResults, discoveryPostPool
} from "../js/helpers/discovery.js";
import {
  buildExploreOverview, buildSearchOverview, buildSearchSuggestions
} from "../js/ui/discovery.js";
import {getActiveMobileSection} from "../js/mobile-nav.js";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const post=(id,author,content,tags=[],timestamp="2026-11-07T12:00:00Z")=>({
  id,custom_id:"micro.fair",timestamp,required_posting_auths:[author],
  json:JSON.stringify({app:"micro.fair",type:"post",content,tags})
});
const data=[
  post(101,"faireye","Open-source code is growing on Hive #dev #hive",["dev","hive"],"2026-11-07T12:00:00Z"),
  post(102,"sm-silva","Hive conversations about music #music",["music"],"2026-11-07T13:00:00Z"),
  post(103,"peak.snaps","I like the hive ecosystem but this has no hashtag",[],"2026-11-07T14:00:00Z"),
  post(104,"bad-user",'<img src=x onerror=alert(1)> #dev',["dev"],"2026-11-07T15:00:00Z")
];
const communities=[
  {id:"news",name:"Hive News",description:"News on Hive",creator:"faireye"},
  {id:"dev-chat",name:"Developers",description:"Code on Hive",creator:"sm-silva"},
  {id:'bad"><script>',name:'<img src=x onerror=alert(2)>',description:"forged",creator:"attacker"}
];

test("discovery queries are bounded and handles #/@ input without accidental global match",()=>{
  assert.equal(normalizeDiscoveryQuery("  hello    hive  "),"hello hive");
  assert.equal(normalizeDiscoveryQuery("x".repeat(1000)).length,100);
  assert.equal(normalizeDiscoveryQuery(null),"");
  assert.equal(getDiscoveryResults({query:"#",posts:data}).totalPosts,0);
  assert.equal(getDiscoveryResults({query:"@",posts:data}).totalPosts,0);
  assert.equal(getDiscoveryResults({query:"",posts:data}).totalPosts,0);
  assert.deepEqual(getDiscoveryResults({query:"#hive",posts:data}).posts.map(p=>p.id),[101]);
  // A mere word without a hashtag/tag must not be returned for #dev queries.
  assert.deepEqual(getDiscoveryResults({query:"#dev",posts:data}).posts.map(p=>p.id),[104,101]);
  assert.deepEqual(getDiscoveryResults({query:"@faireye",posts:data}).posts.map(p=>p.id),[101]);
  const q=getDiscoveryResults({query:"hive",posts:data,channels:communities});
  assert.ok(q.communities.some(ch=>ch.id==="news"));
  assert.ok(q.people.some(person=>person.user==="faireye"));
  assert.ok(q.topics.some(topic=>topic.tag==="hive"));
  assert.equal(q.totalPosts,3);
});

test("trending topics use actual tags and deduplicate repeated tags per post",()=>{
  const tags=collectDiscoveryTags(data,9);
  assert.equal(tags.find(row=>row.tag==="dev")?.count,2);
  assert.equal(tags.find(row=>row.tag==="hive")?.count,1);
  assert.equal(tags.find(row=>row.tag==="music")?.count,1);
  assert.deepEqual(collectDiscoveryTags([],5),[]);
});

test("discovery blocks excluded accounts and muted posts, and deduplicates IDs",()=>{
  const blocked=new Set(["bad-user"]);
  const muted=new Map([[102,{cause:"spam"}]]);
  assert.deepEqual(discoveryPostPool(data,[data[0]],blocked,muted).map(x=>x.id),[101,103]);
  assert.deepEqual(discoveryPostPool(data,[],new Set(),new Map([[String(101),{}]]))
    .map(x=>x.id),[102,103,104]);
});

test("Explore is built from actual local content with readable navigation and no pretend trends",()=>{
  const html=buildExploreOverview({posts:data,channels:communities,mode:"popular"});
  assert.match(html,/id="exploreTitle"/);
  assert.match(html,/Interesting things/);
  assert.match(html,/4<\/strong> posts loaded/);
  assert.match(html,/Based on loaded posts/);
  assert.match(html,/href="#\/explore"/);
  assert.match(html,/href="#\/trending"/);
  assert.match(html,/href="#\/active"/);
  assert.match(html,/class="discovery-feed-tab active"/);
  assert.match(html,/#dev/);
  assert.match(html,/href="#\/channel\/news"/);
  assert.doesNotMatch(html,/bad&quot;&gt;/,"Invalid channel IDs are excluded");
  assert.doesNotMatch(html,/live Hive global index|global ranking/i);
});

test("search suggestions safely escape arbitrary on-chain text and show true destinations",()=>{
  const injected=post(105,"faireye",'<img src=x onerror=alert(1)> #security',["security"]);
  const r=getDiscoveryResults({query:"img",posts:[injected],channels:communities});
  const html=buildSearchSuggestions(r);
  assert.match(html,/class="search-suggestion-item"/);
  assert.match(html,/href="#\/thread\/105"/);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html,/<img src=x onerror=alert\(1\)>/);
  assert.doesNotMatch(html,/\son(?:click|error|load)=["']/i);
  assert.match(html,/See all results/);
  assert.match(html,/aria-selected="false"/);
});

test("search results escape query, validate channel ID, and explain loaded data limitation",()=>{
  const r=getDiscoveryResults({query:"hive",posts:data,channels:communities});
  const html=buildSearchOverview({results:r});
  assert.match(html,/SEARCH \/ LOADED HIVE CONTENT/);
  assert.match(html,/not a full Hive blockchain search/);
  assert.match(html,/id="searchPageInput"/);
  assert.match(html,/Hive News/);
  assert.match(html,/href="#\/channel\/news"/);
  const malicious=buildSearchOverview({results:getDiscoveryResults({query:'"><svg onload=alert(1)>',posts:data})});
  assert.doesNotMatch(malicious,/value=""><svg/);
  assert.doesNotMatch(malicious,/<svg\s+onload=/);
  assert.match(malicious,/&quot;&gt;&lt;svg/);
});

test("community directory has All/Joined states without breaking existing join hooks",async()=>{
  globalThis.localStorage ??= {getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.document ??= {getElementById(){return null;}};
  globalThis.window ??= {dispatchEvent(){}};
  globalThis.CustomEvent ??= class CustomEvent {constructor(type){this.type=type;}};
  const state=await import("../js/state.js");
  const {buildChannelsPage}=await import("../js/render.js");
  state.setChannels(communities.slice(0,2));
  state.joinedChannels.add("news");
  const all=buildChannelsPage("","all");
  assert.match(all,/data-scope="all"/);
  assert.match(all,/data-scope="joined"/);
  assert.equal((all.match(/class="channel-tile"/g)||[]).length,2);
  assert.match(all,/id="channelsDirectorySearch"/);
  assert.match(all,/id="btnCreateChannelFromPage"/);
  assert.match(all,/\bJoined\b/);
  assert.doesNotMatch(all,/>Participar</);
  const joined=buildChannelsPage("","joined");
  assert.equal((joined.match(/class="channel-tile"/g)||[]).length,1);
  assert.match(joined,/#news/);
  assert.doesNotMatch(joined,/href="#\/channel\/dev-chat"/);
  state.joinedChannels.delete("news");
  const empty=buildChannelsPage("","joined");
  assert.match(empty,/No joined communities yet/);
  assert.match(empty,/id="btnBrowseAllCommunities"/);
});

test("desktop/mobile navigation and shortcut use the new dedicated discovery routes",()=>{
  assert.equal(getActiveMobileSection("#/explore"),"explore");
  assert.equal(getActiveMobileSection("#/trending"),"explore");
  assert.equal(getActiveMobileSection("#/active"),"explore");
  assert.equal(getActiveMobileSection("#/search?q=%40faireye"),"explore");
  const routing=read("js/routing.js");
  const app=read("js/app.js");
  const html=read("index.html");
  const templates=read("js/templates.js");
  const style=read("css/discovery.css");
  assert.match(routing,/buildExploreOverview\(/);
  assert.match(routing,/buildSearchOverview\(/);
  assert.match(routing,/renderFeed\(results.posts, pool\)/);
  assert.match(routing,/setupDiscoveryPageEvents\(/);
  assert.match(routing,/path === "\/explore"/);
  assert.match(routing,/path === "\/trending"/);
  assert.match(app,/buildSearchSuggestions\(results\)/);
  assert.match(app,/event.key==="ArrowDown"/);
  assert.match(app,/event.key==="Escape"/);
  assert.match(app,/event.key==="Enter"/);
  assert.match(app,/search-mobile-open/);
  assert.match(templates,/id="topSearchInput"/);
  assert.match(templates,/role="combobox" aria-autocomplete="list"/);
  assert.match(templates,/id="searchResultsPanel"/);
  assert.match(templates,/id="btnMobileSearch"/);
  assert.match(html,/data-mobile-section="explore" href="#\/explore"/);
  assert.ok(html.indexOf("css/discovery.css")>html.indexOf("css/feedback.css"));
  assert.match(style,/@media\(max-width:640px\)/);
  assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html,/script-src 'self'/);
  assert.doesNotMatch(html,/script-src[^;]*unsafe-inline/);
});
