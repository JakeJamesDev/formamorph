# 22: Library Entity Editor Stats Tab

Status: done
Blocked by: 14, 19
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Rationale: reuses the entity Stats editor in the library's side-by-side layout, as the library editor's Traits tab reuses the traits editor.

Parent: [Entity Stats spec](../spec.md)

## What to build

An author edits a library character's stats in the library entity editor, as they edit its traits there. The editor gains a **Stats** tab built on the same entity stats editor as the World Editor's entity Stats tab, in the library's side-by-side layout (as entity-traits-mirror Q1 rules for traits). Stats, stat groups and stat Links saved here travel with the card (ticket 14). Ruling Q74.

## Acceptance criteria

- [ ] The library entity editor has a **Stats** tab with the shared toolbar, search and **+** menu, and the full stat editor.
- [ ] It shares one entity stats editor with the World Editor's entity Stats tab; only the layout differs.
- [ ] Stats, groups and Links saved here round-trip through the card.
- [ ] Stat Links with no Blueprint to bind in the library show as dormant, as card trait Links do.
- [ ] The tab has a dev-route entry.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
