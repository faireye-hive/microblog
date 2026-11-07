# HiveLine v2 — Canonical Hive Custom JSON protocol

**Status:** active test protocol. **App identity:** `hiveline`. **Payload version:** `2`.

HiveLine is a fresh-start successor to the Micro.fair v1 prototype. All v1
operations remain permanently on the Hive blockchain, but the HiveLine app
**does not import, render or vote on old Micro.fair posts**. There is no deletion
or on-chain rewrite. New namespace IDs and separate browser caches ensure the
initial HiveLine feed and community directory start empty until v2 test records
are created.

## Actual v2 outer IDs

| Operation | Hive `custom_json.id` | JSON `type` |
| --- | --- | --- |
| Main post | `hiveline.posts` | `post` |
| Main reply | `hiveline.posts` | `reply` |
| Community post | `hiveline.c.{channel}` | `post` |
| Community reply | `hiveline.c.{channel}` | `reply` |
| Positive/negative vote | `hiveline.votes` | `upvote` / `downvote` |
| Admin mute/unmute | `hiveline.moderation` | `mute` / `unmute` |
| Follow/unfollow | `hiveline.relationships` | `follow` / `unfollow` |
| Block/unblock | `hiveline.relationships` | `block` / `unblock` |
| Register a community | `hiveline.communities` | `create_channel` |

The **inner** `app: "hiveline"` is not the outer operation ID. A reply uses
the same outer ID as the parent and has `reply_to` set to its positive numeric
HAFSQL operation ID. A new top-level post has `reply_to: null`.

Communities are namespaced under `hiveline.c.`. Their slug is limited to
**21 characters** so that the complete `custom_json.id` fits 32 characters.
For example, `dev` becomes `hiveline.c.dev`; a v1 custom ID `dev`
continues to exist independently on-chain but is never queried by HiveLine.

The same `hiveline.relationships` namespace contains both follow and
block operations. To calculate a user's current state, inspect the actual
`required_posting_auths` signer, type and `target_user`; never use the ID
string as proof of who performed an action.

## Real payload examples

### Publish to main feed — ID `hiveline.posts`

```json
{
  "app": "hiveline",
  "v": 2,
  "type": "post",
  "channel": "hiveline.posts",
  "content": "Hello HiveLine! #hive",
  "reply_to": null,
  "mentions": [],
  "tags": ["hive"]
}
```

### Reply in a community — ID `hiveline.c.dev`

```json
{
  "app": "hiveline",
  "v": 2,
  "type": "reply",
  "channel": "hiveline.c.dev",
  "content": "Thanks for sharing!",
  "reply_to": 12345,
  "mentions": [],
  "tags": ["dev"]
}
```

### Vote — ID `hiveline.votes`

```json
{"app":"hiveline","v":2,"type":"upvote","content_id":12345}
```

### Follow — ID `hiveline.relationships`

```json
{"app":"hiveline","v":2,"type":"follow","target_user":"bob"}
```

### Mute — ID `hiveline.moderation`

```json
{"app":"hiveline","v":2,"type":"mute","cause":"Spam","content_id":12345}
```

Only operations signed by the configured administrator are accepted for
moderation. `12345` is an illustrative HAFSQL ID, **not a real record**.
The on-chain `json` property is a **serialized JSON string**, not an
embedded object.

### Register a community — ID `hiveline.communities`

```json
{
  "app": "hiveline",
  "v": 2,
  "type": "create_channel",
  "action": "create_channel",
  "id": "dev",
  "name": "Developers",
  "description": "Build in public",
  "created_at": "2026-11-07T12:00:00.000Z"
}
```

## Blank-slate behavior and cache isolation

HiveLine loads main posts **only** from `hiveline.posts`, community posts
**only** from `hiveline.c.<slug>`, votes only from `hiveline.votes`,
moderation only from `hiveline.moderation`, communities only from
`hiveline.communities` and relationships only from
`hiveline.relationships`.

Every accepted post also needs a JSON object with `app: "hiveline"`,
`v: 2`, a `post` or `reply` type, and a `channel` matching the outer ID.
This guard is applied to network replies **and caches**.

Browser storage is segregated via `hiveline-v2-posts` IndexedDB,
`hivelineV2...` localStorage cache keys,
`hiveline_bookmarks_v2` and `hiveline_joined_channels_v2`.
Legacy cache values are not imported or deleted. Previously saved test posts,
votes, blocks, follows, joined communities and bookmarks are not visible.

## Historical v1 (reference only — **not read** by HiveLine)

| v1 category | Legacy ID |
| --- | --- |
| Main posts and replies | `micro.fair` |
| Votes | `micro.fair.interation` |
| Admin moderation | `micro.fair.adpmuted` |
| Community registry | `micro.fair.channels` |
| Following | `micro.fair.{user}.follow` |
| Blocking | `micro.fair.{user}.block` |
| Community posts | original bare channel IDs, e.g. `dev` |

**This is isolation, not deletion.** Old records continue to exist in Hive
and can be examined by historical APIs or a future explicit archive viewer.

## Where the implementation lives

| Module | Responsibility |
| --- | --- |
| `js/hive/registry.js` | Canonical v2 IDs, version, channel slug rules and action mapping |
| `js/hive/protocol.js` | Pure v2 JSON payload builders |
| `js/hive/content-scope.js` | Reject old posts and malformed v2 post envelopes |
| `js/hive/examples.js` | Generate working examples from production builders |
| `js/hive/validator.js` | Check v2 payload shape and block accidental legacy broadcasts |
| `js/api.js` | HAFSQL v2 queries, Keychain v2 writes, signer/action-aware relationships |
| `js/data/post-cache.js` | New isolated IndexedDB database |
| `js/data/cache-keys.js` | New isolated localStorage cache IDs |
| `js/ui/protocol-reference.js` | Interactive `#/protocol` reference |
| `tests/hiveline-v2.test.mjs` | Fresh-start regression coverage |

Use `#/protocol` from **More → Protocol Reference** to view real payloads
and validate them before signing. The validation UI is local and does not
prove on-chain acceptance.

## Deployment scope

The existing GitHub repo `faireye-hive/microblog` stays at its current
path to avoid breaking GitHub Pages URLs. Only the **product branding and
on-chain protocol identity** change in this rollout. Renaming the GitHub
repository or registering a commercial mark/domain are separate decisions.
