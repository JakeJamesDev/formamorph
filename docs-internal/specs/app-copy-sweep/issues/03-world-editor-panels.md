# 03: World Editor Panels

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the widest author surface, with paired fields and Find-bar labels.

## What to build

Sweep the copy of the World Editor panels and the modals they open under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- `src/managers/`, except `ScriptBox.tsx`, `ScriptsSection.tsx`, `ItemScripts.tsx`, `TraitScripts.tsx` (05)
- Editor modals in `src/components/modals/`: `AddDictionaryModal`, `AddEntityModal`, `AddFromLibraryModal`, `ConnectReferencesModal`, `DictionaryEditorModal`, `EditTextModal`, `EditorModalShell`, `EntityEditorModal`, `EntityModal`, `ImportComponentModal`, `ImportContentModal`, `LinkToLibraryModal`, `LocationModal`, `ReplaceSourceModal`, `WorldUpdateReviewDialog`, `MenuModal`
- The panel tab lists in `src/views/` (`*PanelTabs.ts`, `*EditorTabs.ts`, `worldEditorTabs.ts`, `locationViews.ts`)
- In `src/lib/`: `placeholderPins.ts`, `builtinPlaceholders.ts`, `presence.ts`, `entityPresenceCopy.ts`, `canvasMenu.ts`, `canvasEdgePath.ts`, `mediaIndex.ts`, `editorMode.ts`, `publishLinks.ts`, `sourceChecks.ts`, `useLibraryLinking.tsx`, `useWorldExport.tsx`, `useDownscalePrompt.tsx`, `optimizeProgress.ts`, `markdownToolbar.ts`, `inventory/`

**Notes**

- The Overview Voice Pass already landed. Read its Overview copy as settled; check it against the rules, and send a disagreement to the spec session instead of rewriting it.
- Paired fields mirror each other. Write both hints together.
- Every renamed label goes through the Find bar's caption guard.

Spec: Rulings, "Per ticket", "Facts and bugs", Testing Decisions.

## Acceptance criteria

- [x] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words. Hand pass over every string the extract found; facts checked against the code (scan depth, Known In, dictionary description on the listing, delete undo); two review agents read the diff.
- [x] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason. See Landed.
- [x] Raw help paragraphs in the listed files render through Hint or Meta. Remaining raw spans are captions, counts or content, triaged under Landed.
- [x] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests. R10 and R11 renames, the export buttons' em-dash asides; `worldSearchLabels.test.ts` green, `ChipTypeahead.test.tsx` pins that "Character" still finds Entity Name.
- [x] Comments in the listed files changed only when false, history-telling, or figurative (Q6). Two `builtinPlaceholders.ts` TSDoc lines and one `EntityEditorModal.tsx` comment that named the old terms.
- [x] Every test that pinned a changed string is updated. Old strings searched across `src/` and `e2e/`; affected suites green.
- [x] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed. No code bug was fixed in place.
- [x] No changelog fragment.

For you: Open the World Editor on Overview, an entity, a location, a stat and a dictionary entry, and read the field hints.

## Landed

**copy:sweep, ticket files (139):** 97 notices before, 66 after.

| Rule | Before | After |
|---|---|---|
| raw-hint-role | 40 | 17 |
| label-case | 23 | 22 |
| label-parenthetical | 15 | 13 |
| period-shape | 7 | 7 |
| uncontracted | 4 | 2 |
| raw-font-size | 2 | 2 |
| ellipsis | 2 | 2 |
| em-dash | 1 | 1 |
| definition-cadence | 1 | 0 |
| figurative | 1 | 0 |
| term-character | 1 | 0 |

**Triage of what remains**

- raw-hint-role: row captions ("Value 1", "Thresholds in", Openings and placeholder row headers), counts and percentages, the Regen "per" word, a value's own text, the uppercase "New Description" caption. None is help.
- label-case: case-only drift (Q5 nit).
- label-parenthetical: function calls inside template labels and a `(count)` value. No aside.
- period-shape: confirmation and dialog descriptions, a status line, and two hints split by `<b>` that the script reads as unfinished.
- raw-font-size: the Background and Foreground zone headers. A text role changes their size, which is out of scope.
- ellipsis: progress status ("Loading…").
- uncontracted: an Overview confirmation, and the "Worlds You Do Not Have" heading (label nit).
- em-dash: a connection tooltip that names its two ends. Not an aside.

**Drive-by corrections**

- `src/lib/worldSearch.ts`: the Find readout names follow the R11 readme rename.
- `src/lib/inventory/pass.ts`: two skip diagnostics read "nothing present is named" and "it is already at", in the technical register.
- The stat and trait Blueprints removal confirmations named a Remove button the dialog doesn't have. Both now say "this deletes".
- The dictionary delete confirmation said it can't be undone. The World Editor's undo and the library editor's unsaved changes both restore it.
- R14: every quote of the renamed labels follows them: `docs/Library.md`, `docs/Design-System.md` (Built-in Placeholder chips, Footer Actions), `FooterActionOrderReference.tsx` with its test, and the `EditorPreviewRollsContext.tsx` comment.

**In-place bug fixes:** none.

**Findings**

- Hints that sit after their control, against the Design System's Field help order: `ItemRequirementsField.tsx`, `WorldUpdateReviewDialog.tsx`, `ImportComponentModal.tsx`. Moving them is a layout change (R15).

**Sent to the spec session (other tickets' files)**

- Stale "Character Name" comments: `GamePanels.tsx` (ticket 06), `PromptChipsReference.tsx` (ticket 11), `PlaceholderField.tsx` (ticket 02).

**Not verified**

- No rendered read of the panels. The tests read the DOM; nobody looked at the screens.

**For you**

- Open the World Editor on Overview, an entity, a location, a stat and a dictionary entry, and read the field hints.
- Status lines that moved to Meta render one size smaller: an empty search in Add from Library and Openings, "No values", a descriptor's "covers" line, the export download progress.
