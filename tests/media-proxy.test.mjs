import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import {
  isPublicIp, validateImageSource, resolvePublicImageHost,
  fetchProxiedImage, MAX_IMAGE_BYTES
} from "../js/server/image-fetch.js";
import { createImageProxyHandler } from "../js/server/image-proxy.js";
import { imageProxyEndpoint, proxiedImageUrl } from "../js/security/media-url.js";

const validPng = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);

test("reject private, loopback, metadata and untrusted DNS IPs", async () => {
  for (const address of [
    "127.0.0.1", "10.2.3.4", "192.168.1.10", "172.20.1.1",
    "169.254.169.254", "100.100.100.100", "0.0.0.0",
    "::1", "fe80::1", "fc00::1", "ff00::1",
    "::ffff:127.0.0.1", "::ffff:192.168.1.1",
  ]) assert.equal(isPublicIp(address), false, address);
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) {
    assert.equal(isPublicIp(address), true, address);
  }
  await assert.rejects(() => resolvePublicImageHost("localhost", async () =>
    [{address:"127.0.0.1",family:4}]), /disallowed/);
  await assert.rejects(() => resolvePublicImageHost("mixed.test", async () =>
    [{address:"8.8.8.8",family:4},{address:"10.0.0.1",family:4}]), /disallowed/);
  assert.deepEqual(await resolvePublicImageHost("example.com", async () =>
    [{address:"93.184.216.34",family:4}]), {address:"93.184.216.34",family:4});
});

test("only HTTPS images on default port with no credentials are accepted", () => {
  const bad=[
    "http://example.com/a.png","ftp://example.com/a.png",
    "https://user:secret@example.com/a.png", "https://example.com:3000/a.png",
    "file:///etc/passwd", "data:image/png;base64,AAA", "javascript:alert(1)",
    "//example.com/a.png", "https://", "", "x".repeat(2500)
  ];
  for (const value of bad) assert.throws(()=>validateImageSource(value), undefined, value);
  assert.equal(validateImageSource("https://example.com/a.png#local").href,
    "https://example.com/a.png");
  assert.equal(validateImageSource("https://example.com:443/a.png").hostname,"example.com");
});

function mockTransport({status=200,contentType="image/png",bytes=validPng,declaredLength}={}) {
  const captured=[];
  const request=(url,options,callback)=>{
    captured.push({url,options});
    const req = new EventEmitter();
    req.setTimeout=()=>req;
    req.destroy=()=>req;
    req.end=()=>{
      queueMicrotask(()=>{
        const response=new PassThrough();
        response.statusCode=status;
        response.headers={"content-type":contentType};
        if(declaredLength!==undefined)response.headers["content-length"]=declaredLength;
        callback(response);
        response.end(bytes);
      });
    };
    return req;
  };
  return {request,captured};
}

test("HTTPS fetch pins inspected DNS and only returns validated image bytes", async () => {
  const t=mockTransport();
  const res=await fetchProxiedImage("https://pics.example.com/p.png",{
    resolve:async () => ({address:"93.184.216.34",family:4}),
    request:t.request
  });
  assert.equal(res.contentType,"image/png");
  assert.deepEqual(res.bytes,validPng);
  assert.equal(t.captured.length,1);
  const options=t.captured[0].options;
  assert.equal(options.agent,false);
  const dns=await new Promise(resolve=>options.lookup("pics.example.com",{},(e,address,family)=>resolve({e,address,family})));
  assert.deepEqual(dns,{e:null,address:"93.184.216.34",family:4});
  assert.equal(options.headers.cookie,undefined);
  assert.equal(options.headers.authorization,undefined);
});

test("upstream redirects, SVG, wrong signatures and oversized media are rejected", async () => {
  const resolve=async()=>({address:"93.184.216.34",family:4});
  for(const [payload,status] of [
    [{status:302},502],
    [{contentType:"image/svg+xml",bytes:Buffer.from("<svg/>")},415],
    [{contentType:"image/png",bytes:Buffer.from("<html>")},415],
    [{declaredLength:MAX_IMAGE_BYTES+1},413],
    [{bytes:Buffer.alloc(64)},415]
  ]){
    const t=mockTransport(payload);
    await assert.rejects(()=>fetchProxiedImage("https://media.example.com/image",{
      resolve,request:t.request,maxBytes:32
    }), e=>e.status===status);
  }
});

function responseRecorder() {
  return {
    statusCode:200,headers:{},body:null,
    status(value){this.statusCode=value;return this;},
    set(key,value){this.headers[key.toLowerCase()]=value;return this;},
    send(body){this.body=body;return this;},
  };
}

test("proxy endpoint caches bounded image results and declines invalid URL", async () => {
  let calls=0, now=100;
  const handler=createImageProxyHandler({
    clock:()=>now,
    fetchImage:async()=>{calls++;return {bytes:validPng,contentType:"image/png"};},
    ttlMs:100,
  });
  const request={query:{url:"https://example.com/a.png"}};
  const first=responseRecorder();
  await handler(request,first);
  assert.equal(first.statusCode,200);
  assert.equal(first.headers["content-type"],"image/png");
  assert.equal(first.headers["cache-control"],"public, max-age=3600");
  assert.deepEqual(first.body,validPng);
  const cached=responseRecorder();
  await handler(request,cached);
  assert.equal(calls,1);
  now=201;
  await handler(request,responseRecorder());
  assert.equal(calls,2);
  const invalid=responseRecorder();
  await handler({query:{url:"http://127.0.0.1/"}},invalid);
  assert.equal(invalid.statusCode,400);
  assert.equal(calls,2);
});

test("proxy bounds parallel upstream work under load",async()=>{
  let resume;
  const handler=createImageProxyHandler({maxConcurrent:1,fetchImage:()=>
    new Promise(resolve=>{resume=()=>resolve({bytes:validPng,contentType:"image/png"});})});
  const req={query:{url:"https://pics.example.com/a.png"}};
  const first=responseRecorder();
  const pending=handler(req,first);
  const busy=responseRecorder();
  await handler(req,busy);
  assert.equal(busy.statusCode,503);
  assert.equal(busy.headers["retry-after"],"2");
  resume();await pending;
  assert.equal(first.statusCode,200);
});

test("proxy rate limit returns 429 before further upstream work",async()=>{
  let fetches=0, now=0;
  const handler=createImageProxyHandler({
    maxRequestsPerMinute:2,
    clock:()=>now,
    fetchImage:async()=>{fetches++;return {bytes:validPng,contentType:"image/png"};}
  });
  const req={socket:{remoteAddress:"192.0.2.99"},query:{url:"https://example.com/a.png"}};
  await handler(req,responseRecorder());
  await handler(req,responseRecorder());
  const limited=responseRecorder();
  await handler(req,limited);
  assert.equal(limited.statusCode,429);
  assert.equal(limited.headers["retry-after"],"60");
  assert.equal(fetches,1);
  now=61000;
  const after=responseRecorder();
  await handler(req,after);
  assert.equal(after.statusCode,200);
});

test("frontend media URLs preserve GitHub Pages until a Render proxy is configured",()=>{
  const gh={origin:"https://faireye-hive.github.io",hostname:"faireye-hive.github.io",port:""};
  assert.equal(imageProxyEndpoint({origin:"",location:gh}),"");
  const source="https://images.hive.blog/u/faireye/avatar";
  assert.equal(proxiedImageUrl(source,{origin:"",location:gh}),source);
  const local={origin:"http://localhost:3000",hostname:"localhost",port:"3000"};
  const expected="http://localhost:3000/api/image?url="+encodeURIComponent(source);
  assert.equal(proxiedImageUrl(source,{origin:"",location:local}),expected);
  assert.equal(proxiedImageUrl(source,{origin:"https://proxy.example.com",location:gh}),
    "https://proxy.example.com/api/image?url="+encodeURIComponent(source));
  assert.equal(imageProxyEndpoint({origin:"javascript:alert(1)",location:gh}),"");
  assert.equal(proxiedImageUrl("<img onerror=x>",{origin:"",location:gh}),"");
});

test("active rendered image sources use optional proxy helper",()=>{
  for(const path of ["../js/render.js","../js/auth.js","../js/templates.js"]){
    const s=readFileSync(new URL(path,import.meta.url),"utf8");
    assert.match(s,/proxiedImageUrl/);
  }
  const server=readFileSync(new URL("../server.js",import.meta.url),"utf8");
  assert.match(server,/app\.get\('\/api\/image', createImageProxyHandler\(\)\)/);
});
