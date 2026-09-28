# 06: Pins by blueprint

Status: ready-for-human
Base: 0111d245
Blocked by: 03 — Link overrides in the editor; 04 — Placeholder Blueprints group and copy rows
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Rationale: replaces bearer-relative pins in the collector, the pin editor and the link section with one resolution through the copy lookup. Many readers, one order.

Parent: [Blueprints spec](../spec.md)

## What to build

A trait pins a blueprint placeholder. The pin editor on a trait lists blueprints beside world placeholders, and the pin value is picked from the blueprint's values. On each bearer the pin traces the blueprint to that bearer's copy through the copy lookup, in the bearer context trait-links already established (world pins, then the player's trait pins, then a cast entity's own). A link overrides its pins list as a whole through ticket 03. A cast entity's pin changes only that entity's copy; the player's text never moves. A pin that names a value the copy removed lays nothing.

The bearer-relative pin path, its name-keyed link values and the "bearer placeholder" picker are removed. Trait-links ticket 06's tests are rewritten against copies.

## Acceptance criteria

- [ ] Pin collector tests cover a blueprint pin on two bearers with different copies, a cast entity's pin absent from the player's text, a link's overridden pins list, and a pin naming a removed value.
- [ ] The pin editor offers blueprints with their values; no bearer-relative option remains.
- [ ] Every reader of `bearerPlaceholder` and name-keyed link pin values is gone; typecheck proves it.
- [ ] Each guard is proven to fail with its rule removed.
