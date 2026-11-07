import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  validateCustomJsonOperation,mayBroadcastValidatedOperation,MAX_VALIDATOR_JSON_BYTES
} from "../js/hive/validator.js";
import {
  proposeHiveV2Namespaces,PROTOCOL_V2_DRAFT_STATUS
} from "../js/hive/v2-plan.js";
import {getExampleForAction} from "../js/hive/examples.js";
import {HIVE_ACTION_REGISTRY,HIVE_CUSTOM_JSON_IDS} from "../js/hive/registry.js";
import {
  buildProtocolValidatorSection,setupCustomJsonModalValidator
} from "../js/ui/protocol-validator.js";
import {buildProtocolReferencePage} from "../js/ui/protocol-reference.js";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const reportFor=(key,overrides={})=>{
  const example=getExampleForAction(key);
  return validateCustomJsonOperation({
    id:example.id,
    json:JSON.stringify(example.payload),
    signer:example.hiveOperation.required_posting_auths[0],
    ...overrides
  });
};

test("all 13 real v1 transaction examples pass structural validation with exact signer",()=>{
  for(const action of HIVE_ACTION_REGISTRY) {
    const result=reportFor(action.key);
    assert.equal(result.valid,true,action.key+": "+JSON.stringify(result.errors));
    assert.equal(result.recognized,true,action.key);
    assert.equal(result.actionKey,action.key,action.key);
    assert.equal(result.requiresAcknowledgement,false,action.key);
    assert.equal(result.errors.length,0);
    assert.equal(mayBroadcastValidatedOperation(result),true);
    assert.ok(result.warnings.some(issue=>issue.field==="signature"));
  }
  assert.equal(getExampleForAction("mute").hiveOperation.required_posting_auths[0],"faireye");
  assert.equal(getExampleForAction("unmute").hiveOperation.required_posting_auths[0],"faireye");
});

test("JSON parser rejects malformed, empty, oversized and non-object inputs",()=>{
  for(const json of ["", "{", "[]", "null", "32", '"hello"', "true"]) {
    const result=validateCustomJsonOperation({id:"micro.fair",json,signer:"alice"});
    assert.equal(result.valid,false,json);
    assert.ok(result.errors.some(issue=>issue.field==="json"),json);
  }
  const huge="x".repeat(MAX_VALIDATOR_JSON_BYTES+10);
  const hugeReport=validateCustomJsonOperation({id:"micro.fair",json:huge});
  assert.ok(hugeReport.errors.some(issue=>issue.message.includes("64 KiB")));
  assert.equal(validateCustomJsonOperation({id:"",json:'{"app":"x"}'}).valid,false);
  assert.equal(validateCustomJsonOperation({id:"Bad ID",json:'{}'}).valid,false);
  assert.equal(validateCustomJsonOperation({id:"n".repeat(33),json:'{}'}).valid,false);
  assert.equal(validateCustomJsonOperation({id:"micro.fair",json:"{}"}).valid,false);
});

test("vote namespace/type mismatch and malicious prototype keys return errors, not crashes",()=>{
  const vote=getExampleForAction("upvote");
  const malformed=[
    {...vote.payload,type:"post"},
    {...vote.payload,type:"constructor"},
    {...vote.payload,type:"__proto__"},
    {...vote.payload,type:"toString"},
    {...vote.payload,app:"different"},
    {...vote.payload,v:2},
    {...vote.payload,content_id:"12345"},
    {...vote.payload,content_id:0},
    {...vote.payload,content_id:1.2}
  ];
  for(const payload of malformed) {
    const result=validateCustomJsonOperation({id:vote.id,json:payload,signer:"alice"});
    assert.equal(result.valid,false,JSON.stringify(payload));
    assert.ok(result.errors.length>0);
  }
  assert.equal(reportFor("upvote",{id:"micro.fair.adpmuted"}).valid,false);
  assert.equal(reportFor("post",{id:"micro.fair.interation"}).valid,false);
  assert.equal(reportFor("upvote",{id:"micro.fair.interact"}).valid,false);
});

test("posts/replies validate exact channel IDs and referential operation IDs",()=>{
  const sample=getExampleForAction("post");
  const wrongChannel={...sample.payload,channel:"hive.micro"};
  assert.equal(reportFor("post",{json:wrongChannel}).valid,false);
  assert.equal(reportFor("post",{json:{...sample.payload,reply_to:12}}).valid,false);
  assert.equal(reportFor("reply",{json:{...getExampleForAction("reply").payload,reply_to:"123"}}).valid,false);
  assert.equal(reportFor("reply",{json:{...getExampleForAction("reply").payload,reply_to:0}}).valid,false);
  assert.equal(reportFor("post",{json:{...sample.payload,content:"x".repeat(2049)}}).valid,false);
  assert.equal(reportFor("post",{json:{...sample.payload,tags:"hive"}}).valid,false);
  assert.equal(reportFor("post",{json:{...sample.payload,mentions:["BAD NAME"]}}).valid,false);
  assert.equal(reportFor("community-post",{id:"hivemicro"}).valid,false);
  assert.equal(reportFor("community-post").valid,true);
  const normalPost=reportFor("post",{json:{...sample.payload,extra_metadata:"extended"}});
  assert.equal(normalPost.valid,true);
  assert.ok(normalPost.warnings.some(issue=>issue.field==="json"));
});

test("follow/block signer identity cannot be replaced with a target or another account",()=>{
  assert.equal(reportFor("follow",{signer:"bob"}).valid,false);
  assert.equal(reportFor("unblock",{signer:"bob"}).valid,false);
  const block=getExampleForAction("block");
  assert.equal(reportFor("block",{json:{...block.payload,target_user:"alice"}}).valid,false);
  assert.equal(reportFor("block",{json:{...block.payload,target_user:"bad user"}}).valid,false);
  assert.equal(reportFor("block",{id:"micro.fair.bob.block"}).valid,false);
});

test("moderation is limited to the configured admin signature, and channels check fields",()=>{
  assert.equal(reportFor("mute",{signer:"alice"}).valid,false);
  assert.equal(reportFor("unmute",{signer:"bob"}).valid,false);
  const mute=getExampleForAction("mute");
  assert.equal(reportFor("mute",{json:{...mute.payload,cause:""}}).valid,false);
  const channel=getExampleForAction("create_channel");
  assert.equal(reportFor("create_channel",{json:{...channel.payload,action:"add_channel"}}).valid,false);
  assert.equal(reportFor("create_channel",{json:{...channel.payload,id:"bad/id"}}).valid,false);
  assert.equal(reportFor("create_channel",{json:{...channel.payload,created_at:"yesterday"}}).valid,false);
  assert.equal(reportFor("create_channel",{json:{...channel.payload,name:"  "}}).valid,false);
});

test("unregistered external Custom JSON keeps advanced mode, but requires explicit consent",()=>{
  const unrelated=validateCustomJsonOperation({
    id:"external.app",json:'{"app":"external","v":2,"type":"special"}',signer:"alice"
  });
  assert.equal(unrelated.valid,true);
  assert.equal(unrelated.recognized,false);
  assert.equal(unrelated.requiresAcknowledgement,true);
  assert.equal(mayBroadcastValidatedOperation(unrelated),false);
  assert.equal(mayBroadcastValidatedOperation(unrelated,true),true);
  const unknownMicrofair=validateCustomJsonOperation({
    id:"micro.fair.fake",json:'{"app":"micro.fair","v":1,"type":"fake"}',signer:"alice"
  });
  assert.equal(unknownMicrofair.valid,false);
  assert.equal(mayBroadcastValidatedOperation(unknownMicrofair,true),false);
  const knownIdForeignApp=validateCustomJsonOperation({
    id:"micro.fair.interation",json:'{"app":"foreign","type":"upvote","v":1,"content_id":12}',
    signer:"alice"
  });
  assert.equal(knownIdForeignApp.valid,false);
});

test("v2 namespace planning is disabled by default and cannot alter legacy mappings",()=>{
  const plan=proposeHiveV2Namespaces("hivora");
  assert.deepEqual(plan.errors,[]);
  assert.equal(plan.status,PROTOCOL_V2_DRAFT_STATUS);
  assert.equal(plan.version,2);
  assert.equal(plan.enabled,false);
  assert.deepEqual(plan.ids,{
    posts:"hivora.posts",votes:"hivora.votes",moderation:"hivora.moderation",
    communities:"hivora.communities",relationships:"hivora.relationships",
    communityPosts:"hivora.c.{channel}"
  });
  assert.equal(plan.legacy.posts,"micro.fair");
  assert.equal(plan.legacy.votes,"micro.fair.interation");
  assert.equal(plan.legacy.communityPosts,"{channel}");
  assert.ok(plan.decisionsRequired.some(x=>x.includes("historic data")));
  assert.equal(proposeHiveV2Namespaces("hive").ids,null);
  assert.ok(proposeHiveV2Namespaces("Bad Brand!!").errors.length>0);
  assert.ok(proposeHiveV2Namespaces("a".repeat(19)).errors.length>0);
  assert.equal(proposeHiveV2Namespaces("").enabled,false);
});

test("page includes read-only validator and a v2 preflight UI without signing tools",()=>{
  const html=buildProtocolValidatorSection();
  const page=buildProtocolReferencePage();
  for(const id of ["protocolValidatorId","protocolValidatorSigner","protocolValidatorJson",
    "protocolValidatorResults","protocolValidatorLoadExample","protocolValidatorCheck",
    "protocolV2BrandInput","protocolV2Results","protocolV2Preview"]) {
    assert.ok(html.includes('id="'+id+'"'),id);
    assert.ok(page.includes('id="'+id+'"'),id);
  }
  assert.match(page,/PROPOSAL ONLY/);
  assert.match(page,/No transactions sent/);
  assert.doesNotMatch(html,/requestCustomJson\(|onclick=|onerror=/);
});

test("advanced Custom JSON modal blocks invalid messages and resets arbitrary-operation approval on edits",()=>{
  const nodes={};
  const node=(id,value="")=>{
    const n={id,value,textContent:"",dataset:{},disabled:false,checked:false,
      handlers:{},classList:{toggle(){},contains(){return false;}},
      addEventListener(type,callback){this.handlers[type]=callback;}};
    nodes[id]=n;
    return n;
  };
  const id=node("customJsonId");
  const payload=node("customJsonPayload");
  const button=node("submitCustomJson");
  const ack=node("customJsonUnregisteredAck");
  node("customJsonValidationResults");
  node("customJsonUnregisteredWrap");
  const root={getElementById(key){return nodes[key]||null;}};
  const controller=setupCustomJsonModalValidator({root,getSigner:()=>"alice"});
  assert.ok(controller);
  assert.equal(controller.canBroadcast(),false);
  assert.equal(button.disabled,true);

  const sample=getExampleForAction("upvote");
  id.value=sample.id;payload.value=JSON.stringify(sample.payload);
  id.handlers.input();
  assert.equal(controller.canBroadcast(),true);
  assert.equal(button.disabled,false);

  id.value="outside.app";payload.value='{"app":"someone-else","type":"announce"}';
  payload.handlers.input();
  assert.equal(button.disabled,true);
  assert.equal(controller.canBroadcast(),false);
  ack.checked=true;ack.handlers.change();
  assert.equal(controller.canBroadcast(),true);
  payload.value='{"app":"someone-else","type":"other"}';
  payload.handlers.input();
  assert.equal(ack.checked,false);
  assert.equal(controller.canBroadcast(),false);

  id.value="micro.fair";payload.value='{"app":"micro.fair","v":1,"type":"post"}';
  id.handlers.input();
  ack.checked=true;
  assert.equal(controller.canBroadcast(),false);
});

test("validator is wired before Keychain and keeps existing CSP, UI style, routing and docs",()=>{
  const app=read("js/app.js"),tmpl=read("js/templates.js");
  const page=read("js/ui/protocol-reference.js"),css=read("css/protocol-validator.css");
  const html=read("index.html");
  assert.match(app,/setupCustomJsonModalValidator/);
  assert.match(app,/customValidator\?\.canBroadcast\(\)/);
  assert.ok(app.indexOf("customValidator?.canBroadcast()") <
    app.indexOf('requestHiveCustomJson(\n      loggedInUser,'));
  assert.match(tmpl,/id="customJsonUnregisteredAck"/);
  assert.match(tmpl,/id="customJsonValidationResults"/);
  assert.match(tmpl,/id="submitCustomJson"[^>]*disabled/);
  assert.match(page,/buildProtocolValidatorSection\(\)/);
  assert.match(page,/setupProtocolValidatorWorkbench\(root\)/);
  assert.ok(html.indexOf("css/protocol-validator.css")>html.indexOf("css/protocol-reference.css"));
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(html,/script-src 'self'/);
  assert.doesNotMatch(html,/script-src[^;]*unsafe-inline/);
});
