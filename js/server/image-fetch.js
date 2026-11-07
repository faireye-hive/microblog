/**
 * Server-side image fetcher. Defense in depth against SSRF and oversized media:
 * HTTPS/443 only, DNS and literal-IP validation, pinned DNS lookup on the
 * outbound TLS connection, no redirects, no cookies and no SVG.
 */
import { lookup as defaultLookup } from "node:dns/promises";
import { request as defaultRequest } from "node:https";
import { BlockList, isIP } from "node:net";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const UPSTREAM_TIMEOUT_MS = 8000;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);

// These are not routable public Internet addresses. IPv4-mapped IPv6
// addresses are also checked by Node's BlockList implementation.
const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
]) blocked.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96],
  ["100::", 64], ["2001::", 32], ["2001:db8::", 32],
  ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
]) blocked.addSubnet(network, prefix, "ipv6");

export function isPublicIp(address) {
  const family = isIP(address);
  return family !== 0 && !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

export function validateImageSource(value) {
  if (typeof value !== "string" || !value || value.length > 2048) {
    throw Object.assign(new Error("Invalid image URL"), { status: 400 });
  }
  let url;
  try { url = new URL(value); }
  catch { throw Object.assign(new Error("Invalid image URL"), { status: 400 }); }
  // Reject authentication, non-standard ports, malformed IPv6, and fragments.
  if (url.protocol !== "https:" || (url.port && url.port !== "443") ||
      url.username || url.password || !url.hostname) {
    throw Object.assign(new Error("Only public HTTPS images on port 443 are supported"), { status: 400 });
  }
  if (url.hash) url.hash = "";
  return url;
}

export async function resolvePublicImageHost(hostname, resolver = defaultLookup) {
  const literal = hostname.replace(/^\[|\]$/g, "");
  if (isIP(literal)) {
    if (!isPublicIp(literal)) throw Object.assign(new Error("Private IP blocked"), { status: 403 });
    return { address: literal, family: isIP(literal) };
  }
  // dns.lookup uses the OS resolver (hosts file included). Verify ALL
  // responses to prevent a mixed public+private DNS answer being selected.
  let answers;
  try { answers = await resolver(hostname, { all: true, verbatim: true }); }
  catch { throw Object.assign(new Error("Image host did not resolve"), { status: 502 }); }
  if (!Array.isArray(answers) || !answers.length ||
      answers.some(entry => !isPublicIp(entry?.address))) {
    throw Object.assign(new Error("Image host resolves to a disallowed address"), { status: 403 });
  }
  return { address: answers[0].address, family: answers[0].family || isIP(answers[0].address) };
}

function hasImageSignature(buffer, type) {
  if (type === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === "image/gif") return buffer.length >= 6 && ["GIF87a","GIF89a"].includes(buffer.toString("ascii",0,6));
  if (type === "image/webp") return buffer.length >= 12 && buffer.toString("ascii",0,4)==="RIFF" && buffer.toString("ascii",8,12)==="WEBP";
  if (type === "image/avif") return buffer.length >= 16 && buffer.toString("ascii",4,8)==="ftyp" && ["avif","avis"].includes(buffer.toString("ascii",8,12));
  return false;
}

export async function fetchProxiedImage(source, {
  resolve = resolvePublicImageHost,
  request = defaultRequest,
  timeoutMs = UPSTREAM_TIMEOUT_MS,
  maxBytes = MAX_IMAGE_BYTES,
} = {}) {
  const url = validateImageSource(source);
  const pinned = await resolve(url.hostname);

  return new Promise((resolvePromise, reject) => {
    let settled = false;
    const fail = error => { if (!settled) { settled = true; reject(error); } };
    const req = request(url, {
      agent: false,
      timeout: timeoutMs,
      // Validate DNS before opening TLS and pin the checked address. Never
      // silently re-resolve to an internal IP in the outbound connection.
      lookup: (name, options, callback) => callback(null, pinned.address, pinned.family),
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
        "user-agent": "MicroFairImageProxy/1.0",
      },
    }, response => {
      const status = response.statusCode ?? 502;
      // No redirects: following Location without full revalidation is SSRF-prone.
      if (status !== 200) {
        response.resume();
        return fail(Object.assign(new Error("Image origin returned unexpected status"), { status: 502 }));
      }
      const type = String(response.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (!ALLOWED_MIME.has(type)) {
        response.resume();
        return fail(Object.assign(new Error("Unsupported image type"), { status: 415 }));
      }
      const declared = Number(response.headers["content-length"]);
      if (Number.isFinite(declared) && declared > maxBytes) {
        response.destroy();
        return fail(Object.assign(new Error("Image too large"), { status: 413 }));
      }
      const chunks = [];
      let total = 0;
      response.on("data", chunk => {
        total += chunk.length;
        if (total > maxBytes) {
          response.destroy();
          return fail(Object.assign(new Error("Image too large"), { status: 413 }));
        }
        chunks.push(chunk);
      });
      response.on("error", fail);
      response.on("end", () => {
        if (settled) return;
        const bytes = Buffer.concat(chunks, total);
        if (!hasImageSignature(bytes, type)) {
          return fail(Object.assign(new Error("Image signature mismatch"), { status: 415 }));
        }
        settled = true;
        resolvePromise({ bytes, contentType: type });
      });
    });
    req.on("error", error => fail(Object.assign(new Error("Image origin unreachable"), { status: 502, cause: error })));
    req.setTimeout?.(timeoutMs, () => {
      req.destroy();
      fail(Object.assign(new Error("Image origin timed out"), { status: 504 }));
    });
    req.end();
  });
}
