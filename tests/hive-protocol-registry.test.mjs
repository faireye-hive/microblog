import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  HIVE_APP_ID,HIVE_PROTOCOL_VERSION,HIVE_CUSTOM_JSON_IDS,HIVE_ACTION_TYPES,
  HIVE_NAMESPACE_REGISTRY,HIVE_ACTION_REGISTRY,HIVE_FIELD_DESCRIPTIONS,
  getHiveAction,getHiveNamespace,resolveCustomJsonId
} from "../js/hive/registry.js";
import {getExampleForAction,PROTOCOL_EXAMPLE_CONTENT_ID} from "../js/hive/examples.js";
import {
  buildPostPayload,buildVotePayload,buildMutePayload,
  buildUserActionPayload,buildChannelCreatePayload
} from "../js/hive/protocol.js";
import {
  APP_ID,VOTE_CUSTOM_ID,ADMIN_PMUTE_CUSTOM_ID,CHANNELS_CUSTOM_ID,
  BLOCK_USER_CUSTOM_ID,FOLLOW_USER_CUSTOM_ID,API_URL,VOTE_API_URL,CHANNELS_API_URL
} from "../js/config.js";
import {buildProtocolReferencePage,setupProtocolReferenceEvents} from "../js/ui/protocol-reference.js";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("canonical registry owns all immutable v1 IDs; compatibility exports are unchanged",()=>{
  assert.equal(HIVE_APP_ID,"micro.fair");
  assert.equal(HIVE_PROTOCOL_VERSION,1);
  assert.deepEqual(HIVE_CUSTOM_JSON_IDS,{
    POSTS:"micro.fair",COMMUNITY:"{channel}",VOTES:"micro.fair.interation",
    MODERATION:"micro.fair.adpmuted",CHANNEL_REGISTRY:"micro.fair.channels",
    FOLLOW_TEMPLATE:"micro.fair.{user}.follow",BLOCK_TEMPLATE:"micro.fair.{user}.block"
  });
  assert.equal(APP_ID,HIVE_APP_ID);
  assert.equal(VOTE_CUSTOM_ID,HIVE_CUSTOM_JSON_IDS.VOTES);
  assert.equal(ADMIN_PMUTE_CUSTOM_ID,HIVE_CUSTOM_JSON_IDS.MODERATION);
  assert.equal(CHANNELS_CUSTOM_ID,HIVE_CUSTOM_JSON_IDS.CHANNEL_REGISTRY);
  assert.equal(FOLLOW_USER_CUSTOM_ID,HIVE_CUSTOM_JSON_IDS.FOLLOW_TEMPLATE);
  assert.equal(BLOCK_USER_CUSTOM_ID,HIVE_CUSTOM_JSON_IDS.BLOCK_TEMPLATE);
  assert.ok(API_URL.endsWith("/micro.fair?limit=1000"));
  assert.ok(VOTE_API_URL.includes("/micro.fair.interation?limit=1000"));
  assert.ok(CHANNELS_API_URL.includes("/micro.fair.channels?limit=1000"));
});

test("all thirteen active action variants belong to exactly seven namespace families",()=>{
  assert.equal(HIVE_NAMESPACE_REGISTRY.length,7);
  assert.equal(HIVE_ACTION_REGISTRY.length,13);
  assert.equal(new Set(HIVE_NAMESPACE_REGISTRY.map(x=>x.key)).size,7);
  assert.equal(new Set(HIVE_ACTION_REGISTRY.map(x=>x.key)).size,13);
  const associated=HIVE_NAMESPACE_REGISTRY.flatMap(group=>group.operations);
  assert.deepEqual(associated.slice().sort(),HIVE_ACTION_REGISTRY.map(x=>x.key).sort());
  for(const action of HIVE_ACTION_REGISTRY){
    assert.equal(getHiveAction(action.key),action);
    assert.ok(getHiveNamespace(action.namespace).operations.includes(action.key));
    assert.ok(Object.values(HIVE_ACTION_TYPES).includes(action.type));
  }
  assert.equal(getHiveAction("missing"),null);
  assert.equal(getHiveNamespace("missing"),null);
  assert.equal(resolveCustomJsonId("missing"),"");
});

test("all custom_json IDs resolve by operation and signer without changing namespace spelling",()=>{
  const cases={
    post:"micro.fair",reply:"micro.fair",
    "community-post":"hive.micro","community-reply":"hive.micro",
    upvote:"micro.fair.interation",downvote:"micro.fair.interation",
    mute:"micro.fair.adpmuted",unmute:"micro.fair.adpmuted",
    follow:"micro.fair.alice.follow",unfollow:"micro.fair.alice.follow",
    block:"micro.fair.alice.block",unblock:"micro.fair.alice.block",
    create_channel:"micro.fair.channels"
  };
  for(const [key,id] of Object.entries(cases)){
    assert.equal(getExampleForAction(key).id,id,key);
    assert.equal(resolveCustomJsonId(key,{username:"Alice",
      channel:key.startsWith("community-")?"hive.micro":undefined}),id,key);
  }
  assert.equal(resolveCustomJsonId("post",{channel:"hive.micro"}),"hive.micro");
  assert.equal(resolveCustomJsonId("reply",{channel:"Micro.Fair"}),"micro.fair");
  assert.equal(resolveCustomJsonId("community-post",{channel:"hivemicro"}),"hivemicro");
  assert.notEqual(resolveCustomJsonId("community-post",{channel:"hivemicro"}),
    resolveCustomJsonId("community-post",{channel:"hive.micro"}));
  assert.equal(resolveCustomJsonId("community-reply",{channel:""}),"");
  assert.equal(resolveCustomJsonId("community-post",{channel:"hive/micro"}),"");
  assert.equal(resolveCustomJsonId("community-post",{channel:"a".repeat(33)}),"");
  assert.equal(resolveCustomJsonId("follow",{username:"bad user"}),"");
  assert.equal(resolveCustomJsonId("block"),"");
  assert.equal(getExampleForAction("community-reply",{community:"bad/id"}),null);
  assert.equal(getExampleForAction("follow",{username:"bad user"}),null);
});

test("every example uses real production builders, posting authority and documented JSON fields",()=>{
  for(const action of HIVE_ACTION_REGISTRY) {
    const example=getExampleForAction(action.key);
    assert.ok(example,action.key);
    assert.equal(example.action,action);
    assert.equal(example.payload.app,APP_ID);
    assert.equal(example.payload.v,1);
    assert.equal(example.payload.type,action.type);
    assert.equal(example.authority,"Posting");
    assert.deepEqual(example.hiveOperation.required_auths,[]);
    assert.deepEqual(example.hiveOperation.required_posting_auths,
      [action.namespace==="moderation"?"faireye":"alice"]);
    assert.equal(example.hiveOperation.id,example.id);
    assert.deepEqual(JSON.parse(example.hiveOperation.json),example.payload);
    for(const field of Object.keys(example.payload))
      assert.ok(HIVE_FIELD_DESCRIPTIONS[field],action.key+" / "+field);
  }
  assert.deepEqual(getExampleForAction("upvote").payload,
    buildVotePayload(PROTOCOL_EXAMPLE_CONTENT_ID,"upvote"));
  assert.deepEqual(getExampleForAction("mute").payload,
    buildMutePayload(PROTOCOL_EXAMPLE_CONTENT_ID,"mute","Spam"));
  assert.deepEqual(getExampleForAction("follow").payload,
    buildUserActionPayload("follow","bob"));
  assert.deepEqual(getExampleForAction("create_channel").payload,
    buildChannelCreatePayload({id:"hive.micro",name:"Hive Micro",
      description:"A community about Hive",createdAt:"2026-11-07T12:00:00.000Z"}));
  assert.deepEqual(getExampleForAction("reply").payload,
    buildPostPayload({content:"Thanks for sharing! #hive",replyTo:12345,
      channel:APP_ID,mentions:[],tags:["hive"]}));
  assert.deepEqual(getExampleForAction("community-reply").payload,
    buildPostPayload({content:"Thanks for sharing! #hive",replyTo:12345,
      channel:"hive.micro",mentions:[],tags:["hive.micro","hive"]}));
  assert.equal(getExampleForAction("post").payload.reply_to,null);
  assert.equal(getExampleForAction("community-post").payload.channel,"hive.micro");
  assert.equal(getExampleForAction("block").payload.target_user,"bob");
  assert.equal(getExampleForAction("create_channel").payload.action,"create_channel");
  assert.equal(getExampleForAction("missing"),null);
});

test("invalid vote/user action variants are rejected, valid historical builders stay compatible",()=>{
  assert.throws(()=>buildVotePayload(1,"report"),/Unsupported vote action/);
  assert.throws(()=>buildUserActionPayload("mention","bob"),/Unsupported user action/);
  assert.throws(()=>buildMutePayload(1,"ban"),/Unsupported mute action/);
  assert.equal(buildVotePayload(1,"downvote").type,"downvote");
  assert.equal(buildUserActionPayload("unblock","bob").type,"unblock");
});

test("reference page shows all real IDs, typed fields, sample payloads and Hive envelopes safely",()=>{
  const html=buildProtocolReferencePage();
  assert.match(html,/id="protocolPageTitle"/);
  assert.match(html,/7 namespaces/);
  assert.match(html,/13 actions/);
  assert.match(html,/micro\.fair\.interation/);
  assert.match(html,/micro\.fair\.adpmuted/);
  assert.match(html,/micro\.fair\.\{user\}\.follow/);
  assert.match(html,/micro\.fair\.\{user\}\.block/);
  assert.match(html,/id="protocol-community"/);
  assert.match(html,/id="protocol-action-community-reply"/);
  assert.match(html,/id="protocol-action-create_channel"/);
  assert.match(html,/id="protocol-payload-post"/);
  assert.match(html,/id="protocol-envelope-upvote"/);
  assert.match(html,/id="protocolSearch"/);
  assert.match(html,/id="protocolFilterEmpty"/);
  assert.match(html,/data-copy-target="protocol-id-post"/);
  assert.match(html,/data-copy-target="protocol-payload-post"/);
  assert.match(html,/href="#\/protocol\?section=feed"/);
  assert.match(html,/placeholder HAFSQL operation ID/);
  assert.doesNotMatch(html,/\son(?:click|load|error)=["']/i);
  assert.doesNotMatch(html,/<script[\s>]/i);
  assert.doesNotMatch(html,/requestCustomJson\(/);
});

test("quick filtering matches actions and discloses no-results state",()=>{
  const listeners={},groups=[];
  for(const namespace of HIVE_NAMESPACE_REGISTRY){
    const actions=namespace.operations.map(key=>({dataset:{search:key},hidden:false}));
    groups.push({dataset:{search:namespace.label.toLowerCase()},hidden:false,
      querySelectorAll(){return actions;},actions});
  }
  const input={value:"",addEventListener:(name,fn)=>{listeners[name]=fn;}};
  const hidden=new Set(["hidden"]);
  const empty={classList:{toggle(name,enable){if(enable)hidden.add(name);else hidden.delete(name);}}};
  const status={textContent:""};
  const elements={protocolSearch:input,protocolFilterEmpty:empty,protocolFilterStatus:status};
  setupProtocolReferenceEvents({
    getElementById:id=>elements[id]||null,
    querySelectorAll:sel=>sel===".protocol-namespace-group"?groups:[]
  });
  assert.equal(typeof listeners.input,"function");
  input.value="upvote";listeners.input();
  assert.equal(groups.filter(x=>!x.hidden).length,1);
  assert.match(status.textContent,/1 matching operations/);
  input.value="no-such-protocol-operation";listeners.input();
  assert.equal(groups.filter(x=>!x.hidden).length,0);
  assert.ok(!hidden.has("hidden"));
  input.value="";listeners.input();
  assert.equal(groups.filter(x=>!x.hidden).length,7);
  assert.ok(hidden.has("hidden"));
});

test("offline route, navigation, advanced modal and broadcast paths use canonical registry",()=>{
  const app=read("js/app.js"),templates=read("js/templates.js");
  const router=read("js/routing.js"),api=read("js/api.js");
  const index=read("index.html"),style=read("css/protocol-reference.css");
  const docs=read("docs/hive-protocol.md");
  assert.match(templates,/href="#\/protocol" class="nav-item" id="leftNavProtocol"/);
  assert.match(templates,/id="customJsonProtocolLink"/);
  assert.doesNotMatch(templates,/value="microblog_v1"/);
  assert.match(app,/Choose a custom_json operation ID first/);
  assert.match(router,/const protocolRoute = path === "\/protocol"/);
  assert.match(router,/if \(!protocolRoute && allPosts\.length === 0 && !hasFinishedFeedSync\(\)\)/);
  assert.match(router,/feed\.innerHTML = buildProtocolReferencePage\(\)/);
  assert.match(router,/setupProtocolReferenceEvents\(\)/);
  assert.match(router,/getHiveNamespace\(section\)/);
  assert.match(router,/route\.newPage = "protocol"/);
  assert.match(router,/leftNavProtocol/);
  assert.match(api,/resolveCustomJsonId\(replyTo \? "reply" : "post"/);
  assert.match(api,/resolveCustomJsonId\(type, \{ username \}\)/);
  assert.match(api,/resolveCustomJsonId\(voteType\)/);
  assert.match(api,/resolveCustomJsonId\("mute"\)/);
  assert.match(api,/resolveCustomJsonId\("create_channel"\)/);
  assert.match(read("js/config.js"),/HIVE_CUSTOM_JSON_IDS/);
  assert.ok(index.indexOf("css/protocol-reference.css")>index.indexOf("css/composer-studio.css"));
  assert.match(style,/prefers-reduced-motion/);
  assert.match(style,/@media \(max-width: 640px\)/);
  assert.match(docs,/micro\.fair\.interation/);
  assert.match(docs,/micro\.fair\.adpmuted/);
  assert.match(index,/script-src 'self'/);
  assert.doesNotMatch(index,/script-src[^;]*unsafe-inline/);
});
