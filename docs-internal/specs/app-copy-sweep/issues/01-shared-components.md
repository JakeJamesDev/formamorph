# 01: Shared Components

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: shared strings appear on many screens, so each rewrite needs every caller's context.

## What to build

Sweep the copy of the shared components every screen uses under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- `src/components/` root files, except `AiSetupGate.tsx` (02) and `PatreonSection.tsx` (07)
- `src/components/ui/`
- `src/lib/UtilityComponents.tsx`, `src/lib/messageSeverity.ts`

**Notes**

- This ticket owns shared strings (Q12). Other tickets send shared-string problems to the spec session, which forwards them here while this ticket runs.
- A shared string reads correctly on every screen that renders it. Check each caller before you rewrite.

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

For you: Open a few screens that use the swept shared components (Settings rows, a confirm dialog, the error details dialog) and read the help text.
