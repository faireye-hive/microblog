/**
 * Micro.fair writing helpers shared by preview and post rendering.
 * All user text is escaped; Markdown never becomes raw HTML.
 */
import { escapeAttr, escapeHtml, extractImages } from "../utils.js";
import { safeExternalUrl, safeHiveUsername, safeTag } from "../security/safe-values.js";
import { proxiedImageUrl } from "../security/media-url.js";

export const POST_CHARACTER_LIMIT = 2048;

export function cleanMediaText(value = "") {
  const text = typeof value === "string" ? value : "";
  return text
    .replace(/!\[[^\]\n]*\]\(([^)\s]+)\)/g, " ")
    .replace(/(?:^|\s)https?:\/\/[^\s<>"')]+?\.(?:png|jpe?g|gif|webp|bmp)(?=\s|$)/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function renderPlainText(value) {
  const text = typeof value === "string" ? value : "";
  const pattern = /(^|[\s])([#@])([a-z0-9._-]+)/gi;
  let html = "", last = 0;
  for (const match of text.matchAll(pattern)) {
    const before=match[1], sigil=match[2], target=match[3];
    html += escapeHtml(text.slice(last, match.index)) + escapeHtml(before);
    if (sigil === "#") {
      const tag=safeTag(target);
      html += tag
        ? `<a class="composer-inline-tag tag-link" href="#/tag/${encodeURIComponent(tag)}" data-tag="${escapeAttr(tag)}">#${escapeHtml(target)}</a>`
        : escapeHtml(sigil+target);
    } else {
      const user=safeHiveUsername(target);
      html += user !== "unknown"
        ? `<a class="composer-inline-mention" href="#/user/${encodeURIComponent(user)}">@${escapeHtml(target)}</a>`
        : escapeHtml(sigil+target);
    }
    last=match.index+match[0].length;
  }
  return html+escapeHtml(text.slice(last));
}

// Intentionally limited syntax: bold, italic, inline code and safe HTTP(S)
// Markdown links. Not a general-purpose HTML or Markdown parser.
function renderLine(line) {
  const re=/\[([^\]\n]{1,140})\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\x60([^\x60\n]+)\x60/g;
  let result="", last=0, match;
  while((match=re.exec(line))!==null) {
    result+=renderPlainText(line.slice(last,match.index));
    if(match[1]!==undefined){
      const safe=safeExternalUrl(match[2]);
      result+=safe
        ? `<a href="${escapeAttr(safe)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${escapeHtml(match[1])}</a>`
        : renderPlainText(match[0]);
    } else if(match[3]!==undefined){
      result+=`<strong>${escapeHtml(match[3])}</strong>`;
    } else if(match[4]!==undefined){
      result+=`<em>${escapeHtml(match[4])}</em>`;
    } else {
      result+=`<code>${escapeHtml(match[5])}</code>`;
    }
    last=match.index+match[0].length;
  }
  return result+renderPlainText(line.slice(last));
}
export function renderSafePostText(value="") {
  if(typeof value!=="string")return "";
  return value.split(/\r?\n/).map(renderLine).join("<br>");
}

export function wrapTextSelection(text, start, end, kind) {
  const source=typeof text==="string"?text:"";
  const a=Math.max(0,Math.min(source.length,Number.isInteger(start)?start:source.length));
  const b=Math.max(a,Math.min(source.length,Number.isInteger(end)?end:a));
  const syntax={bold:"**",italic:"*",code:"\x60"}[kind];
  if(!syntax)return {text:source,start:a,end:b};
  const placeholder={bold:"bold text",italic:"italic text",code:"code"}[kind];
  const selected=source.slice(a,b)||placeholder;
  const result=source.slice(0,a)+syntax+selected+syntax+source.slice(b);
  return {text:result,start:a+syntax.length,end:a+syntax.length+selected.length};
}

export function buildAttachmentMarkdown(kind, url, label="") {
  const safe=safeExternalUrl(url);
  if(!safe||/[()]/.test(safe))return null;
  const name=typeof label==="string"
    ? label.replace(/[\r\n\[\]]/g," ").trim().slice(0,60) : "";
  switch(kind) {
    case "image": return `![${name||"image"}](${safe})`;
    case "link": return `[${name||"link"}](${safe})`;
    case "video": return safe;
    case "file": return `[${name||"file"}](${safe})`;
    default: return null;
  }
}
export function appendComposerMarkup(text, markup) {
  const raw=typeof text==="string"?text:"";
  const insert=typeof markup==="string"?markup:"";
  const separator=raw.trim() ? (raw.endsWith("\n")?"":"\n") : "";
  return raw+separator+insert;
}

export function removeImageFromContent(content, url) {
  const src=typeof content==="string"?content:"";
  const target=safeExternalUrl(url);
  if(!target)return src;
  let removed=false;
  let next=src.replace(/!\[[^\]\n]*\]\(([^)\s]+)\)/g,full=>{
    const match=/!\[[^\]\n]*\]\(([^)\s]+)\)/.exec(full);
    if(!removed&&safeExternalUrl(match?.[1])===target){removed=true;return "";}
    return full;
  });
  if(!removed) {
    next=next.split("\n").filter(line=>{
      if(!removed && safeExternalUrl(line.trim())===target){removed=true;return false;}
      return true;
    }).join("\n");
  }
  return next.replace(/\n{3,}/g,"\n\n").trim();
}

export function buildComposerMediaHTML(value="") {
  const all=extractImages(value);
  const imgs=[...new Set(all)].slice(0,6);
  if(!imgs.length)return "";
  return `<div class="composer-media-header"><strong>Images</strong>
    <span>${imgs.length}${all.length>6?"+":""} attached by URL</span></div>
    <div class="composer-media-grid">${imgs.map((img,index)=>`
      <div class="composer-media-card">
        <img src="${escapeAttr(proxiedImageUrl(img))}"
             loading="lazy" alt="Attached image ${index+1}">
        <button type="button" class="composer-media-remove" data-image-index="${index}"
                aria-label="Remove image ${index+1}" title="Remove image">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>`).join("")}</div>`;
}

export function buildComposerPreviewHTML(content="", options={}) {
  const text=typeof content==="string"?content:"";
  const author=safeHiveUsername(options.author);
  const channel=typeof options.channel==="string"?safeTag(options.channel):"";
  const body=cleanMediaText(text);
  const media=buildComposerMediaHTML(text);
  return `
    <article class="composer-preview-card" aria-label="Post preview">
      <div class="composer-preview-identity">
        <span class="composer-preview-avatar" aria-hidden="true">@</span>
        <div><strong>${author==="unknown"?"You":"@"+escapeHtml(author)}</strong>
          <span>Preview · Not published</span></div>
        ${channel&&channel!=="micro.fair" ? `<span class="composer-preview-channel">#${escapeHtml(channel)}</span>`:""}
      </div>
      <div class="composer-preview-body">
        ${body ? renderSafePostText(body) :
          '<p class="composer-preview-placeholder">Your post preview will appear here as you type.</p>'}
      </div>
      ${media? `<div class="composer-preview-media">${media}</div>`:""}
    </article>`;
}
