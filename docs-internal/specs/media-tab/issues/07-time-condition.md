# 07: Time Condition

Status: ready-for-agent
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

- [ ] The Condition editor offers a time Condition with a daypart multi-select, in trait gates and in image rules
- [ ] A trait gated on "evening or night" turns on when the clock reaches evening, at the turn commit that crosses it
- [ ] An entity image ruled on "night" shows in play at night and not at midday
- [ ] The Condition works with the AI clock off, on the flat hour per turn
- [ ] A world with a non-24-hour day length divides dayparts by fraction, matching the narration's daypart
- [ ] A character card with a time Condition round-trips through export and import
- [ ] The Test Bench reads the Condition at the opening hour
- [ ] The rule summary reads the dayparts in words
- [ ] A guard test fails when the snapshot reads the clock before the turn's time passes

For you: author a day and night pair of images on one entity and play across an evening to see the swap.
