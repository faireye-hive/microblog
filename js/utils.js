

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
export function stripMarkdown(txt = "") {
  return txt
    .replace(/!\[\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}
export function extractImages(txt = "") {
  const r = /!\[\]\((.*?)\)/g;
  const imgs = [];
  let m;
  while ((m = r.exec(txt)) !== null) imgs.push(m[1]);
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