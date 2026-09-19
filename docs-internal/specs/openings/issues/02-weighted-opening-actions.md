# 02: Weighted Opening Actions On A World

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Openings](../spec.md)

**What to build:** A world author writes several openings in the World Editor's opening panel, gives each a draw weight, and sees each row's chance. Weight 0 keeps a row without drawing it. One switch turns the whole list off and keeps the text. An empty list says the default opening applies and shows its text read-only. At Start Game the app draws one opening by weight and pre-fills the input box with it, exactly as the single cue does today. A world with the old single cue opens as it did before.

Every opening in this ticket is an Opening Action. The kind field exists in the data, and the Opens As control arrives in ticket 03.

**Rationale for the model:** this ticket sets the data shape, the migration, and the pure Openings module that every later ticket builds on. Opus at high effort, because an error here costs every ticket after it.

## Acceptance criteria

- [ ] An Opening has a stable id, its text, and its kind. An owner carries an ordered list and a weight map keyed by opening id. A missing weight counts as 1. This matches the Placeholder weight model.
- [ ] The world overview carries the list, the weight map, and one openings switch. Absent means on.
- [ ] `migrateWorld` moves the old single cue into the list as one Opening Action and removes the old fields. A cue that was switched off sets the openings switch to off and keeps the row. A second run changes nothing. Tests prove all three.
- [ ] One new pure Openings module owns the pool and the draw. It takes a random source as an argument. An empty pool, a switched-off list, and a list of only weight 0 rows all return the shipped default Opening Action.
- [ ] The existing opening resolver reads through the module, so the pre-fill, the page-one regenerate, and the legacy start message all agree.
- [ ] Chips in an opening resolve against the opening pins, as the cue does today.
- [ ] The world panel shows the rows with text, weight, and computed chance, plus add, remove, and reorder. The weighted multiline rows of the Placeholder editor are the model. Removing a row drops its weight.
- [ ] The empty state names the default opening and shows its text read-only.
- [ ] Page-one regenerate on an Opening Action behaves as today: it returns to the not-started state with the player's text in the box.
- [ ] The find bar and search and replace reach every row.
- [ ] The domain glossary gains Opening, Opening Action, and Opening Narration. "Cue" leaves the UI copy.
- [ ] Module tests use a seeded random source and cover weights, weight 0, the switch, and the empty pool. One guard is proven by reinstating its fault.
- [ ] The panel is checked in the preview in both themes, with static DOM evidence.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

**Export shape:** this ticket changes the world export and adds a migration. Say so in the hand-over. The version and the release timing belong to the project owner. No save shape change.
