// A URL agora usa a constante importada


// Funções Helpers
export function parseEmbeddedJson(str) {
  if (!str) return null;
  try {
    return typeof str === "string" ? JSON.parse(str) : str;
  } catch {
    return { content: str };
  }
}

export function escapeHtml(str = "") {
  return str.replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m])
  );
}

// CORRIGIDA: Remoção do bloco de imagem Markdown
export function stripMarkdown(txt = "") {
  let result = txt
    // Remove Markdown de imagem: ![alt text](<URL>) -> Usa [^)]+ para capturar a URL até o fim
    .replace(/!\[.*?\]\(([^)]+)\)/g, "") 
    // Remove links de imagem crus (URL que termina com extensão)
    .replace(
      /(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|bmp))(?=\s|$)/gi,
      "" 
    );

  return result
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1") // Remove links de texto: [texto](url) -> texto
    .replace(/[*_`]/g, "") // Remove formatação (bold, italic, code)
    .trim();
}

// CORRIGIDA: Extração de URLs do Markdown e links crus
export function extractImages(txt = "") {
  const imgs = [];
  let m;

  // Regex 1: Captura o formato Markdown, capturando TUDO dentro dos parenteses
  // [^)]+ garante a URL completa, independentemente de http(s)
  const markdownR = /!\[.*?\]\(([^)]+)\)/g; 
  while ((m = markdownR.exec(txt)) !== null) {
      // Adiciona apenas se o link extraído do Markdown começar com http(s)
      if (m[1].startsWith('http')) {
          imgs.push(m[1]);
      }
  }

  // Regex 2: Captura links de imagem crus
  const rawUrlR = /(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|bmp))(?=\s|$)/gi;
  
  const rawMatches = [];
  while ((m = rawUrlR.exec(txt)) !== null) {
      rawMatches.push(m[1]);
  }
  
  // Combina todos os resultados, garantindo que não haja duplicatas
  rawMatches.forEach(url => {
      if (!imgs.includes(url)) {
          imgs.push(url);
      }
  });
  return imgs;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(
    d.getMonth() + 1
  )}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function extractTagsFromText(text) {
  return Array.from(
    new Set((text.match(/#(\w+)/g) || []).map((t) => t.slice(1).toLowerCase()))
  );
}
export function extractMentionsFromText(text) {
  return Array.from(
    new Set((text.match(/@(\w+)/g) || []).map((t) => t.slice(1).toLowerCase()))
  );
}

export function linkifyText(text) {
    if (!text) return "";
    
    // 1. Linkify Hashtags
    // Regex: /(^|\s)#[a-z0-9]+/gi
    // Transforma #tag em <a href="/hashtag/tag" class="tag-link" data-tag="tag">#tag</a>
    let linkedText = text.replace(/(^|\s)#[a-z0-9]+/gi, (match) => {
        const tag = match.trim().substring(1); // Remove '#' e espaços
        return `${match.startsWith(' ') ? ' ' : ''}<span class="text-red-600 font-medium cursor-pointer tag-link" data-tag="${tag}">#${tag}</span>`;
    });
    
    // 2. Linkify Mentions (Opcional, mas útil)
    // Regex: /(^|\s)@[a-z0-9]+/gi
    // Transforma @user em <a href="/user/user">@user</a> (apenas texto por enquanto, sem função de clique)
    linkedText = linkedText.replace(/(^|\s)@[a-z0-9]+/gi, (match) => {
        const user = match.trim().substring(1); 
        return `${match.startsWith(' ') ? ' ' : ''}<span class="text-red-600 font-medium cursor-pointer" data-user="${user}">@${user}</span>`;
    });
    
    return linkedText;
}