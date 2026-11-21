# 07: Outside Play and Portability

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A Layered Image looks right outside play and travels whole. The spec covers this in Q5, Q12 and its Portability section.

- **Outside play.** Extend ticket 02's `outsidePlayLayered` helper (each Layer's first Variant, rules and settings ignored) rather than building a second one. The library grid, listings, setup and slot thumbnails use it.
- **Flatten.** One function, owned here, draws a resolved stack to one bitmap at the canvas size (Q23, Q29) with opacity, tint and blend mode. Ticket 09 reuses it. Tint must match ticket 04's live tint: a per-channel scale in sRGB with alpha untouched (an SVG color matrix in play), not a masked multiply.
- **Portable form.** Library entities and publish embed the layered entry, with its Variant images embedded and named. They convert at the boundary, as the Shared Media List does. Import merges byte-identical images.
- **Character cards.** The card PNG pixels are the flattened outside-play picture. The card's Formamorph data carries the full rig.
- **Docs.** The Library page says a Layered Image travels whole and cards show the default look.

## Acceptance criteria

- [ ] Round-trip tests (library, publish, card) keep every Layer, Variant name and rule, and merge duplicate images.
- [ ] A card's pixels equal the flattened outside-play picture, including tint and blend.
- [ ] The library grid shows the first-Variant picture.
- [ ] Changelog fragment written.

⚠️ Export shape: library entities, publish payloads and character cards embed the rig.
