//utils.js


// utils.js - Helpers & Strong XSS Protection Engine

// Funções Helpers de Parse seguro
import { safeExternalUrl } from "./security/safe-values.js";

export function parseEmbeddedJson(str) {
  if (!str) return null;
  if (typeof str !== "string") return str;
  try {
    return JSON.parse(str);
  } catch {
    return { content: str || "" };
  }
}

// 1. ESCAPAMENTO ROBUSTO DE HTML
export function escapeHtml(str = "") {
  if (str === null || str === undefined) return "";
  const s = String(str);
  return s.replace(
    /[&<>"'`/]/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "`": "&#96;",
        "/": "&#x2F;",
      }[m])
  );
}

// 2. ESCAPAMENTO DE ATRIBUTOS HTML
export function escapeAttr(str = "") {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove caracteres de controle
    .replace(/[&<>"'`]/g, (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "`": "&#96;",
      }[m])
    );
}

// 3. SANITIZAÇÃO ESTRITA DE URLS (Defesa contra javascript:, data:, vbscript:)
// URLs are validated as raw strings. HTML attributes must use escapeAttr.
export function sanitizeUrl(url = "") {
  if (typeof url !== "string") return "";
  const value = url.trim();
  if (!value || /[\u0000-\u0020\u007f-\u009f<>"'`]/.test(value)) return "";
  // Only internal app links or root-relative links, never protocol-relative URLs.
  if (/^#\/[a-z0-9._\/-]*$/i.test(value)) return value;
  if (/^\/(?!\/)[a-z0-9._\/-]*$/i.test(value)) return value;
  return safeExternalUrl(value);
}

// 4. SANITIZAÇÃO DE NOMES DE USUÁRIO HIVE
export function cleanUsername(username = "") {
  if (!username) return "user";
  return String(username)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_.-]/g, "")
    .slice(0, 24) || "user";
}

// 5. SANITIZAÇÃO E VALIDAÇÃO DE ID DE CANAL (Suporta IDs com pontos como micro.feed e micro.fair)
export function cleanChannelId(channelId = "") {
  if (!channelId) return "";
  return String(channelId)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_.-]/g, "") // Permite letras, números, hífen, underscore e ponto (.)
    .replace(/^\.+|\.+$/g, "")    // Remove pontos soltos nas pontas
    .slice(0, 36);
}

// 6. SANITIZADOR DOM DE HTML PARA PREVENÇÃO DE XSS AVANÇADO
export function sanitizeSafeHtml(htmlStr = "") {
  if (!htmlStr) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr, "text/html");
    
    // Lista branca de tags permitidas para exibição no feed
    const ALLOWED_TAGS = new Set(["SPAN", "BR", "STRONG", "B", "EM", "I", "CODE", "P", "A"]);
    const ALLOWED_ATTRS = new Set(["class", "data-tag", "data-user", "data-author", "href", "title"]);

    // Varre recursivamente os elementos
    const allElements = doc.body.querySelectorAll("*");
    allElements.forEach((el) => {
      // Se tag não permitida, substitui por texto puro escapado
      if (!ALLOWED_TAGS.has(el.tagName)) {
        const textNode = document.createTextNode(el.textContent);
        el.parentNode ? el.parentNode.replaceChild(textNode, el) : el.remove();
        return;
      }

      // Remove qualquer atributo que comece com 'on' (onclick, onerror, onload, etc.)
      const attrs = Array.from(el.attributes);
      attrs.forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on") || !ALLOWED_ATTRS.has(name)) {
          el.removeAttribute(attr.name);
        } else if (name === "href") {
          const safeHref = sanitizeUrl(attr.value);
          if (!safeHref) {
            el.removeAttribute("href");
          } else {
            el.setAttribute("href", safeHref);
            el.setAttribute("rel", "noopener noreferrer");
          }
        }
      });
    });

    return doc.body.innerHTML;
  } catch (e) {
    // Fallback à prova de falhas: se DOMParser falhar, escapa tudo
    return escapeHtml(htmlStr);
  }
}

// Remoção do bloco de imagem Markdown
export function stripMarkdown(txt = "") {
  let result = (txt || "")
    .replace(/!\[.*?\]\(([^)]+)\)/g, " ") 
    .replace(
      /(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|bmp))(?=\s|$)/gi,
      " " 
    );

  result = result
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1") 
    .replace(/[*_`]/g, ""); 
    
  result = result.replace(/\s\s+/g, ' ');
  return result.trim();
}

// Extração de URLs do Markdown e links de imagens com validação de segurança
export function extractImages(txt = "") {
  const imgs = [];
  let m;

  // Regex 1: Formato Markdown
  const markdownR = /!\[.*?\]\(([^)]+)\)/g; 
  while ((m = markdownR.exec(txt)) !== null) {
    const rawUrl = (m[1] || "").trim();
    const safe = sanitizeUrl(rawUrl);
    if (safe && (safe.startsWith("http://") || safe.startsWith("https://"))) {
      imgs.push(safe);
    }
  }

  // Regex 2: Links de imagem crus com extensões comuns
  const rawUrlR = /(https?:\/\/[^\s<>"')]+?\.(?:png|jpe?g|gif|webp|bmp))(?=\s|$)/gi;
  while ((m = rawUrlR.exec(txt)) !== null) {
    const safe = sanitizeUrl(m[1]);
    if (safe && !imgs.includes(safe)) {
      imgs.push(safe);
    }
  }

  return imgs;
}

const postDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function fmtDate(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Just now";
  return postDateFormatter.format(date);
}

export function extractTagsFromText(text) {
  return Array.from(
    new Set(((text || "").match(/#([a-z0-9_.-]+)/gi) || []).map((t) => cleanChannelId(t.slice(1))))
  ).filter(Boolean);
}

export function extractMentionsFromText(text) {
  return Array.from(
    new Set(((text || "").match(/@([a-z0-9_.-]+)/gi) || []).map((t) => cleanUsername(t.slice(1))))
  ).filter(Boolean);
}

export function linkifyText(text) {
  if (!text) return "";
  
  // Transforma hashtags com segurança (apenas caracteres limpos)
  let linkedText = text.replace(/(^|\s)#([a-z0-9_.-]+)/gi, (match, prefix, tag) => {
    const cleanTag = cleanChannelId(tag);
    if (!cleanTag) return match;
    return `${prefix}<span class="text-red-600 font-medium cursor-pointer tag-link" data-tag="${escapeAttr(cleanTag)}">#${escapeHtml(cleanTag)}</span>`;
  });
  
  // Transforma menções com segurança
  linkedText = linkedText.replace(/(^|\s)@([a-z0-9_.-]+)/gi, (match, prefix, user) => {
    const cleanUser = cleanUsername(user);
    if (!cleanUser) return match;
    return `${prefix}<span class="text-red-600 font-medium cursor-pointer" data-user="${escapeAttr(cleanUser)}">@${escapeHtml(cleanUser)}</span>`;
  });
  
  return sanitizeSafeHtml(linkedText);
}

/**
 * Compact, accessible toast stack. Messages are always inserted as text,
 * never HTML — on-chain/network error strings are not trusted markup.
 * Boolean success/error arguments are retained for existing call sites.
 */
export function showNotification(message, isSuccess = true) {
  const doc = globalThis.document;
  if (!doc?.body) return;
  let container = doc.getElementById("notification-container");
  if (!container) {
    container = doc.createElement("div");
    container.id = "notification-container";
    container.className = "app-toast-stack";
    container.setAttribute("aria-label", "Notifications");
    doc.body.appendChild(container);
  }
  // This previously used Tailwind utility classes, which are not loaded.
  container.className = "app-toast-stack";

  const toast = doc.createElement("div");
  toast.className = `app-toast ${isSuccess ? "app-toast-success" : "app-toast-error"}`;
  toast.setAttribute("role", isSuccess ? "status" : "alert");
  toast.setAttribute("aria-atomic", "true");

  const icon = doc.createElement("span");
  icon.className = "app-toast-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = isSuccess ? "✓" : "!";
  toast.appendChild(icon);

  const body = doc.createElement("span");
  body.className = "app-toast-text";
  const plainText = String(message ?? "").replace(/^(?:✅|❌|⚠️|🔒|🔖|🗑️)\s*/u, "").trim();
  body.textContent = plainText;
  toast.appendChild(body);

  const close = doc.createElement("button");
  close.type = "button";
  close.className = "app-toast-close";
  close.setAttribute("aria-label", "Dismiss notification");
  close.textContent = "\u00d7";
  toast.appendChild(close);
  container.appendChild(toast);

  let dismissalTimer;
  let removed = false;
  function dismiss() {
    if (removed) return;
    removed = true;
    clearTimeout(dismissalTimer);
    toast.classList.add("app-toast-leaving");
    setTimeout(() => toast.remove(), 180);
  }
  close.addEventListener("click", dismiss);
  dismissalTimer = setTimeout(dismiss, isSuccess ? 4500 : 6500);

  // Avoid an unlimited wall of notifications during rapid sync events.
  const items = container.querySelectorAll?.(".app-toast") || [];
  if (items.length > 3) {
    for (const old of Array.from(items).slice(0, items.length - 3)) {
      old.querySelector(".app-toast-close")?.click();
    }
  }
}
