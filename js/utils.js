//utils.js


// utils.js - Helpers & Strong XSS Protection Engine

// Funções Helpers de Parse seguro
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
export function sanitizeUrl(url = "") {
  if (!url || typeof url !== "string") return "";
  
  // Remove espaços, caracteres nulos e de controle
  const trimmed = url.trim().replace(/[\u0000-\u001F\u007F-\u009F\s]/g, "");
  
  // Permite âncoras relativas do app (ex: #/channel/...)
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) {
    return escapeAttr(trimmed);
  }

  // Decodifica tentativas de ofuscação (ex: jav&#x61;script:)
  try {
    const decoded = decodeURIComponent(trimmed).toLowerCase();
    if (
      decoded.includes("javascript:") ||
      decoded.includes("data:") ||
      decoded.includes("vbscript:") ||
      decoded.includes("file:") ||
      decoded.includes("blob:")
    ) {
      return "";
    }
  } catch (e) {
    // Se URI malformada, pode ser tentativa de bypass
    if (/(?:javascript|data|vbscript|file|blob)\s*:/i.test(trimmed)) {
      return "";
    }
  }

  // Validação estrita via parser de URL
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return escapeAttr(trimmed);
    }
    return "";
  } catch {
    return "";
  }
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

export function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "agora";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(
    d.getMonth() + 1
  )}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

export function showNotification(message, isSuccess = true) {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'fixed top-4 right-4 z-[90] flex flex-col gap-2';
    document.body.appendChild(container);
  }
  
  const notification = document.createElement('div');
  const baseClasses = 'p-3 rounded-lg shadow-lg text-sm transition-opacity duration-300';
  
  if (isSuccess) {
    notification.className = `${baseClasses} bg-green-500 text-white`;
  } else {
    notification.className = `${baseClasses} bg-red-600 text-white`;
  }
  
  notification.textContent = String(message || "");
  container.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.remove('opacity-100');
    notification.classList.add('opacity-0');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 4000);
}