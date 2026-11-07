# HiveLine v2 — Fresh Start and Legacy Isolation

**Status: ACTIVE (v2) for new tests.** Product display name: **HiveLine**.
On-chain payload app: `hiveline`; version: `2`. The repo still lives at
`faireye-hive/microblog` so existing GitHub Pages URLs remain functional.

## Why no previous posts appear

This is a **fresh start**, not a blockchain data deletion. The new client
only queries `hiveline.posts` and newly registered community namespaces
`hiveline.c.<slug>`, with an additional validation gate requiring
`app: "hiveline"`, `v:2` and a matching outer post ID.

- Old `micro.fair` posts, replies, votes and account relations are **not read**.
- Old bare community namespaces and `micro.fair.channels` records are **not read**.
- Existing on-chain history remains accessible through legacy Hive interfaces.
- The new IndexedDB `hiveline-v2-posts` and localStorage `hivelineV2...`
  prevent older cached data from resurfacing.
- Favorite posts and locally joined communities also start from empty v2 keys.
- Users' Hive Keychain authentication is **not** reset: account identities and
  blockchain credentials are independent of app content namespaces.

## Active v2 namespaces

| Feature | Namespace |
| --- | --- |
| Main posts and replies | `hiveline.posts` |
| Community posts | `hiveline.c.<slug>` |
| Community registry | `hiveline.communities` |
| Votes | `hiveline.votes` |
| Admin moderation | `hiveline.moderation` |
| Follow/unfollow/block/unblock | `hiveline.relationships` |

Communities use a maximum 21-character slug. Follow/Block identities are
scoped by the transaction signer's `required_posting_auths` and by the
action `type`, not by a username embedded in the outer ID.

## Compatibility and safety

Historic data has not been transferred or rewritten. Vote and reply
references in v2 must identify new v2 posts; the new feed only displays those.
A future archive viewer could deliberately load legacy records with a
separate switch, but the new test feed must not implicitly mix protocols.

`js/hive/registry.js` is the canonical v2 registry, with
`LEGACY_MICROFAIR_IDS` exported for historical reference only;
`js/hive/content-scope.js` controls accepted post data;
`js/hive/validator.js` blocks accidental signed legacy operations.

A brand-name or GitHub repository rename is a separate administrative task.
**HiveLine is already used elsewhere as a product name**, so trademark and
domain availability should be assessed before commercial publication.
