# 03: World Editor Panels

Status: ready-for-agent
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

- [ ] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words.
- [ ] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason.
- [ ] Raw help paragraphs in the listed files render through Hint or Meta.
- [ ] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests.
- [ ] Comments in the listed files changed only when false, history-telling, or figurative (Q6).
- [ ] Every test that pinned a changed string is updated.
- [ ] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed.
- [ ] No changelog fragment.

For you: Open the World Editor on Overview, an entity, a location, a stat and a dictionary entry, and read the field hints.
