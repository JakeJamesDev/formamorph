# 01: Preset Option Type

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An author can add a Preset Option on the Options tab, and a player can click its values on the setup screen. This ticket supports Option rows only. The spec covers this in Q1–Q4, Q11–Q17 and Q20.

- **World shape.** Add the `preset` World Option type, with `mode` (snapshot or overlay) and values. Each value has an id, a name, a description and rows. Define the row union for all four row kinds (Option, trait, location, persona) so later tickets only fill in behavior. This ticket owns the shape. Parsing accepts the new type.
- **Kept out of references.** A Preset Option is absent from:
  - the World Option Condition picker and gate evaluation
  - pin lists
  - script option reads and writes, where a write is refused like an unknown id
  - the mid-game Options list
  - value validation
- **Apply and match.** Add the pure apply and match functions beside the entry draft. They follow the spec's Apply and Match decisions. This ticket owns both functions and their signatures. Tickets 02 and 03 extend them for the other row kinds. In this ticket, apply handles Option rows for snapshot and overlay, and the snapshot resets Options to their defaults.
- **Setup screen.** In the World Options category, a Preset Option renders as a radio group with each value's description. A click applies the value through the normal draft update. The selected radio comes from match.
- **Editor.** The Options tab type switch offers Preset. Its panel has the snapshot/overlay control and a value list with name, description and rows. In this ticket, the row editor offers shown Options as targets. Hidden Options are never offered.
- **Docs.** Add **Preset** to CONTEXT.md. Add the type to [World-Editor-Options.md](docs/World-Editor-Options.md). Write a changelog fragment.

## Acceptance criteria

- [x] A world with a Preset Option round-trips through export and import, and loads unchanged. (`GameDataContext.worldOptions.test.tsx`: the round-trip fixture holds a Preset with all four row kinds.)
- [x] A Preset Option does not appear in the condition picker, pin lists, the mid-game list or script reads, and a script write to its id is refused. (`traitGates.option.test.ts` "never names a Preset", `worldOptions.test.ts` "a Preset Option", `statCodeExecutor.options.test.ts` "leaves a Preset out of the read".)
- [x] Apply sets the listed Options. A snapshot resets unlisted Options to their defaults. An overlay keeps them. (`entryDraft.preset.test.ts` applyPreset cases.)
- [x] Match returns the value whose result equals the setup, returns null when none does, and returns the first in authored order when two match. (`entryDraft.preset.test.ts` matchPreset cases.)
- [x] Setup render test: clicking a value selects its radio and sets the listed Options. Changing one of those Options clears the radio. (`EnterWorldFlow.test.tsx` "a Preset Option at world entry".)
- [x] Editor: an author can create a Preset Option, set its mode, and add a value with a name, a description and an Option row. Hidden Options are not offered as targets. (`WorldEditor.presetOption.test.tsx`.)
- [x] Frames: `.scratch/frames/preset-setup-light.png` and `.scratch/frames/preset-editor-light.png` at desktop width, plus `.scratch/frames/preset-setup-dark.png`. (Taken at 1440×900 in the worktree preview.)

For you: Look at the Preset radio group in the setup screen's World Options category and judge whether its descriptions read clearly.

## Landed

**Not verified**
- None.

**For you**
- For you: Look at the Preset radio group in the setup screen's World Options category and judge whether its descriptions read clearly. Frames: `.scratch/preset-options-01/frames/preset-setup-light.png`, `.scratch/preset-options-01/frames/preset-setup-dark.png`.
- Read the editor's **Other Choices** labels (**Reset to Defaults** / **Keep as Set**) and their hint. Frame: `.scratch/preset-options-01/frames/preset-editor-light.png`.

**Notes**
- A value whose rows are all stale never matches, the same as a value with no rows (Q21 extension, sent to the spec session).
- The setup cascade notice shows on the trait and persona pages, not on the World Options page; showing it there is ticket 02's notice work.
- Found in passing: Enter World seeds default picks from a world view without `options`, so a default trait gated on a World Option starts off.
