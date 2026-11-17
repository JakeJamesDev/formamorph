# 05: Row Targets Follow Setup's Trees, and Names Resolve

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The user found two gaps at close. The spec covers both in Q42.

- **Blueprint traits.** The Preset row editor's **World Traits** group lists every world trait, including Blueprint traits, which are never global and never offered to the player. Each entity's group lists only the entity's own traits, so an author can't pick a trait the entity links from a Blueprint. Build the targets from the trees setup uses: the global tree for the root group, and each entity's owner tree, Blueprint links included, for its group. The Preset check's existence test and the row names must read the same trees. A Blueprint trait linked by an entity is then a valid owned row, and apply already settles it through the entry trees. Confirm this with a test.
- **Raw placeholder names.** The row editor's target list and Can't-apply warning show names as stored, so an entity whose name is a placeholder appears as `{{ph:…}}`. The setup notice resolves placeholders in Option names but not in owner, trait, persona or location names. Resolve every name the way the rest of the editor and setup screen do. Reuse the existing resolver, not a new one.
- **Docs.** Update [World-Editor-Options.md](docs/World-Editor-Options.md) if it describes the target groups. Write a changelog fragment, or fold it into the effort's existing entries if they already cover it.

## Acceptance criteria

- [x] The root group lists no Blueprint trait. `WorldEditor.presetOption.test.tsx` "lists traits from setup's trees…" and `presetCheck.test.ts` "reads setup's trees…".
- [x] An entity's group lists the Blueprint traits it links, and a row for one applies at setup and passes the Preset check. Same editor test; `entryDraft.preset.test.ts` "applies an owned row for a Blueprint trait the entity links"; `presetCheck.test.ts` "reads setup's trees…"; `EnterWorldFlow.test.tsx` "turns on the linked trait…".
- [x] An entity, trait, Option or location whose name is a placeholder shows its resolved name in the target list, in the Can't-apply warning and in the setup notice. The editor draws chips (Q42): target, value boxes and warning in the editor test; the notice in both new `EnterWorldFlow.test.tsx` cases.
- [x] Each new test fails when its fix is removed. Mutations run: root tree from raw traits (check and editor tests red), owner lookup on the entity's own traits (notice test red), owned trait name unresolved (notice test red), raw text in place of chips (editor test red). Two tests guard behavior that already held: the apply test (the ticket asked to confirm it) and the notice's persona and location case.

## Landed

**Not verified**

- None.

**For you**

- Open the Options tab on a world with a placeholder-named entity and a Blueprint. Check the row editor's target list.
