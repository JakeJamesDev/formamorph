# 04: Stat Descriptor

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: the read reuses the AI's band picker, but `previous` must resolve chips with the turn-start pins.

## What to build

Each stat entry, `self` included, gains read-only `descriptor`: the active band's text, chips resolved, empty when no band applies (Q9). It uses the band picker the AI's stat context uses, so raw and percent thresholds read as the AI reads them. `previous.descriptor` reads the band at the start of the turn, resolved with the pins in force then. A `self.value` write in the run leaves `descriptor` at its run-start band (Q31). It reads the band whatever the display settings, and on a disabled stat (Q32). Entity and Blueprint stats read it the same way. Cards, the Variable menu and the Scripts guide cover it.

Spec: Q9, Q31, Q32, stories 16–19.

## Acceptance criteria

- [x] A stat with three bands reads the band the AI's stat context shows, for raw and percent thresholds (`statCodeExecutor.descriptor.test.ts`, compared against `buildStatContext`; a mutation that drops percent thresholds goes red)
- [x] A band with a placeholder chip reads with the chip resolved; `previous.descriptor` resolves it with the turn-start pins (`GameViewer.statDescriptor.test.tsx`, live turn and stats re-roll; `previous: before` and the live resolver both go red)
- [x] `previous.descriptor !== descriptor` is true on a turn whose AI change crossed a band (same GameViewer test, AI reply `Mood: +50`; turn-level case in `statCodeExecutor.descriptor.test.ts`)
- [x] After `self.value` is written, `descriptor` still reads the run-start band (`keeps the run-start band after a self.value write`)
- [x] A disabled stat and a stat with its status display off both read their band (`reads the band on a stat a trait switched off`; display settings never reach the sandbox, so no test switches them)
- [x] A write to `descriptor` lists as a read-only write (`lists a write to descriptor as a read-only write`)
- [x] Hover cards, the Variable menu and the Scripts guide list `descriptor` (`codeCards.test.ts`, `StatCodeTemplateDialog.variableMenu.test.tsx`, `docs/ScriptsGuide.md` stat table)

## Blocked by

- None (can start immediately)

## Landed

**Not verified**

- No test reads `descriptor` through a World Tool call, a user Tool or a Blueprint stat. All three marshal stats through the same `marshalSnapshot`, so they read it by construction.

**For you**

- In play, a stat's run text (`description` and `descriptor`) now resolves under the run's own pin record, the one `placeholders.X.value` reads. On a re-roll this can differ from the pins the shown game holds. Look at a Script that reads `self.description` on a stat whose text holds a chip.
