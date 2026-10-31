# 14: Show the Stranger Label in Every Roster

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Thinking Mode defaults to Off, and only Precall runs the planner. With Off, Inline or Staged, the narrator lists an unmet stranger under its true name with nothing else, so the true name can reach the prose from the first turn. The narrator must still read the true name to recognize the introduction (Q83). Every prompt that lists an unmet stranger with a Stranger Name also shows the stranger label, the latest story alias else the Stranger Name, as one more roster field, like the planner's Q68 field.

Read `docs-internal/notes/prompt-writing-guide/notes.md` first. The field and any rule line that tells the model how to use it are positive contracts with no example values.

## Acceptance criteria

- [x] Every prompt whose roster lists an unmet entity with a Stranger Name shows its stranger label field. A met entity, or one without a Stranger Name, renders as today. Labels ride on the Chip Scene: `chipValues.test.ts` ("a scene's stranger labels": every scope, Choices scene roster, name-only `Name (label)` per Q86, byte-equal without labels), `liveScene.test.ts`; both guards mutation-tested.
- [x] Narration with Thinking Mode Off refers to an unmet stranger by its label until the story introduces them. Field plus one rule line in the narration prompt; cloud LABEL 42% → 80%, asked-name guard still named 100%.
- [x] A probe on cloud with in-batch controls, old prompt against new with at least 5 runs per arm, reports how often the true name leaks into narration with Thinking Mode Off. The numbers go in the landing message. `narration-stranger-probe.mjs`, 10–12 runs per case per arm, 5 cases plus a guard.
- [x] Precall planning keeps ticket 07's numbers: no new leak, and the alias still matches the label. By construction: the planner prompt is unchanged, and its roster renders through the same `entityScopes` call with the same labels and met check, so its request is byte-equal. Not re-probed.
- [ ] Request Anatomy shows the field.

## Landed

**Not verified**

- Request Anatomy: it renders the request's own system prompt, built from `contextValues` → the live Chip Scene that now carries the labels. No turn was played in the preview to read it.
- References outside the rosters still print an unmet stranger by true name only (Q87, out of scope): relationship sentences (`src/lib/entityRelationships.ts:68`) and Inventory owner headings (`src/lib/inventoryContext.ts:103`). A later leak probe should look there first.
- Choices and the stat pass now carry the field with no rule line for it; their name use was not probed.
- The GameViewer memo that builds the labels from the met list runs inline; typecheck and the probe's use of the same helpers cover it.

**For you**

- Play a world with a stranger authored, Thinking Mode Off, and read whether the narration keeps the stranger's name hidden until they are introduced.
- Open Request Anatomy on a turn with an unmet stranger and read the `stranger name` line in the Entities block.
