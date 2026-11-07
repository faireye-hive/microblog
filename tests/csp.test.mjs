import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractCspMeta, cspHttpHeader } from "../js/security/csp-policy.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const notFoundHtml = readFileSync(new URL("../404.html", import.meta.url), "utf8");
const policy = extractCspMeta(html);
const directives = new Map(policy.split(";").map(entry => {
  const parts = entry.trim().split(/\s+/);
  return [parts[0], parts.slice(1)];
}));

test("CSP is enforced early on GitHub Pages (before external resources)", () => {
  assert.ok(html.indexOf('http-equiv="Content-Security-Policy"') > 0);
  assert.ok(html.indexOf('http-equiv="Content-Security-Policy"') < html.indexOf('<link '));
  assert.match(html, /<meta name="referrer" content="no-referrer"/);
  assert.ok(policy.length > 150);
  assert.equal(directives.size, policy.split(";").length);
});

test("scripts cannot be injected inline, evaluated dynamically, or remotely hosted", () => {
  assert.deepEqual(directives.get("script-src"), ["'self'"]);
  assert.deepEqual(directives.get("default-src"), ["'none'"]);
  assert.ok(!policy.includes("'unsafe-eval'"));
  assert.ok(!directives.get("script-src").includes("'unsafe-inline'"));
  assert.ok(!directives.get("script-src").includes("https:"));
  assert.ok(!directives.get("script-src").includes("data:"));
  assert.match(html, /<script type="module" src="\.\/js\/app\.js"><\/script>/);
  assert.match(html, /<script type="module" src="\.\/js\/mobile-nav\.js"><\/script>/);
  assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>/);
});

test("network, images, fonts, and user-facing HTML features keep intended sources", () => {
  assert.deepEqual(directives.get("connect-src"), [
    "'self'", "https://rpc.mahdiyari.info"
  ]);
  assert.deepEqual(directives.get("img-src"), ["'self'", "https:", "data:"]);
  assert.deepEqual(directives.get("font-src"), [
    "'self'", "https://fonts.gstatic.com"
  ]);
  assert.deepEqual(directives.get("style-src"), [
    "'self'", "'unsafe-inline'", "https://fonts.googleapis.com"
  ]);
  assert.deepEqual(directives.get("media-src"), ["'self'", "https:"]);
});

test("dangerous plugin, framing, worker and base loading is forbidden", () => {
  for (const directive of ["base-uri", "object-src", "frame-src", "worker-src"]) {
    assert.deepEqual(directives.get(directive), ["'none'"]);
  }
  assert.deepEqual(directives.get("form-action"), ["'self'"]);
  assert.deepEqual(directives.get("manifest-src"), ["'self'"]);
  // frame-ancestors can be set in HTTP header, not in meta.
  assert.equal(directives.has("frame-ancestors"), false);
  assert.equal(cspHttpHeader(html), policy + "; frame-ancestors 'self'");
});

test("Express header matches GitHub Pages meta and has privacy hardening", () => {
  assert.match(server, /cspHttpHeader\(html\)/);
  assert.match(server, /setHeader\('Content-Security-Policy', pageCspHeader\)/);
  assert.match(server, /setHeader\('Referrer-Policy', 'no-referrer'\)/);
  assert.match(server, /setHeader\('X-Content-Type-Options', 'nosniff'\)/);
  assert.match(server, /setHeader\('Permissions-Policy'/);
  assert.match(server, /app\.disable\('x-powered-by'\)/);
});

test("active HTML templates have no forbidden inline event handlers", () => {
  const paths = [
    "../index.html", "../js/app.js", "../js/render.js",
    "../js/templates.js", "../js/routing.js",
    "../js/state.js", "../js/auth.js"
  ];
  for (const path of paths) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\son(?:click|load|error|focus|mouseover)=["']/i, path);
  }
});

test("404 fallback carries the same CSP and no longer loads legacy remote scripts", () => {
  assert.equal(extractCspMeta(notFoundHtml), policy);
  assert.match(notFoundHtml, /<meta name="referrer" content="no-referrer"/);
  assert.doesNotMatch(notFoundHtml, /<script\b/i);
  assert.doesNotMatch(notFoundHtml, /cdn\.tailwindcss\.com/i);
  assert.match(notFoundHtml, /https:\/\/faireye-hive\.github\.io\/microblog\//);
});

test("missing CSP meta fails closed on server startup", () => {
  assert.throws(() => extractCspMeta("missing"), /Missing Content-Security-Policy/);
  assert.throws(() => extractCspMeta(null), /CSP HTML source missing/);
});
