# Micro.fair Hive Custom JSON Protocol — v1

This document describes **existing on-chain messages** as implemented in Micro.fair. It is not a proposal to rename the protocol. The live, searchable version is available in the app at **[`#/protocol`](../index.html#/protocol)** (More → Protocol Reference).

## Where the truth lives

| Layer | Source | Purpose |
| --- | --- | --- |
| Registry | `js/hive/registry.js` | Canonical IDs, operation names, namespace resolution and field definitions |
| Payload builders | `js/hive/protocol.js` | Construct the serialized v1 JSON objects (pure functions) |
| Executable examples | `js/hive/examples.js` | Generate documentation samples using the **same production builders** |
| Config compatibility | `js/config.js` | Re-exports historical constants and HAFSQL read URLs |
| Keychain transport | `js/hive/keychain.js` | Signed `custom_json` operations, **Posting** authority |
| On-chain writes | `js/api.js` | Select operation IDs via `resolveCustomJsonId()` |
| On-chain reads | `js/api.js`, `js/data/sync.js` | HAFSQL queries and cache handling |
| Reference UI | `js/ui/protocol-reference.js` | Read-only documentation, search and copy support |

**Do not change any historical IDs without a designed migration with dual read compatibility.** In particular, `micro.fair.interation` and `micro.fair.adpmuted` have their original spelling.

## ID inventory

| What | Exact `custom_json.id` | JSON `type` | Notes |
| --- | --- | --- | --- |
| Main post | `micro.fair` | `post` | A top-level post |
| Main reply | `micro.fair` | `reply` | Same ID as its parent post |
| Community post | `{channel}`, e.g. `hive.micro` | `post` | Posts go directly to the community ID, **not** `micro.fair.{channel}` |
| Community reply | `{channel}` | `reply` | Same namespace as the parent |
| Upvote | `micro.fair.interation` | `upvote` | Historical spelling |
| Downvote | `micro.fair.interation` | `downvote` | Latest vote per account/content ID is used |
| Admin mute | `micro.fair.adpmuted` | `mute` | Only the configured administrator's signature is accepted |
| Admin unmute | `micro.fair.adpmuted` | `unmute` | Reverses mute |
| Follow | `micro.fair.{user}.follow` | `follow` | `{user}` is the **signer**, not the target |
| Unfollow | `micro.fair.{user}.follow` | `unfollow` | Reverses follow |
| Block | `micro.fair.{user}.block` | `block` | `{user}` is the signer |
| Unblock | `micro.fair.{user}.block` | `unblock` | Reverses block |
| Create community | `micro.fair.channels` | `create_channel` | Registry metadata, not community post content |

There are **7 namespace families** (main posts, community posts, votes, moderation, follow, block, community registry) and **13 action variants**. These are the operations currently sent by the app; they are not a complete catalog of all operations possible on Hive.

## What the transaction looks like

A Hive operation contains `required_posting_auths` (the signing account), the outer `id`, and a `json` **string** containing the serialized payload. The outer ID and the inner `app` are different concepts.

Example main post sent from `@alice`:

```json
{
  "required_auths": [],
  "required_posting_auths": ["alice"],
  "id": "micro.fair",
  "json": "{\"app\":\"micro.fair\",\"v\":1,\"type\":\"post\",\"channel\":\"micro.fair\",\"content\":\"Hello Hive!\",\"reply_to\":null,\"mentions\":[],\"tags\":[]}"
}
```

The **inner payload** before `JSON.stringify`:

```json
{
  "app": "micro.fair",
  "v": 1,
  "type": "post",
  "channel": "micro.fair",
  "content": "Hello Hive!",
  "reply_to": null,
  "mentions": [],
  "tags": []
}
```

A **reply** has `type: "reply"`, `reply_to: <parent HAFSQL operation id>` and the same outer ID as its parent (or the community's ID). `content_id` in votes and moderation also refers to a custom_json operation ID assigned to the post by HAFSQL. It is **not** a Hive blog `author/permlink` string.

A vote payload example (outer ID `micro.fair.interation`):

```json
{"app":"micro.fair","v":1,"type":"upvote","content_id":12345}
```

The number `12345` is **illustrative only**, not a real Hive post.

A follow example (outer ID `micro.fair.alice.follow`):

```json
{"app":"micro.fair","v":1,"type":"follow","target_user":"bob"}
```

A moderator mute example (outer ID `micro.fair.adpmuted`):

```json
{"app":"micro.fair","v":1,"type":"mute","cause":"Spam","content_id":12345}
```

Community creation (outer ID `micro.fair.channels`):

```json
{
  "app": "micro.fair",
  "v": 1,
  "type": "create_channel",
  "action": "create_channel",
  "id": "hive.micro",
  "name": "Hive Micro",
  "description": "A community about Hive",
  "created_at": "2026-11-07T12:00:00.000Z"
}
```

The `action` field in channel creation is historical and intentionally duplicated with `type`.

## Important invariants

1. **Signer verification matters.** `custom_json.id` by itself does not prove authorization. Moderation reads require the signed administrator account. Follow/block reads are scoped to the relevant signer.
2. **IDs are not interchangeable.** `hive.micro` and `hivemicro` are different namespaces. The channel ID validation currently allows up to 32 characters and preserves dots, hyphens and underscores.
3. **The internal payload version stays `v:1`.** A future version must introduce a documented compatibility strategy. Changing `v` alone does not migrate old HAFSQL operations.
4. **Account-scoped namespaces are historical templates.** The resulting ID length can vary by account name; do not silently truncate or hash usernames, since doing so changes where data is stored. Any network-length limitation must be addressed with explicit compatibility planning.
5. **UI limits are not blockchain protocol limits.** The current composer limits post content to 2,048 characters. That client-side rule does not imply every Hive `custom_json` must follow that limit.
6. **Custom JSON modal is an advanced, general-purpose tool.** Arbitrary IDs and payloads submitted there are not automatically recognized as Micro.fair operations.
7. **Only approved payloads should be broadcast.** Application writes use constructors in `js/hive/protocol.js` and resolve IDs using `js/hive/registry.js`.

## HAFSQL read URLs

Reads currently use:

```text
https://rpc.mahdiyari.info/hafsql/operations/custom_json/<id>?limit=1000
```

- Main posts: `.../micro.fair?limit=1000`
- Votes: `.../micro.fair.interation?limit=1000`
- Admin moderation: `.../micro.fair.adpmuted?limit=1000`
- Community registry: `.../micro.fair.channels?limit=1000`
- Follow or block: replace `{user}` with the logged-in account.
- Community posts: substitute the exact community namespace.

HAFSQL pagination and caching remain in `js/data/hafsql.js` and `js/data/sync.js`.

## Changing the protocol safely

Before changing a field name or an operation ID: update the registry, builder, examples, UI reference and tests together. If the change affects historical chain data, add dual-read support or a versioned migration before any new broadcasts. Run `npm test` and review `tests/hive-protocol-registry.test.mjs` plus the existing architecture and channel ID tests.
