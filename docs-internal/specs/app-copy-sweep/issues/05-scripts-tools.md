# 05: Scripts and Tools

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: hand pass in the technical register; the script does not read most of these surfaces.

## What to build

Sweep the copy of the script and World Tools surfaces under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- In `src/lib/`: `statCodeSurface.ts`, `statCodeTemplates.ts`, `statCodeAnalysis.ts`, `statCodeVariableTree.ts`, `worldScriptTemplates.ts`, `worldToolTemplates.ts`, `codeCards.ts`, `codeSnippets.ts`, `revealTestScripts.ts`, `tools/`
- In `src/components/modals/`: `StatCodeTemplateDialog.tsx`, `ToolEditor.tsx`, `ToolTryIt.tsx`, `ToolsTab.tsx`, `toolsView.ts`
- `src/managers/ScriptBox.tsx`, `ScriptsSection.tsx`, `ItemScripts.tsx`, `TraitScripts.tsx`
- `src/components/prompt/CodeArea.tsx`, `codeQuickFix.ts`

**Notes**

- Everything here takes the technical register. Use the term table in the Writing Guide: overwrite, set, pin, switch, ignored, read-only, resolves to, persists, clears, applies, skipped.
- The copy:sweep script skips `statCodeSurface.ts` and comments. Sweep those by hand; this pass is required.
- The code guide and hover cards read script help. Check the code-surface copy tests after each change.

Spec: Rulings, "Per ticket", "Facts and bugs", Testing Decisions.

## Acceptance criteria

- [x] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words. Hand pass plus a Standards and a Spec review; facts checked in code (lookup matching, Reply default, Try It blank args, trait script gate).
- [x] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason. See Landed.
- [x] Raw help paragraphs in the listed files render through Hint or Meta. copy:sweep raw-hint-role 11 → 0.
- [x] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests. One change: Try It's `name (optional)` label (R25); no test or Find caption named it.
- [x] Comments in the listed files changed only when false, history-telling, or figurative (Q6).
- [x] Every test that pinned a changed string is updated. Searched the test files for each old string; affected-test gate green.
- [x] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed. `statCodeAnalysis.test.ts` "names each script home with its article".
- [x] No changelog fragment.

## Landed

**Drive-by corrections**

- Surface labels gain their article ("a stat script", "an item script"), so an unknown-name error no longer reads "isn't available in stat script". Test: `statCodeAnalysis.test.ts` "names each script home with its article".
- The Dictionary Entries lookup hint said it matches dictionary names. The lookup matches entry names and Trigger Keywords; the hint now says so.
- The Discover an Entity template said "the turn's cast", a pipeline word; it now says "the turn".

**copy:sweep counts (ticket files)**

| Rule | Before | After |
|---|---|---|
| label-case | 19 | 19 |
| period-shape | 17 | 4 |
| raw-hint-role | 11 | 0 |
| uncontracted | 7 | 2 |
| em-dash | 6 | 5 |
| on-off-preamble | 5 | 6 |
| popover-block | 4 | 0 |
| figurative | 3 | 0 |
| many-sentences | 3 | 0 |
| filler | 2 | 0 |
| term-character | 1 | 1 |
| ellipsis | 1 | 0 |
| label-parenthetical | 1 | 0 |
| **Total** | **80** | **37** |

Remaining notices:

- label-case (19): surface labels and Variable-menu field names are data ("a stat script", `notes`, `memories[0]`); reveal profile labels are dev-only (R8); "Max Calls per Request" is AP-correct; the rest are case-only nits (Q5). "View full screen" is also the focus-return key of the full-screen shell.
- on-off-preamble (6): boolean field definitions ("True when the stat is on") and lines that name another control's state.
- em-dash (5): reveal profile descriptions, never rendered (R8).
- period-shape (4): `rollTool.ts` is prompt text (R26); the other three split on JSX or a closing quote and are well formed.
- uncontracted (2): "stays where it is" has no contraction; the delete confirmation keeps its own voice.
- term-character (1): "character codes" is the JavaScript term, not an entity.

**Findings**

- `docs/ScriptsGuide.md` still says `player.tell` "stays with the turn ... and never reaches the AI"; the surface now says "persists with the turn, and the AI never gets it". Docs Sweep owns the page.
- "Reach" stays in comments where it means access, not a name lookup; only lookup uses moved to "resolves to".
- Two Tool surfaces (`toolScriptSurface.ts`, `worldToolSurface.ts`) each carry the same missing-return string and `args` info line. A shared constant would keep them in step.

**Not verified**

- The rendered dialogs were not opened in a preview; the component tests that render them passed.

**For you**

- Open a script box, hover a few completions, and open **Templates**; read the descriptions.
