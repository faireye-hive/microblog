//utils.js


// Funções Helpers
export function parseEmbeddedJson(str) {
  if (!str) return null; // Retorna null se não houver string para evitar problemas

  // Se o JSON for um objeto/array, apenas retorna
  if (typeof str !== "string") {
      return str;
  }
  
  try {
    // Tenta fazer o parse
    return JSON.parse(str);
  } catch {
    // Se falhar, retorna um objeto com o conteúdo original
    // Garante que 'content' é uma string vazia se 'str' for problemático, 
    // embora o 'if (!str)' acima já minimize isso.
    return { content: str || "" };
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
    // 1. Substitui imagens Markdown e links crus por um ÚNICO ESPAÇO,
    // garantindo que as palavras não fiquem coladas.
    .replace(/!\[.*?\]\(([^)]+)\)/g, " ") 
    .replace(
      /(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|bmp))(?=\s|$)/gi,
      " " 
    );

  // Remove links de texto e formatação (sem alteração)
  result = result
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1") 
    .replace(/[*_`]/g, ""); 
    
  // 2. Otimização: Reduz qualquer sequência de espaços múltiplos para um único espaço.
  result = result.replace(/\s\s+/g, ' ');

  // 3. Limpa espaços nas extremidades
  return result.trim();
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
  // \b garante que a tag começa num limite de palavra (opcional)
  return Array.from(
    new Set((text.match(/#([a-z0-9_-]+)/gi) || []).map((t) => t.slice(1).toLowerCase()))
  );
}
export function extractMentionsFromText(text) {
  // Regex mais específica para nomes de usuário
  return Array.from(
    new Set((text.match(/@([a-z0-9-._]+)/gi) || []).map((t) => t.slice(1).toLowerCase()))
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

export function showNotification(message, isSuccess = true) {
    // 1. Cria o container (se não existir)
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        // Estilos para o container (posiciona no canto superior direito)
        container.className = 'fixed top-4 right-4 z-[90] flex flex-col gap-2';
        document.body.appendChild(container);
    }
    
    // 2. Cria a notificação
    const notification = document.createElement('div');
    const baseClasses = 'p-3 rounded-lg shadow-lg text-sm transition-opacity duration-300';
    
    if (isSuccess) {
        notification.className = `${baseClasses} bg-green-500 text-white`;
    } else {
        notification.className = `${baseClasses} bg-red-600 text-white`;
    }
    
    notification.textContent = message;
    container.appendChild(notification);
    
    // 3. Oculta após 4 segundos
    setTimeout(() => {
        notification.classList.remove('opacity-100');
        notification.classList.add('opacity-0');
        // Remove do DOM após a transição
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 4000);
}