# Micro.fair → New Brand: v2 Protocol Migration Plan

**Status: proposal only. No rebranding, new on-chain IDs, or v2 broadcasting is active.**

This plan separates three different decisions that should not be conflated:

1. **Product name, logo, URL and repository name** — can change independently from Hive messages.
2. **Application namespace / custom_json IDs** — changes where new Hive transactions are stored, leaving historical posts and votes under their original IDs.
3. **Protocol payload v2** — a separate schema/versioning decision. A new marketing name does **not** inherently require `v:2`, and v2 does not retroactively migrate previous blockchain operations.

## What is live now

The deployed Micro.fair v1 reader and writer continue using historical namespaces: `micro.fair`, `micro.fair.interation`, `micro.fair.adpmuted`, `micro.fair.channels`, user-scoped `micro.fair.{user}.follow` / `.block` and the exact community custom_json IDs. The in-app `#/protocol` page documents them.

The validator in `js/hive/validator.js` checks the registered v1 payloads offline. The advanced Custom JSON dialog requires a successful structural check before signing. An unrelated custom_json operation can only be sent after explicitly acknowledging that the app does not recognize it. **This does not verify account authority or blockchain acceptance.**

## Proposed v2 naming conventions

The *draft-only* generator in `js/hive/v2-plan.js` accepts a provisional lowercase app identifier, e.g. `newbrand`, and illustrates these cleaner IDs:

| Proposed function | Draft v2 ID | Historical data to keep reading |
| --- | --- | --- |
| Main posts & replies | `newbrand.posts` | `micro.fair` |
| Votes | `newbrand.votes` | `micro.fair.interation` |
| Post moderation | `newbrand.moderation` | `micro.fair.adpmuted` |
| Community registry | `newbrand.communities` | `micro.fair.channels` |
| Follow/block actions | `newbrand.relationships` | Per-signer `micro.fair.{user}.follow` and `.block` |
| Community posts | **Undecided** | Existing per-community IDs such as `hive.micro` |

The final product/namespace name is **not yet selected**, and these names are not registered or deployed. The v2 planner returns `enabled: false` and is never imported by the signing path. Namespace names should remain short enough to satisfy the on-chain ID constraints.

## Migration requirements before activating writes

### Stage 1 — Brand without protocol changes
Change the visible name, page title, logo and product descriptions only after selecting and checking the new brand. Keep all v1 IDs active, avoiding any break in historical posts or connections.

### Stage 2 — Versioned schema and dual reads
Specify each v2 payload (including `app`, `v`, `type`, content references, follower/block relationships and moderation rules). Create indexed read adapters that query **both** v1 and v2 HAFSQL namespaces. Avoid duplicate posts and double-counting votes when merging, and keep a stable mapping between legacy and v2 content references.

A single shared `newbrand.relationships` namespace replaces user-scoped v1 suffixes only after the reader securely filters by `required_posting_auths`. A namespace string alone is never proof of authorship or moderation authorization.

### Stage 3 — Community strategy
Plan how post namespaces in communities migrate. Existing community IDs are independent custom_json namespaces and cannot simply be prefixed without changing their identity, length constraints and URLs. Decide whether to retain them or introduce a registry-based mapping before creating v2 community writers.

### Stage 4 — Controlled rollout
Roll out v2 read support and regression tests **before** enabling v2 writes. Introduce a feature flag with v2 writes disabled by default. Verify on-chain signatures with Hive Keychain and HAFSQL sync. Preserve legacy read and cache support for historical posts, replies, votes and relationships.

### Stage 5 — Deprecation, not deletion
After confirmed adoption, optionally stop new v1 writes without ever assuming v1 blockchain records can be erased or moved. Keep dual reads or an explicit archival viewer.

## Validation principles

- Never change `micro.fair.interation` or `micro.fair.adpmuted` in-place and call it a correction.
- Never silently interpret a v2 payload as a v1 message.
- Never publish a new on-chain namespace merely because a brand name was typed into the planner.
- Validate field types/operation IDs locally and verify signer authority and acceptance on-chain.
- Keep the arbitrary Custom JSON editor separate from registered application-protocol broadcast helpers.
- Record any data versioning change in executable tests and public protocol docs.

## Files

- `js/hive/registry.js` — immutable production v1 namespace registry.
- `js/hive/protocol.js` — production v1 serialization.
- `js/hive/validator.js` — structural validation of registered v1 operations.
- `js/hive/v2-plan.js` — pure draft-only v2 name generator.
- `js/ui/protocol-validator.js` — validation workbench, migration preview and safe modal gate.
- `tests/custom-json-validator.test.mjs` — regression suite.
