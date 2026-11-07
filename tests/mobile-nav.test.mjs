import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getActiveMobileSection } from "../js/mobile-nav.js";

test("mobile tab corresponds to the app's hash routes", () => {
  const cases = new Map([
    ["#/", "home"],
    ["#/thread/123", "home"],
    ["#/tag/hive", "home"],
    ["#/followed", "home"],
    ["#/trending", "explore"],
    ["#/explore", "explore"],
    ["#/channels", "channels"],
    ["#/channel/news", "channels"],
    ["#/bookmarks", "bookmarks"],
    ["#/profile", "profile"],
    ["#/profile/@alice", "profile"],
  ]);
  for (const [route, expected] of cases) {
    assert.equal(getActiveMobileSection(route), expected, route);
  }
});

test("mobile navigation exposes the five destinations", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const name of ["home", "explore", "channels", "bookmarks", "profile"]) {
    assert.match(html, new RegExp('data-mobile-section="' + name + '"'));
  }
  assert.match(html, /aria-label="Navegação principal para celular"/);
  assert.match(html, /href="#mainArea"/);
  assert.match(html, /css\/modern\.css/);
});

test("responsive stylesheet includes mobile navigation and reduced motion", () => {
  const css = readFileSync(new URL("../css/modern.css", import.meta.url), "utf8");
  assert.match(css, /\.mobile-bottom-nav/);
  assert.match(css, /max-width: 640px/);
  assert.match(css, /prefers-reduced-motion/);
});
