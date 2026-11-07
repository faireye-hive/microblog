/** Returns an image URL routed through the optional public proxy.
 *
 * With no proxy deployment configured GitHub Pages continues loading the
 * original URL. The local Express server (localhost:3000) opts in automatically.
 */
import { IMAGE_PROXY_ORIGIN } from "../config.js";
import { safeExternalUrl } from "./safe-values.js";

export function imageProxyEndpoint({
  origin = IMAGE_PROXY_ORIGIN,
  location = globalThis.location,
} = {}) {
  if (origin) {
    const parsed = safeExternalUrl(origin);
    if (!parsed || !parsed.startsWith("https://")) return "";
    const url = new URL(parsed);
    // Explicit origin only; the path is fixed to prevent redirecting image
    // requests to an unrelated endpoint in the configured service.
    return `${url.origin}/api/image`;
  }
  if (location && ["localhost", "127.0.0.1"].includes(location.hostname) &&
      String(location.port) === "3000") {
    return `${location.origin}/api/image`;
  }
  return "";
}

export function proxiedImageUrl(source, options = {}) {
  const safe = safeExternalUrl(source);
  if (!safe) return "";
  const endpoint = imageProxyEndpoint(options);
  if (!endpoint) return safe;
  return `${endpoint}?url=${encodeURIComponent(safe)}`;
}
