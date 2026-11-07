import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  POST_CHARACTER_LIMIT, cleanMediaText, renderSafePostText,
  wrapTextSelection, buildAttachmentMarkdown, appendComposerMarkup,
  removeImageFromContent, buildComposerMediaHTML, buildComposerPreviewHTML
} from "../js/ui/composer-tools.js";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("safe lightweight Markdown is shared by composer preview and published post cards",()=>{
  const text="**Bold** and *italic* and \x60code\x60 plus [Hive](https://hive.io/?a=1&b=2)\n#news @faireye";
  const html=renderSafePostText(text);
  assert.match(html,/<strong>Bold<\/strong>/);
  assert.match(html,/<em>italic<\/em>/);
  assert.match(html,/<code>code<\/code>/);
  assert.match(html,/href="https:\/\/hive\.io\/\?a=1&amp;b=2"/);
  assert.match(html,/href="#\/tag\/news"/);
  assert.match(html,/href="#\/user\/faireye"/);
  assert.match(html,/<br>/);
  assert.match(read("js/render.js"),/renderSafePostText\(bodyText\)/);
  assert.match(read("js/render.js"),/renderSafePostText\(cleanMediaText/);
});

test("Markdown and malicious links stay escaped without executing anything",()=>{
  const html=renderSafePostText('**<svg onload=alert(1)>** [bad](javascript:alert(1)) #dev @faireye');
  assert.doesNotMatch(html,/<svg/i);
  assert.match(html,/&lt;svg onload=alert\(1\)&gt;/);
  assert.doesNotMatch(html,/href="javascript:/);
  assert.match(html,/href="#\/tag\/dev"/);
  assert.match(html,/href="#\/user\/faireye"/);
  assert.doesNotMatch(html,/\son(?:click|load|error)=["']/i);
  assert.equal(renderSafePostText({content:"bad"}),"");
});

test("format selection wraps current text and preserves cursor focus ranges",()=>{
  assert.deepEqual(wrapTextSelection("Hello Hive",0,5,"bold"),
    {text:"**Hello** Hive",start:2,end:7});
  assert.deepEqual(wrapTextSelection("a b",2,3,"italic"),
    {text:"a *b*",start:3,end:4});
  const code=wrapTextSelection("",0,0,"code");
  assert.equal(code.text,"\x60code\x60");
  assert.deepEqual(wrapTextSelection("abc",1,2,"unrecognized"),
    {text:"abc",start:1,end:2});
  assert.equal(POST_CHARACTER_LIMIT,2048);
});

test("attachment tools reject unsafe URLs and create compatible text-only Hive payloads",()=>{
  const photo=buildAttachmentMarkdown("image","https://cdn.example.com/photo.jpg","Street photo");
  assert.equal(photo,"![Street photo](https://cdn.example.com/photo.jpg)");
  assert.equal(buildAttachmentMarkdown("link","https://hive.io/blog","Hive"),"[Hive](https://hive.io/blog)");
  assert.equal(buildAttachmentMarkdown("video","https://video.example/video"),"https://video.example/video");
  assert.equal(buildAttachmentMarkdown("file","https://example.org/file.pdf"),"[file](https://example.org/file.pdf)");
  assert.equal(buildAttachmentMarkdown("image","javascript:alert(1)"),null);
  assert.equal(buildAttachmentMarkdown("link","https://evil.example/(test)"),null);
  assert.equal(buildAttachmentMarkdown("image","https://user:pass@evil.example/pic.jpg"),null);
  assert.equal(buildAttachmentMarkdown("foo","https://hive.io"),null);
  assert.equal(appendComposerMarkup("Hello",photo),"Hello\n"+photo);
  assert.equal(appendComposerMarkup("Hello\n",photo),"Hello\n"+photo);
});

test("media thumbnails are safe and can be removed from raw editor content",()=>{
  const input=[
    "Hello!",
    "![one](https://cdn.example.com/1.png)",
    "![two](https://cdn.example.com/2.png)"
  ].join("\n");
  const tray=buildComposerMediaHTML(input);
  assert.match(tray,/composer-media-grid/);
  assert.equal((tray.match(/class="composer-media-card"/g)||[]).length,2);
  assert.match(tray,/data-image-index="0"/);
  assert.match(tray,/data-image-index="1"/);
  assert.match(tray,/aria-label="Remove image 2"/);
  assert.doesNotMatch(tray,/\sonerror=/);
  const cleared=removeImageFromContent(input,"https://cdn.example.com/1.png");
  assert.doesNotMatch(cleared,/1\.png/);
  assert.match(cleared,/2\.png/);
  assert.match(cleared,/Hello!/);
  assert.equal(removeImageFromContent(input,"javascript:alert(1)"),input);
  assert.doesNotMatch(cleanMediaText(input),/!\[one\]/);
});

test("preview shows the same safe formatting and is read-only, not a fake published post",()=>{
  const content="**Hello** Hive #news @faireye\n![image](https://cdn.example.com/pic.png)";
  const html=buildComposerPreviewHTML(content,{author:"faireye",channel:"dev"});
  assert.match(html,/class="composer-preview-card"/);
  assert.match(html,/Preview · Not published/);
  assert.match(html,/#dev/);
  assert.match(html,/<strong>Hello<\/strong>/);
  assert.match(html,/href="#\/user\/faireye"/);
  assert.match(html,/https:\/\/cdn.example.com\/pic.png/);
  assert.doesNotMatch(html,/composer-media-remove/);
  const malicious=buildComposerPreviewHTML('<img src=x onerror=alert(1)>');
  assert.doesNotMatch(malicious,/<img src=x onerror=alert\(1\)>/);
  assert.match(malicious,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(buildComposerPreviewHTML(""),/Your post preview will appear here/);
});

test("the editor preserves all existing Hive tool modes and accessible controls",()=>{
  const templates=read("js/templates.js");
  const controller=read("js/ui/composer-controller.js");
  const index=read("index.html");
  const css=read("css/composer-studio.css");
  for(const id of ["newPostContent","charCount","btnPost","composerWriteTab","composerPreviewTab",
    "composerWritePane","composerPreviewPane","composerPreviewContent","composerMediaTray",
    "composerAssetForm","composerAssetUrl","composerAssetLabel","composerAssetCancel"]){
    assert.ok(templates.includes('id="'+id+'"'),id);
  }
  for(const format of ["bold","italic","code"]){
    assert.ok(templates.includes('data-format="'+format+'"'),format);
  }
  for(const mode of ["text","image","link","video","file","json"])
    assert.ok(templates.includes('data-mode="'+mode+'"'),mode);
  assert.match(templates,/maxlength="2048"/);
  assert.match(templates,/role="tablist" aria-label="Post editor view"/);
  assert.match(templates,/No file is uploaded from your device/);
  assert.doesNotMatch(controller,/\bprompt\(/);
  assert.match(controller,/new Event\("input",\{bubbles:true\}\)/);
  assert.match(controller,/event\.ctrlKey\|\|event\.metaKey/);
  assert.ok(index.indexOf("css/composer-studio.css")>index.indexOf("css/public-profile.css"));
  for(const sel of [".composer-writing-surface",".composer-view-tabs",".composer-format-toolbar",
    ".composer-media-tray",".composer-asset-panel",".composer-preview-card",".reply-format-toolbar"])
    assert.ok(css.includes(sel),sel);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/@media \(max-width: 640px\)/);
  assert.match(index,/script-src 'self'/);
  assert.doesNotMatch(index,/script-src[^;]*unsafe-inline/);
});

test("posts and replies only clear drafts after Hive confirms the transaction",()=>{
  const api=read("js/api.js");
  const app=read("js/app.js");
  assert.match(api,/content\.length > POST_CHARACTER_LIMIT/);
  assert.match(api,/callbacks\?\.onSuccess\?\.\(localPost\)/);
  assert.match(api,/callbacks\?\.onFailure\?\.\(res\)/);
  assert.match(api,/if \(!replyTo\) \{/);
  assert.match(api,/textarea\.value\.trim\(\) === content\.trim\(\)/);
  assert.match(api,/return false/);
  assert.match(app,/setupComposerStudio\(/);
  assert.match(app,/data-reply-format="bold"/);
  assert.match(app,/data-reply-format="italic"/);
  assert.match(app,/class="reply-preview-toggle"/);
  assert.match(app,/class="reply-preview-content hidden"/);
  assert.match(app,/replySubmitting = true/);
  assert.match(app,/onSuccess: \(\) => \{done\(\);close\(\);\}/);
});
