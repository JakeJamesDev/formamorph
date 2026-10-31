# 05: Scripts and Tools

Status: ready-for-agent
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

- [ ] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words.
- [ ] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason.
- [ ] Raw help paragraphs in the listed files render through Hint or Meta.
- [ ] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests.
- [ ] Comments in the listed files changed only when false, history-telling, or figurative (Q6).
- [ ] Every test that pinned a changed string is updated.
- [ ] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed.
- [ ] No changelog fragment.

For you: Open a script box, hover a few completions, and open **Templates**; read the descriptions.
