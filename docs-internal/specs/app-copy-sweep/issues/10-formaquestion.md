# 10: Formaquestion

Status: ready-for-agent
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

- [ ] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words.
- [ ] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason.
- [ ] Raw help paragraphs in the listed files render through Hint or Meta.
- [ ] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests.
- [ ] Comments in the listed files changed only when false, history-telling, or figurative (Q6).
- [ ] Every test that pinned a changed string is updated.
- [ ] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed.
- [ ] No changelog fragment.

For you: Open Formaquestion, its guide reader and its settings tabs, and read the help text.
