# 04: Opening Script Global

Status: ready-for-human
Blocked by: 01, 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Scripts read a read-only `opening` in every Timing on every turn (Q4). It holds `category` "opening", `id`, `name`, `owner`, `kind`, `self`, `time`, `weather`, and `text` with its placeholders filled in as the player saw it (Q16). `owner` is the owner's full entities or locations entry, or null for a world row (Q6). `opening` is null when the resolved record is null (Q7).

Test Code and the Test Bench get one shared opening picker, default None (Q12). It lists every Opening by name or derived label (ticket 01). This ticket owns the picker; ticket 06 feeds the Opening Condition from it.

The code surface, completions and quick reference list `opening` beside `turn` and `world`.

Ships its own docs: the scripting wiki's globals section and a changelog fragment.

## Acceptance criteria

- [x] An At Game Start script and a later-turn script both read the drawn Opening's name, kind, self, time, weather and filled-in text, in the stat-code turn runner. (`GameViewer.openingGlobal.test.tsx`, first case; weather set in `statCodeTestRun.opening.test.ts`)
- [x] `opening.owner` is the entity entry for an entity's Opening, the location entry for a location's, and null for a world Opening, and its `category` tells them apart. (`GameViewer.openingGlobal.test.tsx` and `statCodeTestRun.opening.test.ts`, persona owner included)
- [x] `opening` is null for the shipped default opening and for a null record. (default opening in play writes no record and reads null; a dead key reads null in Test Code)
- [x] After a page-one re-roll, the next script run reads the new Opening. (`GameViewer.openingGlobal.test.tsx`, re-roll case)
- [x] Test Code and the Test Bench read None by default, and read the picked Opening after a pick. (`ScriptBox.opening.test.tsx`, `scriptCheck.test.ts`; DOM read in the worktree preview: a Bench pick showed in a Test Code box)
- [x] Completions and the quick reference list `opening` and its fields as read-only. (`statCodeQuickReference.test.ts`, `statCodeSurface.access.test.ts`, `statCodeAnalysis.readOnlyGlobals.test.ts`)

## Landed

Five guards were mutation-tested: play wiring, the owner lookup, the analysis owner skip, the Test Code pick and the Bench pick. Each reinstated bug turned its own test red.

The shared pick lives in its own session record (`FORMAMORPH_benchOpening`), beside the lens record, so Test Code reads it before the Bench has ever opened. The Bench shows the picker on the Issues tab only, the one instrument that runs scripts today; ticket 06 turns it on where the Opening Condition reads it.

**Not verified**
- A saved game whose Opening was deleted, read by a script in play. The resolver's null path is tested (ticket 03) and so is a dead pick in Test Code, but no play test loads such a save.

**For you**
- The Opening picker beside every Test Code button and in the Test Bench's Issues lens bar: check its place and width. Frame: `.scratch/drawn-opening-04/frames/bench-opening-picker.png`.
