# 10: Formaquestion

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a small surface, but the guide's own voice must match its answers.

## What to build

Sweep the copy of the Formaquestion window and its settings under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- `src/components/formaquestion/`, `src/lib/formaquestion/`, `src/lib/surface/`

**Notes**

- Prompt text sent to the help model is out of scope. Sweep only the copy a player reads.
- The Settings tab is **Endpoints**, not "AI Endpoints". Fix the name in `formaquestionSettingsTabs.ts`, and in the comment in `src/lib/imageEndpointPresets.ts` (unassigned, so it's yours).

Spec: Rulings, "Per ticket", "Facts and bugs", Testing Decisions.

## Acceptance criteria

- [x] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words. Read against the code (chatChrome, Formaquestion layout, helpWorldRules); DOM read of the General tab and its new Chat Style ⓘ.
- [x] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason. See Landed.
- [x] Raw help paragraphs in the listed files render through Hint or Meta. copy:sweep raw-hint-role 6 → 0.
- [x] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests. No label renamed.
- [x] Comments in the listed files changed only when false, history-telling, or figurative (Q6). One: the `imageEndpointPresets.ts` tab name.
- [x] Every test that pinned a changed string is updated. Grep of every old string across `src/` and `e2e/` tests; `searchNaming.test.ts` updated.
- [x] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed. No code bug fixed.
- [x] No changelog fragment.

For you: Open Formaquestion, its guide reader and its settings tabs, and read the help text.

## Landed

**Not verified**

- None.

**For you**

- Open Formaquestion, its guide reader and its settings tabs, and read the help text.
- Formaquestion Settings → General: the new **Chat Style** ⓘ defines Bubble (R36).

**Drive-by corrections**

- `docs/Design-System.md` floating window: the More Actions menu lists Chat Style **Auto, Minimal, Full** and Mascot Position **Above, Below, Inside, Outside**; Bubble offers only Inside and Outside (was: a Bubble item, Beside/Below/Auto, and "bubble chrome leaves out Mascot Position").
- `docs/Formaquestion-Settings.md` Mascot, Chat Style and Mascot Position rows, and `docs/Formaquestion-Mascot.md` Reset tooltip, follow the new app lines.
- The Mascot hint said "with a bare chat column"; the Mascot shows beside every chat style except the mobile sheet.

**In-place bug fixes:** none. **Findings:** none. **Shared strings sent to the spec session:** none (Reasoning ⓘ keeps Settings' "**Model Default** sends no hint" wording).

**copy:sweep** (`src/components/formaquestion`, `src/lib/formaquestion`, `src/lib/surface`, `src/lib/imageEndpointPresets.ts`): 25 → 19.

| Rule | Before | After | Remaining, why |
|---|---|---|---|
| raw-hint-role | 6 | 0 | |
| period-shape | 6 | 6 | Tool and parameter descriptions sent to the help model: prompt text (R26) |
| label-parenthetical | 4 | 4 | Resolved preset name and Locked state suffix: data (ticket ruling 2) |
| ellipsis | 3 | 3 | "Loading the guide…" status lines while loading |
| uncontracted | 3 | 2 | "The guide did not load" and "This section is not in the guide": status lines keep their voice |
| on-off-preamble | 2 | 3 | Each names the Mascot switch's state, not its own control's |
| label-case | 1 | 1 | False positive: a class string in `EdgeTab.tsx` |
