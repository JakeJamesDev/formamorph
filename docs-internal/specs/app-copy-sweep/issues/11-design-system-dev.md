# 11: Design System and Dev

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: reference screens; the copy must model the rules it shows.

## What to build

Sweep the copy of the design-system showcase and the dev screens under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- `src/components/design-system/`, `src/views/DesignSystemShowcase.tsx`
- `src/components/dev/`, `src/lib/dev/`, the `src/lib/dev*Sample*.ts` files

**Notes**

- A reference screen shows the pattern other screens copy. Its sample copy follows the rules exactly.
- `MainMenuContextMenuReference.tsx` shows "Delete Character" with a generic "cannot be undone" consequence. Use the term the real menu uses, and state the real consequence. `ConfirmDialog` now requires a description (ticket 01).
- The built-in chip is "Entity Name" (R10). Fix the `PromptChipsReference.tsx` comment that names "Character Name".

Spec: Rulings, "Per ticket", "Facts and bugs", Testing Decisions.

## Acceptance criteria

- [x] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words. Hand pass of every reference card, plus a standards and a spec review; facts checked against the rendered components.
- [x] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason. See Landed.
- [x] Raw help paragraphs in the listed files render through Hint or Meta. copy:sweep raw-hint-role 14 → 0.
- [x] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests. One rename: the "Stat Code Templates" heading; the showcase test and `e2e/design-system.spec.ts` updated, no Find bar caption names it.
- [x] Comments in the listed files changed only when false, history-telling, or figurative (Q6). One comment: "Character Name" → "Entity Name" in `PromptChipsReference.tsx` (R10).
- [x] Every test that pinned a changed string is updated. Grep of `src` and `e2e`; affected tests green in the review gates.
- [x] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed. No bug fixes.
- [x] No changelog fragment.

## Landed

**Not verified**

- Nothing unticked. The pages were not opened in the preview; the change is copy and Hint/Meta wrappers, and the affected tests render each reference.

**For you**

- Read the reference intros and their new bullet lists (R34) in the showcase at `/#dev?modal=designSystem`, one tab at a time.

**Copy:sweep counts** (the ticket's 60 files)

| Rule | Before | After |
| --- | --- | --- |
| period-shape | 39 | 21 |
| raw-hint-role | 14 | 0 |
| label-case | 12 | 12 |
| ellipsis | 8 | 0 |
| figurative | 3 | 1 |
| many-sentences | 2 | 0 |
| on-off-preamble | 1 | 1 |
| app-subject | 1 | 0 |
| em-dash | 1 | 1 |
| label-parenthetical | 1 | 1 |
| **Total** | **82** | **37** |

**Remaining notices**

- period-shape (21): sample data for author, player or staff text (stat and template descriptions, card descriptions, bylines, listing samples), specimen text ("The lanterns wake along the harbor."), and status lines and dialog descriptions, which take full sentences. One is a false positive: the Formaquestion Minimal Chrome hint ends with a period after a `<strong>` the script splits on.
- label-case (12): accessible names of sample regions and sample feedback titles; case-only (Q5) or user content (R6).
- on-off-preamble (1): a personal template's description, sample data (R6).
- figurative (1): "live sample" in a showcase tab description; "live" means updating as you change it, and R35 limits those lines to image verbs and wrong terms.
- em-dash (1): `devEventSample.ts` event blurb, staff content (R6, R31).
- label-parenthetical (1): `devPaneSamples.ts` template literal `slice(0, -1)`, a false positive.

**Drive-bys and corrections**

- "picture" → "image" and "the model" → "the AI" in the entity panel tab-body stand-ins.
- "Stat Code Templates" → "Code Templates" (the old "stat code" name).
- The Inventory Tab showcase description says "Status panel", the panel's name.
- `HeldUpdatesBar.tsx` statuses are full sentences.
- `MainMenuContextMenuReference.tsx` already says "Delete Entity" with the real menu's consequence (ticket 07); confirmed only.

**Findings**

- None.
