import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { cspHttpHeader } from "../js/security/csp-policy.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

async function findPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function fetchWhenReady(url, child) {
  let lastError;
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) {
      throw new Error(`Express exited before startup (${child.exitCode}): ${lastError}`);
    }
    try {
      return await fetch(url);
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 75));
    }
  }
  throw lastError || new Error("Express startup failed");
}

test("Express emits enforced CSP and privacy headers for real HTTP pages", async () => {
  const port = await findPort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
    stdio: "ignore",
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    const main = await fetchWhenReady(base + "/", child);
    assert.equal(main.status, 200);
    assert.equal(main.headers.get("content-security-policy"), cspHttpHeader(html));
    assert.equal(main.headers.get("referrer-policy"), "no-referrer");
    assert.equal(main.headers.get("x-content-type-options"), "nosniff");
    assert.match(main.headers.get("permissions-policy") || "", /geolocation=\(\)/);
    assert.equal(main.headers.get("x-powered-by"), null);

    const deep = await fetch(base + "/thread/123");
    assert.equal(deep.status, 200);
    assert.equal(deep.headers.get("content-security-policy"), cspHttpHeader(html));

    const missing = await fetch(base + "/404.html");
    assert.equal(missing.status, 200);
    assert.equal(missing.headers.get("content-security-policy"), cspHttpHeader(html));
    assert.doesNotMatch(await missing.text(), /cdn\.tailwindcss\.com/);

    const js = await fetch(base + "/js/app.js");
    assert.equal(js.status, 200);
    assert.equal(js.headers.get("x-content-type-options"), "nosniff");
    assert.match(js.headers.get("content-type") || "", /javascript/);
  } finally {
    child.kill("SIGTERM");
  }
});
