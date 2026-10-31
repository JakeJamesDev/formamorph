# 02: Settings and AI Setup

Status: ready-for-human
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

- [x] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words. Hand pass on every file; facts checked in code (diary trigger, `%prefix%`, tab names, Advanced-only rows, bundled world list). Standards and Spec reviews folded in.
- [x] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason. See Landed.
- [x] Raw help paragraphs in the listed files render through Hint or Meta. Three raw spans remain, triaged under Landed.
- [x] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests. Font and provider options (R3), Memory manager pin tooltip (R13), InvokeAI board fallbacks. None is a Find caption (`worldSearchLabels` covers the World Editor only); tests grepped and updated.
- [x] Comments in the listed files changed only when false, history-telling, or figurative (Q6). Fixed: two "AI Endpoints", "Presentation", two history notes in OutputSettingsSection, promptGroups header, localModels, MemoryManager tip comment, textEndpointEditorModel (R12).
- [x] Every test that pinned a changed string is updated. ImageSetupGuide, MemoryManagerModal.search, SettingsModal.mode, DesignSystemShowcase, GameViewer.memoryVerdicts.
- [x] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed. No code bug fixes; all fixes are copy.
- [x] No changelog fragment.

For you: Open **Settings** on each tab and read the brief lines and ⓘ bodies.

## Landed

**Sweep counts** (`copy:sweep` on the ticket's files, CodeArea and codeQuickFix out per R4): 157 → 87.

| Rule | Before | After | Why the rest stays |
|---|---|---|---|
| raw-hint-role | 40 | 3 | Two are "Preset" labels beside a select (SettingsModal Tools tab, PresetHeader), not help. VariableMenu's detail span needs a `ref`, which `Meta` does not forward |
| label-case | 25 | 24 | Case-only drift is a nit (Q5) |
| period-shape | 20 | 10 | JSX splits the sentence across lines (7 false positives); two status lines and a model-only Tool description (`reasoningEffort.ts`, prompt text) keep their periods |
| raw-font-size | 17 | 16 | Badge and counter sizes in MemoryManagerModal, chip and palette sizes in prompt/: typography change, not copy (Findings) |
| term-character | 15 | 16 | All R2 pipeline features; the count rose with the added staged-detail names |
| em-dash | 12 | 2 | The Time in Memory example quotes the real stamp format; the chip tooltip uses the `Name — hint` form |
| label-parenthetical | 12 | 8 | "(default)" and NovelAI names stay (R3); reveal options stay, Narration Reveal has no ⓘ to carry them (R3); `Rename ${label}` is a template, not an aside |
| ellipsis | 7 | 4 | In-progress statuses and the share-code sample placeholder |
| figurative | 3 | 0 | |
| long-sentence | 3 | 1 | False positive: the script reads the `\n\n` escape as one sentence |
| on-off-preamble | 1 | 1 | Names another control's state (skill triage) |
| filler | 1 | 0 | |
| definition-cadence | 1 | 0 | |
| uncontracted | 0 | 1 | Confirmation body: "stay as they are" (skill triage) |
| many-sentences | 0 | 1 | Numbered step in the LLM setup guide, extended help |

**Drive-by corrections** (copy that was false against the code)

- The prompt Endpoint ⓘ named an "AI Endpoints" tab; the tab is **Endpoints**
- Restore Default Worlds named three of the eight bundled worlds; the body no longer lists names
- The Character Diaries ⓘ said diaries are written "as turns age out"; they are written after each turn
- The ComfyUI workflow guide's token list lacked `%prefix%`
- The NovelAI guide sent the reader to "API Token above" from a dialog with nothing above
- The installed-models empty state printed literal backticks around `.gguf`
- New: the Provider row has an ⓘ, since its options dropped "(local)" and "(cloud)"; both font rows share a ⓘ naming each accessibility font, pinned in `settingsCopy.test.ts`

**Shared strings sent to the spec session:** the "AI Endpoints" text in formaquestionSettingsTabs.ts (R12, ticket 10); the pin tooltip in MemoryPanel.tsx and helpTopics.ts (R13, tickets 06 and 12); the Settings mode lines kept for parity with editorMode.ts.

**Findings**

- Raw pixel font sizes (`text-[9px]` to `text-[11px]`) in MemoryManagerModal badges and counters, PlaceholderPaletteBar and PromptField. Moving them to text roles changes the layout, which the spec leaves out
- `src/lib/imageEndpointPresets.ts:13` has an "AI Endpoints" comment; the file is not in this ticket

**Not verified**

- No rendered check in the preview. The Standards review flagged two size shifts from the role swaps: the preset import error (`text-label` → `FieldError`) and the avatar license line (`text-[11px]` → `Meta`)

**For you**

- Open **Settings** on each tab and read the brief lines and ⓘ bodies.
- Open **Endpoints → Text** with the desktop engine and read **Manage Models…** (all three tabs) and the setup gate.
- Open the Memory manager in a game with **Memory Summaries** off and read the notice.
