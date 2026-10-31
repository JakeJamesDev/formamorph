# 06: Game Screen

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: player-facing copy across many small panels.

## What to build

Sweep the copy of the game screen and the start-of-game modals under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- `src/components/game/`
- In `src/views/`: `GameViewer.tsx`, `StartingLocationModal.tsx`, `TraitSelectionModal.tsx`, `CharacterCustomization.tsx`
- `src/components/modals/LoadGameDialog.tsx`, `SaveList.tsx`
- `src/lib/bubbleActions.ts`, `useVrmCustomization.tsx`

**Notes**

- The game panel suites assert on labels. Update them with each change.
- The Memory pin control is "Clear the Pin and Let the Story Decide" (R12). Rename it in `MemoryPanel.tsx`.
- Ticket 03 renames the built-in chip "Character Name" to "Entity Name" (R10). Fix the `GamePanels.tsx` comments that still name the old label.

Spec: Rulings, "Per ticket", "Facts and bugs", Testing Decisions.

## Acceptance criteria

- [x] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words. Hand read of every string the files render; facts checked in the code (rewind, notes chip, TTS model, load paths).
- [x] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason. See Landed.
- [x] Raw help paragraphs in the listed files render through Hint or Meta. copy:sweep raw-hint-role 47 → 10; the 10 are triaged below.
- [x] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests. Renames: R20, R21, "Rewind to Here?", the status row names (spec answer 4), "Context Window". No Find-bar caption names them; every test that did is updated.
- [x] Comments in the listed files changed only when false, history-telling, or figurative (Q6). Three history comments, the "Character Name" comments (R10) and one figurative TSDoc in `MemoryPanel.tsx`.
- [x] Every test that pinned a changed string is updated. Repo-wide search for each old string; the affected suites pass.
- [x] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed. No in-place bug fixes.
- [x] No changelog fragment.

For you: Start a game and read the panel hints, the inventory, the memory panel and the TTS dialog.

## Landed

**copy:sweep, ticket files (89):** 120 notices before, 61 after.

| Rule | Before | After |
|---|---|---|
| raw-hint-role | 47 | 10 |
| label-case | 23 | 23 |
| period-shape | 15 | 13 |
| term-character | 8 | 1 |
| ellipsis | 6 | 0 |
| raw-font-size | 6 | 6 |
| label-parenthetical | 3 | 3 |
| uncontracted | 3 | 1 |
| em-dash | 3 | 0 |
| figurative | 2 | 2 |
| app-subject | 1 | 0 |
| passive | 1 | 0 |
| exclamation | 1 | 1 |
| long-sentence | 1 | 1 |

**Triage of what remains**

- raw-hint-role: section headers ("Equipped", "Starting Traits", owner card names), the debug and map badges, and authored text (persona and trait Player-Facing Descriptions, a persona's start location, stat descriptor lines). None is help.
- label-case: case-only drift (Q5 nit).
- period-shape: status lines with a subject keep their period ("You carry nothing.", "No stats to show."); the Demo AI dialog body is extended help; the Memory off line is split by `<b>`; the Load Game screen-reader description is a sentence.
- raw-font-size: the memory chips, the Autosave tag, the You mark and a match badge. A text role changes their size, which is out of scope.
- label-parenthetical: a count and a token readout in template labels. No aside.
- figurative: "Mute" on the audio mute button is literal.
- term-character: "Describing character…" stays (R2).
- uncontracted, exclamation, long-sentence: the dead "Server is overwhelmed!" dialog (see Findings).

**Renames (R14: every quote updated)**

- R20: the left panel's tab strip and the mobile switcher read "Story". `docs/How-to-Play.md`.
- R21: Avatar Customization, Avatar Preview, Finalize Avatar, Animate Avatar. `surfaceLabels.ts`, the `surfaceMap.ts` anchor, `docs/Avatars.md` (heading anchor `#avatar-customization`), Glossary, Home, Starting a Game, the MainMenu tests, the help baseline cases, the trailer capture's ready text and README. The `finalize-character` target id stays: it is an identifier, not text.
- The status row reads each prompt's Settings name ("Generating Director…"), through `REQUEST_LABELS` (spec answer 4).
- "Confirm Rollback" → "Rewind to Here?" with a body from the code's facts. `docs/How-to-Play.md`.
- R12: "Clear the Pin and Let the Story Decide" in `MemoryPanel.tsx` and `docs/Memory.md`.
- The context bar's tooltip "Memory usage" → "Context Window", the name its popover shows. Its "Summary band" row → "Summaries", the Settings prompt name ("band" is a pipeline word).
- The save row's "- Game Time:" → "· Game time", the separator the folder row uses. `SaveList.test.tsx` follows it.
- TTS checkbox captions "Stream Narration Audio" and "Highlight While Speaking" lose their periods; a 12-word inline Hint follows each, and the trade-off moves into a HintInfo. `docs/How-to-Play.md`.

**Drive-by corrections**

- The Notes tab warning named the system prompt and a `<NOTES>` placeholder. The check reads the **Narration** prompt for the **Notes** chip; the warning now says so.
- The TTS dialog named "KokoroTTS v2". The loaded model is Kokoro 82M.
- The WebGPU error pointed at Chrome Canary and Edge Canary. Stable Chrome and Edge have WebGPU.
- The low-VRAM warning claimed a CPU fallback. The model loads on WebGPU only, so the line says loading may fail.
- The AI Context reason popover called a dictionary Value "lore", entities "characters & things", and said an inverted secondary keyword "fires" (R17).

**In-place bug fixes:** none.

**Findings**

- `GameViewer.tsx`: the "Server is overwhelmed!" ConfirmDialog never opens (`showPotatoPCDialog` is never set true). Left unchanged (spec answer 5).
- `StartingLocationModal.tsx` and `TraitSelectionModal.tsx` have no importer. No screen renders them; swept anyway.
- Turn actions spell the verb two ways: "Re-generate Narration", "Re-generate Stats", "Re-generate Choices", but "Regenerate Audio".
- Failures that only reach the console: loading the TTS model (`TTSModal.tsx`), and loading, exporting and deleting a save (`LoadGameDialog.tsx`). The player sees the busy state end and nothing else.
- The TTS Speed hint and the two checkbox hints sit after their controls (Field help order). Moving them is a layout change (R15).

**Sent to the spec session (other tickets' files)**

- `MemoryManagerModal.tsx` (02): the row tooltips "Sent as a full scene last turn" and "Sent to the story last turn". The panel keeps the same words so the two surfaces agree; "the story" means the AI.
- `ModelDetailsPanel.tsx` (02): a TSDoc names the "character-customization step" (R21).
- `helpTopics.ts` (12): the memory topic still quotes "Clear Pin (Let the Story Decide)" (R12).

**Not verified**

- No rendered read of the game screen. The tests read the DOM; nobody looked at the screens.

**For you**

- Start a game and read the panel hints, the inventory, the memory panel and the TTS dialog.
- Status lines that moved to Meta render one size smaller: the avatar slider values, the scene image status, the Anatomy "no system prompt" line.
- The TTS dialog's two checkboxes now have a short inline hint and an ⓘ beside them for the detail.
- The Avatars page heading anchor changed, so the help vectors for that section are stale until `npm run build:help-vectors`.
