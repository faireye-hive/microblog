/**
 * Composer interaction controller. Uses existing post/Keychain operations,
 * keeps editing local until the user explicitly presses Post.
 */
import { extractImages } from "../utils.js";
import { safeExternalUrl } from "../security/safe-values.js";
import {
  POST_CHARACTER_LIMIT, wrapTextSelection, appendComposerMarkup,
  buildAttachmentMarkdown, removeImageFromContent, buildComposerMediaHTML,
  buildComposerPreviewHTML
} from "./composer-tools.js";

export function setupComposerStudio({
  onPost,
  notify,
  getAuthor=()=>null,
  getChannel=()=>null,
  onCustomJson=()=>{}
}={}) {
  const $=id=>document.getElementById(id);
  const textarea=$("newPostContent"), postBtn=$("btnPost"), counter=$("charCount");
  if(!textarea || !postBtn) return null;
  const mediaTray=$("composerMediaTray"), preview=$("composerPreviewContent");
  const writePane=$("composerWritePane"), previewPane=$("composerPreviewPane");
  const writeTab=$("composerWriteTab"), previewTab=$("composerPreviewTab");
  const assetPanel=$("composerAttachmentPanel"), assetForm=$("composerAssetForm");
  const assetUrl=$("composerAssetUrl"), assetLabel=$("composerAssetLabel");
  const assetTitle=$("composerAssetTitle"), assetHelp=$("composerAssetHelp");
  const assetCaption=$("composerAssetLabelCaption");
  let assetMode="image", pending=false;

  function redraw() {
    const value=textarea.value;
    const size=value.length;
    if(counter) {
      counter.textContent=`${size} / ${POST_CHARACTER_LIMIT}`;
      counter.classList.toggle("composer-limit-near",size>1750);
      counter.classList.toggle("composer-limit-reached",size>=POST_CHARACTER_LIMIT);
    }
    postBtn.disabled=pending || !value.trim() || size>POST_CHARACTER_LIMIT;
    if(mediaTray) {
      const media=buildComposerMediaHTML(value);
      mediaTray.innerHTML=media;
      mediaTray.classList.toggle("hidden",!media);
    }
    if(preview && previewPane && !previewPane.classList.contains("hidden")) {
      preview.innerHTML=buildComposerPreviewHTML(value,{author:getAuthor(),channel:getChannel()});
    }
  }
  function switchView(mode,{focus=false}={}) {
    const showingPreview=mode==="preview";
    writePane?.classList.toggle("hidden",showingPreview);
    previewPane?.classList.toggle("hidden",!showingPreview);
    writeTab?.classList.toggle("active",!showingPreview);
    previewTab?.classList.toggle("active",showingPreview);
    writeTab?.setAttribute("aria-selected",String(!showingPreview));
    previewTab?.setAttribute("aria-selected",String(showingPreview));
    if(showingPreview && preview)
      preview.innerHTML=buildComposerPreviewHTML(textarea.value,{author:getAuthor(),channel:getChannel()});
    if(focus) {
      if(showingPreview) previewTab?.focus();
      else textarea.focus();
    }
  }
  function notifyError(message){notify?.(message,false);}
  function applyFormat(kind) {
    switchView("write");
    const formatted=wrapTextSelection(textarea.value,textarea.selectionStart,textarea.selectionEnd,kind);
    if(formatted.text.length>POST_CHARACTER_LIMIT){
      notifyError("This formatting would exceed the 2,048-character limit.");
      return;
    }
    textarea.value=formatted.text;
    textarea.focus();
    textarea.setSelectionRange(formatted.start,formatted.end);
    textarea.dispatchEvent(new Event("input",{bubbles:true}));
  }

  function hideAttachment() {
    assetPanel?.classList.add("hidden");
    assetUrl.value="";
    assetLabel.value="";
  }
  function openAttachment(mode) {
    assetMode=mode;
    switchView("write");
    const titles={image:"Add an image",link:"Insert a link",video:"Add a video URL",file:"Attach a file URL"};
    const help={
      image:"Paste a public image URL. Your image must already be hosted online — no upload is performed.",
      link:"Links are inserted as Markdown and shown safely in published posts.",
      video:"Videos are linked by URL. An embedded video player is not provided here.",
      file:"Files must already be available at a public URL; this does not upload files."
    };
    if(assetTitle)assetTitle.textContent=titles[mode]||"Add a link";
    if(assetHelp)assetHelp.textContent=help[mode]||help.link;
    if(assetCaption)assetCaption.textContent=mode==="image"?"Image description (optional)":"Link label (optional)";
    if(assetUrl) assetUrl.placeholder=mode==="image"?"https://example.com/photo.jpg":"https://example.com/";
    assetPanel?.classList.remove("hidden");
    assetUrl?.focus();
  }

  function submitPost() {
    const content=textarea.value.trim();
    if(!content)return notifyError("Write something before posting.");
    if(content.length>POST_CHARACTER_LIMIT)return notifyError("The maximum post length is 2,048 characters.");
    if(pending)return;
    pending=true;redraw();
    const done=()=>{pending=false;redraw();switchView("write");hideAttachment();};
    try {
      const started=onPost?.(content,{onSuccess:done,onFailure:done});
      if(started===false)done();
    } catch(error) {
      done(); notifyError("Could not start this post. Please try again.");
    }
  }

  textarea.addEventListener("input",redraw);
  textarea.addEventListener("keydown",event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="b"){
      event.preventDefault();applyFormat("bold");
    } else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="i"){
      event.preventDefault();applyFormat("italic");
    } else if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){
      event.preventDefault(); submitPost();
    }
  });
  postBtn.addEventListener("click",submitPost);
  writeTab?.addEventListener("click",()=>switchView("write",{focus:true}));
  previewTab?.addEventListener("click",()=>switchView("preview",{focus:true}));
  document.querySelectorAll(".composer-format-btn").forEach(btn=>{
    btn.addEventListener("click",()=>applyFormat(btn.dataset.format));
  });

  mediaTray?.addEventListener("click",event=>{
    const button=event.target.closest(".composer-media-remove");
    if(!button)return;
    const image=extractImages(textarea.value)[Number(button.dataset.imageIndex)];
    if(!image)return;
    textarea.value=removeImageFromContent(textarea.value,image);
    textarea.dispatchEvent(new Event("input",{bubbles:true}));
    textarea.focus();
  });

  assetForm?.addEventListener("submit",event=>{
    event.preventDefault();
    const raw=assetUrl?.value?.trim()||"";
    if(!safeExternalUrl(raw)){
      notifyError("Enter a valid public HTTP or HTTPS URL.");
      assetUrl?.focus();
      return;
    }
    const markdown=buildAttachmentMarkdown(assetMode,raw,assetLabel?.value||"");
    if(!markdown){
      notifyError("The URL cannot contain parentheses. Try a direct link instead.");
      assetUrl?.focus();
      return;
    }
    const next=appendComposerMarkup(textarea.value,markdown);
    if(next.length>POST_CHARACTER_LIMIT){
      notifyError("There isn't enough space left for this attachment.");
      return;
    }
    textarea.value=next;
    textarea.dispatchEvent(new Event("input",{bubbles:true}));
    hideAttachment();
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length,textarea.value.length);
  });
  $("composerAssetCancel")?.addEventListener("click",hideAttachment);
  $("composerAssetClose")?.addEventListener("click",hideAttachment);
  assetPanel?.addEventListener("keydown",event=>{
    if(event.key==="Escape"){event.preventDefault();hideAttachment();textarea.focus();}
  });

  document.querySelectorAll(".composer-tools .tool-pill").forEach(pill=>{
    pill.addEventListener("click",()=>{
      const mode=pill.dataset.mode;
      const advanced=pill.closest(".composer-extra");
      if(advanced)advanced.open=false;
      document.querySelectorAll(".composer-tools .tool-pill").forEach(p=>p.classList.remove("active"));
      if(mode==="text"){pill.classList.add("active");switchView("write",{focus:true});hideAttachment();}
      else if(mode==="json"){onCustomJson();}
      else openAttachment(mode);
    });
  });
  redraw();
  return {redraw,switchView,applyFormat,openAttachment};
}
