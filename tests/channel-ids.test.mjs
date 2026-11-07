import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseChannelCustomId } from "../js/helpers/channel-id.js";
import { processChannelsData } from "../js/helpers/channels.js";

test("on-chain IDs keep their dots (no slug collisions)", () => {
  assert.equal(parseChannelCustomId("hive.micro"), "hive.micro");
  assert.equal(parseChannelCustomId("hivemicro"), "hivemicro");
  assert.equal(parseChannelCustomId(" Micro.Fair "), "micro.fair");
  assert.equal(parseChannelCustomId("linux-dev_1"), "linux-dev_1");
  assert.notEqual(parseChannelCustomId("hive.micro"), parseChannelCustomId("hivemicro"));
});

test("reject invalid IDs instead of silently changing the namespace", () => {
  for (const invalid of [
    "",
    " ",
    "hive micro",
    "hive/micro",
    "a?b",
    "<script>",
    "a".repeat(33),
    null,
    42,
  ]) assert.equal(parseChannelCustomId(invalid), "", String(invalid));
  assert.equal(parseChannelCustomId("a".repeat(32)), "a".repeat(32));
});

test("channel registry preserves distinct hive.micro and hivemicro IDs", () => {
  const operations = [
    {
      timestamp: "2026-10-01T00:00:00",
      required_posting_auths: ["user1"],
      custom_id:"hiveline.communities",
      json: JSON.stringify({ app:"hiveline",v:2,id: "hive.micro", name: "Hive Micro Original" }),
    },
    {
      timestamp: "2026-10-02T00:00:00",
      required_posting_auths: ["user2"],
      custom_id:"hiveline.communities",
      json: JSON.stringify({ app:"hiveline",v:2,id: "hivemicro", name: "Different channel" }),
    },
    {
      timestamp: "2026-10-03T00:00:00",
      required_posting_auths: ["user1"],
      json: JSON.stringify({ app:"hiveline",v:2,channel_id: "hive.micro", name: "Hive Micro Updated" }),
    },
    {
      timestamp: "2026-10-04T00:00:00",
      json: JSON.stringify({ app:"hiveline",v:2,id: "hive/micro", name: "Invalid namespace" }),
    },
  ];
  const initialOrder = [...operations];
  const result = processChannelsData(operations);

  assert.deepEqual(result.map(c => c.id).sort(), ["hive.micro", "hivemicro"]);
  assert.equal(result.find(c => c.id === "hive.micro").name, "Hive Micro Updated");
  assert.equal(result.find(c => c.id === "hivemicro").name, "Different channel");
  assert.deepEqual(operations, initialOrder, "should not mutate API data");
});

test("channel API and routing reuse the canonical identifier helper", () => {
  const api = readFileSync(new URL("../js/api.js", import.meta.url), "utf8");
  const transport = readFileSync(new URL("../js/data/hafsql.js", import.meta.url), "utf8");
  const routes = readFileSync(new URL("../js/routing.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../js/templates.js", import.meta.url), "utf8");

  assert.match(api, /normalizeHiveLineChannel\(channelId\)/);
  assert.match(api, /resolveCustomJsonId\(replyTo \? "reply" : "post"/);
  assert.match(api, /buildHafsqlCustomJsonUrl\(channelCustomId/);
  assert.match(transport, /encodeURIComponent\(id\)/);
  assert.match(routes, /normalizeHiveLineChannel\(channelId\)/);
  assert.match(routes, /\[a-z0-9\._-\]\+/);
  // A channel ID is user-defined; the UI must not depend on one example name.
  assert.match(html, /id="newChannelId"/);
  assert.match(html, /maxlength="21"/);
});
