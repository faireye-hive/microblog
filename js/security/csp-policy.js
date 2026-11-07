/**
 * Keep static GitHub Pages CSP and Express HTTP CSP in sync.
 * No DOM or network side effects; safe to import from Node tests.
 */
export function extractCspMeta(html) {
  if (typeof html !== "string") throw new Error("CSP HTML source missing");
  const match = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
  if (!match) throw new Error("Missing Content-Security-Policy in index.html");
  return match[1];
}

export function cspHttpHeader(html) {
  // frame-ancestors only takes effect in an HTTP header, not in a meta tag.
  return `${extractCspMeta(html)}; frame-ancestors 'self'`;
}
