/**
 * Express handler for image requests. Public endpoint; never forwards browser
 * cookies, credentials or origin response headers. Bounded parallelism and an
 * in-memory LRU cache reduce pressure on third-party origins.
 */
import { fetchProxiedImage, validateImageSource } from "./image-fetch.js";

export function createImageProxyHandler({
  fetchImage = fetchProxiedImage,
  clock = () => Date.now(),
  maxConcurrent = 8,
  cacheSizeBytes = 24 * 1024 * 1024,
  maxCacheEntries = 128,
  ttlMs = 60 * 60 * 1000,
} = {}) {
  const cached = new Map();
  let cachedBytes = 0;
  let inFlight = 0;

  function forget(key) {
    const row = cached.get(key);
    if (!row) return;
    cached.delete(key);
    cachedBytes -= row.bytes.length;
  }

  return async function imageProxyHandler(req, res) {
    let url;
    try {
      if (typeof req.query.url !== "string") {
        return res.status(400).send("Missing image URL");
      }
      url = validateImageSource(req.query.url).href;
    } catch (error) {
      return res.status(error.status || 400).send("Invalid image URL");
    }

    let result = cached.get(url);
    if (result?.expires <= clock()) {
      forget(url);
      result = null;
    }
    if (result) {
      // LRU: recently accessed entries move to the end.
      cached.delete(url);
      cached.set(url, result);
    } else {
      if (inFlight >= maxConcurrent) {
        return res.status(503).set("Retry-After", "2").send("Image proxy busy");
      }
      inFlight++;
      try {
        const { bytes, contentType } = await fetchImage(url);
        result = { bytes, contentType, expires: clock() + ttlMs };
        if (bytes.length <= cacheSizeBytes) {
          cached.set(url, result);
          cachedBytes += bytes.length;
          while (cached.size > maxCacheEntries || cachedBytes > cacheSizeBytes) {
            forget(cached.keys().next().value);
          }
        }
      } catch (error) {
        return res.status([400,403,413,415,502,504].includes(error?.status) ? error.status : 502)
          .send("Image unavailable");
      } finally {
        inFlight--;
      }
    }
    res.set("Content-Type", result.contentType);
    res.set("Cache-Control", "public, max-age=3600");
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.set("X-Content-Type-Options", "nosniff");
    return res.status(200).send(result.bytes);
  };
}
