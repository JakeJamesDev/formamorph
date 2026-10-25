# 07: Time Condition

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A new Condition kind in the rows that trait gates and image rules share, read against the story clock at the turn commit's snapshot, carried by the card codec and the Test Bench. It touches the gate engine every turn runs through, so Opus.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

A new **time** Condition joins the shared Requirement Rows (Q50–Q52). It holds a set of dayparts (night, dawn, morning, midday, afternoon, evening) and holds while the story clock's current daypart is in the set. Dayparts come from the story clock's existing daypart split, which scales with the world's day length. It does not test the day number or an hour.

- **Everywhere rows go:** trait gates and image Visibility rules both offer it, in the same Condition editor as trait and stat Conditions. It has no bearer.
- **When it reads the clock:** at the same per-turn snapshot that traits settle on (spec Q13/Q19 of the image-visibility-rules effort), after the turn's time has passed. It works with the AI clock on or off; with it off the clock still advances its flat hour per turn.
- **Outside play:** the Test Bench and other authoring lenses read it at the story's opening hour. Outside play, image rules stay ignored, as today.
- **Character cards** carry the new kind through export and import; a card codec that drops unknown kinds must not drop this one.
- The rule summary line reads it ("Shown while evening or night").

This is an export-shape change (a new Condition kind in world and card JSON). It is additive and unreleased, so it needs no migration.

Ship the docs it stales: the trait gates and Visibility rule wiki lines, and the `CONTEXT.md` glossary (a **Time Condition** entry beside Stat Condition). Changelog fragment of its own.

## Acceptance criteria

- [x] The Condition editor offers a time Condition with a daypart multi-select, in trait gates and in image rules. `RequirementRowsField.time.test.tsx`; both hosts share `RequirementRowsField`; live frame `.scratch/media-tab-07/frames/time-chip.jpg`
- [x] A trait gated on "evening or night" turns on when the clock reaches evening, at the turn commit that crosses it. `traitGates.time.test.ts` (per-turn settle) and `useTurnSettle.test.tsx` (time gate)
- [x] An entity image ruled on "night" shows in play at night and not at midday. `traitGates.time.test.ts`, `visibleImages` at night and midday
- [x] The Condition works with the AI clock off, on the flat hour per turn. `traitGates.time.test.ts`, ten flat turns from 8:00 reach evening
- [x] A world with a non-24-hour day length divides dayparts by fraction, matching the narration's daypart. `traitGates.time.test.ts`, every hour of a 30-hour day against `formatAbsolute`
- [x] A character card with a time Condition round-trips through export and import. `traitGates.time.test.ts`, trait gate and image rule
- [x] The Test Bench reads the Condition at the opening hour. `rules.test.ts`, gated defaults: morning passes, evening or night is flagged
- [x] The rule summary reads the dayparts in words. `traitGates.time.test.ts`, "Shown while evening or night", each run from the daypart after a gap (spec session ruling, replacing Q63)
- [x] A guard test fails when the snapshot reads the clock before the turn's time passes. `useTurnSettle.test.tsx`; reading `world()` when the settle is asked for turned it red, and only it

For you: author a day and night pair of images on one entity and play across an evening to see the swap.

## Landed

**Not verified**
- GameViewer's call order (the turn's hours pass before `settleTurn`) has no test of its own. The guard covers `useTurnSettle` only; GameViewer was checked by reading.
- Image rules read the daypart of the turn on screen as soon as the clock moves (Q64), so in a live turn a night image can swap a moment before a trait on the same clock settles. Image stat Conditions behave the same way.

**For you**
- Author a day and night pair of images on one entity and play across an evening to see the swap.
- See the daypart chip, the approved segmented multi-select (Q66), in the World Editor and at `#dev?modal=designSystem&tab=segmented-multi-select`: frame `.scratch/media-tab-07/frames/time-chip.jpg`.
