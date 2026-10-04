# 06: Docs line and end-to-end sweep

Status: done
Blocked by: 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The guide describes the button, and Playwright proves the jump.

- The Formaquestion guide page gains a short description of Take Me There, in the docs voice. Because a docs edit can move the AI Picks list, the recall probe runs once after and the Answer reports it.
- Playwright: one jump from an answer to a Settings tab, and one refused jump from a running game that leaves the game untouched.
- A changelog line in 🚧 In Progress.

Spec: Testing Decisions → Playwright.

Recommended model rationale: a docs paragraph and two e2e cases on a finished feature.

## Acceptance criteria

- [ ] The guide page describes the button; the recall probe number is in the Answer.
- [ ] Both Playwright cases pass.
- [ ] The changelog line is present.
- [ ] The four gates are green.

## Answer

- The guide's Formaquestion page has a new how-to, "How to Go to the Screen an Answer Describes" (route `formaquestion.ask`), and a **Take Me There** bullet in the Ask section.
- Playwright, both in `e2e/formaquestion.spec.ts` (desktop project): one jump from an answer to the Settings Display tab with the window left open, and one refused jump from a running game. The refusal case clicks Cancel on the Exit to Main Menu prompt, checks the typed action and the game screen are unchanged, then clicks again to prove no request stayed pending. Mutation checks: with the game's leave check disabled, the game case fails at the missing prompt; with `answerRoute` forced to null, the jump case fails. Both restored.
- The first source on a main-menu answer is the open screen's lead, so the case asserts the lead is first and the jump comes from the next source (Q37).
- Changelog line added as its own entry under Help and Wiki. The Formaquestion entry shows as four near-identical bullets (lines 21 to 24 of `docs/Changelog.md`), a union-merge duplication from earlier tickets that this ticket leaves alone.

**Recall probe** (cloud, `shipped` arm, 5 runs, 191 questions, 507 headings, 0 failed requests):

| Set | Recall@5 after ticket 03 | Recall@5 now |
|---|---|---|
| known | 84.3% (82.5–85.6) | 84.5% (83.5–85.6) |
| blind | 89.8% (88.3–91.5) | 87.2% (85.1–88.3) |

The known set did not move. The blind set is 2.6 points lower, and its interval touches the old one at 88.3%. The pick request grew from 506 to 507 headings, and the commit that routed the RPG Classes walkthrough landed between the two runs, so the drop is not attributable to this docs section alone. No control run on the old docs was made. The cloud drifts between batches. Report: `testing/baseline/runs/help-recall-2026-10-04T17-26-43-452Z.md`.
