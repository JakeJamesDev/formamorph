# 12: Help Topics

Status: ready-for-agent
Blocked by: None (can start immediately)
Waits for: every docs-sweep wording ticket (02, 04, 06, 08, 10, 12, 14, 16, 18, 20 of that spec)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: every topic must state the same facts as its swept wiki page.

## What to build

Sweep the copy of the help pop-out topics, tutorials and leave prompts under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- `src/lib/helpTopics.ts`, `src/lib/tutorials.ts`, `src/lib/leavePrompts.ts`

**Notes**

- Waits for every docs-sweep wording ticket to land (Q7). The spec session proposes this ticket only then.
- Copy each fact from the docs page that owns it. A help topic and its page state the same fact in the same words.
- A help topic is extended help: short paragraphs or bullets, not hint-shaped lines.

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

For you: Open the help pop-out on a few editor sections and on the game screen, and compare each to its wiki page.
