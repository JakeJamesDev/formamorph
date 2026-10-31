# 02: Settings and AI Setup

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: second pass on the most-read screen, under the newest rules and the copy guard.

## What to build

Sweep the copy of the Settings modal and the AI setup screens under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- Settings: `SettingsModal.tsx`, `settingsCopy.ts`, `settingsTabs.ts`, `DisplaySettingsSection.tsx`, `OutputSettingsSection.tsx` in `src/components/modals/`
- AI setup: `LocalModelModal.tsx`, `LocalModelPanel.tsx`, `ModelDetailsModal.tsx`, `ModelDetailsPanel.tsx`, `MemoryManagerModal.tsx`, `EndpointRouteField.tsx`, `TextEndpointEditor.tsx`, `SamplerControl.tsx`, `PresetShareDialogs.tsx`, `RequestAnatomyPanel.tsx`, `PromptNavigationRail.tsx`, `LlmSetupGuide.tsx`, `ImageSetupGuide.tsx`, `ComfyWorkflowGuide.tsx` in `src/components/modals/`
- `src/components/AiSetupGate.tsx`, `src/components/presetHeader/`
- `src/components/prompt/`, except `CodeArea.tsx` and `codeQuickFix.ts` (05)
- `src/contexts/settingsDefaults.ts`, and in `src/lib/`: `promptGroups.ts`, `promptVariables.ts`, `reasoningEffort.ts`, `reasoningDialect.ts`, `settingsMode.ts`, `narrationRevealConfig.ts`, `localModels.ts`, `chipVocabulary.ts`, `presetHeaderActions.ts`, `imageGen/`

**Notes**

- Settings was swept on 2026-10-26, before "Before you write". Read the copy table again from the facts list, not from the last sweep (Q3).
- The settings copy guard pins the period rule and the 12-word ceiling. Keep it green; update its table when a string changes.

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

For you: Open **Settings** on each tab and read the brief lines and ⓘ bodies.
