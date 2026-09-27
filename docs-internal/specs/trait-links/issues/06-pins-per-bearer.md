# 06: Pins per bearer

Status: ready-for-agent
Blocked by: 02 — Links in the editor
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: replaces the one-set pin rule with per-bearer contexts across the collector, the pin editor and the link section. Many readers, one new resolution order.

Parent: [Trait Links spec](../spec.md)

## What to build

An NPC's pins apply only in that NPC's own text. World-level text resolves with the world pins plus the player's. A trait pin can target "the bearer's own Class Garb" by name, and each link picks the value from that bearer's own values, or the world placeholder's on fallback.

## Acceptance criteria

- [ ] The pin collector takes a bearer context. An entity's text and its traits' text resolve with that bearer's active pins over the world pins. Locations, the world prompt and narration context resolve with the world pins plus the player bearer's. This replaces the trait-gates one-set rule.
- [ ] The pin editor can target a placeholder by name relative to the bearer. It binds to the bearer's own placeholder of that name, else the world placeholder of that name.
- [ ] The This Link section gains one row per bearer-relative pin: "<Placeholder> →" with a value select over the bearer's own values, or the world placeholder's values on fallback. A new link starts with the pin's own value when it binds to the world placeholder, else unset.
- [ ] The link's per-link value supplies the pin in both cases. A link with no value lays no pin.
- [ ] A placeholder's Pins list and conflict note show link pins with the bearer named, and edits write back to the link.
- [ ] Collector tests cover: a bearer-relative pin on a bearer with its own placeholder, fallback to the world placeholder, a link with no value, an NPC pin absent from world-level text, and a player pin present in world-level text. Component tests cover the pin target choice and the This Link pin rows.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.

## Comments

**From ticket 01 (2026-09-27, commit 72f20e90).** A bearer-relative pin keeps `placeholderId` as `''` and names its target in `bearerPlaceholder`. The collector does not read it yet; this ticket owns that.
