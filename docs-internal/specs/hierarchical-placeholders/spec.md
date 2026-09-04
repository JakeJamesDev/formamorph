# Hierarchical Placeholders — Spec

Status: ready-for-agent

## Problem Statement

Placeholders today are flat: one name, a list of plain string values. A world author who wants a
randomized *character* — one roll that decides ethnicity, and with it hair, eyes, and build — must
create many separate placeholders and hope they stay consistent. There is no way to reference one
placeholder from another, no way to address a part of a concept ("Molly's hair") from world text,
and no way for a single roll to drive several correlated details. Authors also cannot compose: a
value cannot contain another placeholder.

## Solution

Values become chip-capable, and that one change carries the whole feature:

- A value that is **exactly one chip** is a structural child. It makes `Molly › Hair` a valid,
  addressable path.
- A chip **inside** a string value composes ("Her hair is {Brown}") but is not addressable.
- A **Roll** flag turns a placeholder into a choice (pick one value) or a record (whole placement
  joins every value). Absent, the flag is inferred exactly as today: 2+ values rolls.
- Slot paths (`Molly › Hair`) route through whichever value rolled, so separate sentences describe
  the same rolled character, and a reroll moves them together.
- Drilled chips as values (`{Hair › Brown}`) are authored pre-selections.
- Trait pins extend naturally: a pin selects a value, masking the roll while the trait is on.

The clickable prototype (same directory, `prototype.html`) demonstrates all of this and its
resolver is the draft for the real one. This spec covers the backend slices only; editor/picker
UI is deferred until the author has reviewed UX separately.

## User Stories

1. As a world author, I want a placeholder's values to accept chips, so that values can reference other placeholders.
2. As a world author, I want a value that is exactly one chip to count as a child, so that I can address it by path from world text.
3. As a world author, I want chips inside a string value to compose, so that I can write "Her hair is {Brown}" as one value.
4. As a world author, I want a Roll flag per placeholder, so that I control whether it picks one value or presents all of them.
5. As a world author, I want a placeholder without the flag to behave exactly as today, so that my existing worlds do not change.
6. As a world author, I want whole placement of a record to join every value with commas, so that a character chip renders all its details.
7. As a world author, I want to place a slot path like `Molly › Hair`, so that text written before the roll still names the right detail.
8. As a world author, I want slot chips to correlate, so that hair and eyes always describe the same rolled variant.
9. As a world author, I want a reroll to move every correlated chip together, so that the character stays coherent.
10. As a world author, I want to drill a chip used as a value (`{Hair › Brown}`), so that a variant pre-selects a branch while its leaves still roll.
11. As a world author, I want explicit paths typed in world text (`Molly › isWhite › Hair`) to bypass the roll, so that I can force a branch where I need it.
12. As a world author, I want per-value weights to keep working on rolling placeholders, so that variants can be 70/30.
13. As a world author, I want a 0-weight value to be benched, so that it never rolls but stays addressable and pinnable.
14. As a world author, I want a trait to pin a placeholder to one of its values, so that "Asian Heritage" forces the isAsian variant.
15. As a world author, I want a pin to mask the roll rather than overwrite it, so that removing the trait restores the rolled value.
16. As a world author, I want a pin to beat an authored drill, so that a trait can override a variant's default branch.
17. As a world author, I want typed explicit paths to stay pin-immune, so that text that names a branch always means that branch.
18. As a world author, I want World and Unique modes on every chip, including chips inside values, so that one chip vocabulary works everywhere.
19. As a world author, I want a Unique character chip to roll its entire subtree per placement, so that two strangers in one paragraph differ.
20. As a world author, I want a Unique chip inside a value to key per outer placement, so that unique twins can have different eyes.
21. As a world author, I want a slot miss to resolve to nothing and raise a Test Bench finding, so that a gap is visible without breaking play.
22. As a world author, I want the Test Bench to flag dangling references, cycles, and empty record joins, so that structural mistakes surface where all my other world problems do.
23. As a world author, I want reference cycles to resolve safely to nothing, so that a mistake cannot hang or crash a playthrough.
24. As a world author, I want placeholder chips to keep working in name fields uniformly, so that there are no special rules to remember.
25. As a world author, I want library cards and other no-roll surfaces to describe structured chips (choice as `{a|b|c}`, record as joined descriptions, depth-capped), so that browsing still conveys the content.
26. As a world author, I want author-time Preview to roll structured placeholders like play does, so that I can check a character without booting a game.
27. As a world author, I want exported entities and dictionaries to bundle every placeholder their chips reference, transitively, so that structured chips survive sharing.
28. As a world author, I want imports to absorb structured placeholders with dedup, so that re-importing does not multiply parts.
29. As a player, I want rolled values frozen into my save, so that the story stays consistent across sessions.
30. As a player, I want a loaded save to restore every roll key-for-key, so that my character is who she was.
31. As a player, I want world edits to leave my already-rolled text alone until a reroll, so that new narration does not contradict forty turns of story.
32. As a player, I want in-game trait toggles to flip pinned details live and restore rolls when toggled off, so that traits behave as they do today.
33. As a returning user, I want my existing worlds, saves, and exports to load and behave identically with zero migration, so that this ships invisibly until I use it.

## Implementation Decisions

**Schema.** The placeholder shape stays `{ id, name, values, weights }` and gains one optional
field: `roll?: boolean`. `true` = choice (pick one value), `false` = record (join all), absent =
inferred from value count exactly as today (2+ rolls). Values remain strings; chips embed as
tokens inside them, as they do in every other chip-capable field. A never-edited world exports
byte-identical to today. No world migration exists because none is needed.

**Token codec.** The in-text token gains an optional path. Path segments (shape from the
prototype): the leading segment names the root placeholder by id; each later segment is either
`val` (an explicit pick, by target placeholder id) or `slot` (a name to route). Mode and
placement id stay as today. Old tokens are valid new tokens with an empty path.

**Resolution** (prototype resolver is the draft):

- Choice: pick a value — precedence pin, then authored drill, then frozen roll, then weighted
  draw. Record/single value: resolve every value and join non-empty results with `", "`.
- A chip inside a value resolves recursively; its drill segments are **authored** and yield to
  pins. Segments typed in world text are not authored and are pin-immune.
- Slot routing: direct lone-chip value whose target name matches wins; otherwise a rolling
  placeholder routes through its selected value and retries; otherwise miss → `""` + finding.
- Cycle guard (seen-set) and a depth cap; both resolve to `""` and report a finding.
- All-zero weights keep the uniform-draw fallback; 0-weight values are benched but addressable.

**Rolls.** A roll stores the chosen value's raw content (chips included) — a frozen outcome, the
shipped semantics extended. World mode keys by placeholder id; Unique keys the whole subtree's
rolls under the placement, and nested Unique chips compose via the placement chain. Editing a
world under a live save leaves stale rolls valid until reroll; old saves' rolls are already in
this shape. Save-envelope values may now contain chip tokens — an export-shape note for release.

**Pins.** Trait pins keep their storage (placeholder id → value content) and their semantics:
resolve-time mask, never written to rolls, broken pin still applies. Pinning a chip-bearing value
is what pins a variant.

**Eager priming.** The priming walk must recurse through value chips so a save activation still
rolls everything up front; the Bench's exported mirror of the priming field list moves with it.

**Diagnostics.** Four new rules in the Test Bench rule engine (no new UI): slot miss (some
sibling value cannot satisfy a placed slot path), dangling reference, reference cycle, empty
record join. Plus duplicate slot names under one placeholder (first match wins at resolve). No
quick fixes in v1.

**No-roll surfaces.** The describe pass mirrors resolution shape, depth-capped (~2): choice →
`{a|b|c|…}` over described values, record → joined described values. Pins argument keeps its
existing order (missing → `''` before the pin check).

**Portability.** Used-placeholder collection becomes transitive through value chips; absorb dedup
compares full value lists (chips included) plus weights; token remapping rewrites path segment
ids as well as the root id.

**Terminology and display.** No new nouns — "Placeholders" umbrella, a Roll toggle, ⓘ tip.
Path displays use `›` as separator; dots stay legal in names. Name fields accept all chips
uniformly. (Editor UI itself is out of scope here.)

**Delivery.** Staged slices, gates green each step: (1) codec + resolver + rolls/pins/modes,
pure; (2) priming/session plumbing, Preview, describe, portability; (3) Test Bench rules. UI
slices follow later under their own spec after the author reviews UX.

## Testing Decisions

- Test at the existing pure seam: the placeholder module's exported functions, with an injected
  deterministic picker — the same style as the feature's current unit tests. External behavior
  only: given placeholders + rolls + pins, assert the resolved string, the findings, and the
  minted rolls; never the walk order.
- The seven prototype walkthroughs become fixtures: flat compat + composition, record join for
  both variants, slot correlation across two chips, authored drill, pin precedence (pin over
  authored drill; typed drill immune), slot miss finding, two Unique placements differing.
- Back-compat is a first-class case: a legacy flat placeholder set and legacy rolls must resolve
  byte-identically through the new resolver.
- Bench rules follow the rule-engine's existing test conventions (registry-driven, findings
  asserted per rule).
- Priming/session behavior extends the existing session and panels tests; the two
  mutation-proven guards there stay green.
- Per the test bar: each new guard is proven by reinstating its bug once; no scenario rigging
  (a slot miss test uses a genuinely missing slot, not a gutted world).

## Out of Scope

- All editor and insert UI: tree/list changes, the `{` picker drill, chip popout re-pick, palette
  and typeahead changes, inline-create. Deferred until the author reviews UX; separate spec.
- Lint quick-fixes for the new Bench rules.
- Weights editor changes (percentage reveal already keys off value text).
- World Overview description/readme placeholder support (still excluded, as before).
- Version bump and release gating — user-managed, as always.
- Any migration of shipped worlds/saves (none is required by design).

## Further Notes

- The prototype (`prototype.html`, this directory) is the primary source for resolver semantics
  and doubles as a stakeholder demo. Its resolver is a draft, not production code — rewrite under
  the project's conventions when lifting.
- Export-shape reminder for release time: no schema field changes, but tokens gain a path form and
  save rolls may carry tokens; old app versions would show raw tokens for structured chips only.
- Decisions log (who chose what) lives in the conversation that produced this spec; the
  contentious calls are recorded above as decisions, not options.
