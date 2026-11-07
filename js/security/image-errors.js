// Image fallback behavior is registered in JavaScript, never in HTML event
// attributes. Capturing error events also covers dynamically rendered posts.
const FALLBACK_SVGS = {
  user: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#cbd5e1"/><text x="24" y="32" font-size="22" text-anchor="middle">👤</text></svg>`,
  hive: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#ffd600"/><text x="24" y="32" font-size="24" text-anchor="middle">🐝</text></svg>`
};

export function imageFallbackUrl(kind) {
  const svg = FALLBACK_SVGS[kind];
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : "";
}

export function installImageErrorHandling(doc = globalThis.document) {
  doc.addEventListener("error", event => {
    const img = event.target;
    if (img?.tagName !== "IMG") return;
    if (img.dataset.hideOnError === "true") {
      img.style.display = "none";
      img.removeAttribute("data-hide-on-error");
      return;
    }
    const kind = img.dataset.avatarFallback;
    const fallback = imageFallbackUrl(kind);
    if (fallback) {
      img.removeAttribute("data-avatar-fallback"); // Avoid recursive errors.
      img.src = fallback;
    }
  }, true);
}
