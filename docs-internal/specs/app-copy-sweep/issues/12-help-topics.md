# 12: Help Topics

Status: done
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
- The Memory pin control is "Clear the Pin and Let the Story Decide" (R12). Quote that name.
- Leftovers from landed tickets, yours to fix:
  - The memory row tooltips "Sent as a full scene last turn" and "Sent to the story last turn" mean the AI. Write what the AI receives, the same in `MemoryManagerModal.tsx` and `MemoryPanel.tsx`.
  - `ModelDetailsPanel.tsx`: a TSDoc still names the "character-customization step" (R21).

Spec: Rulings, "Per ticket", "Facts and bugs", Testing Decisions.

## Acceptance criteria

- [x] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words. Each topic rewritten from its swept page; alias and stranger facts checked in `entityMatch.ts` and `playerView.ts`; standards and spec reviews folded in.
- [x] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason. See Landed.
- [x] Raw help paragraphs in the listed files render through Hint or Meta. The listed files hold data only; `MarkdownModal` and `TutorialNote` (ticket 01) render them.
- [x] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests. No label changed; tutorial titles and topic tabs stay.
- [x] Comments in the listed files changed only when false, history-telling, or figurative (Q6). Three figurative comments in `tutorials.ts`.
- [x] Every test that pinned a changed string is updated. Grep of `src/` and `e2e/` for each old string: no pins; review gates green.
- [x] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed. No code bug fixed.
- [x] No changelog fragment.

For you: Open the help pop-out on a few editor sections and on the game screen, and compare each to its wiki page.

## Landed

**Sweep counts** (`npm run copy:sweep` on the three listed files): 102 before, 42 after.

| Rule | Before | After |
|---|---|---|
| long-sentence | 29 | 7 |
| em-dash | 22 | 9 |
| popover-block | 20 | 7 |
| figurative | 7 | 2 |
| term-character | 6 | 1 |
| filler | 6 | 0 |
| uncontracted | 4 | 3 |
| ellipsis | 2 | 5 |
| exclamation | 2 | 0 |
| label-case | 2 | 2 |
| on-off-preamble | 1 | 1 |
| definition-cadence | 1 | 1 |
| app-subject | 0 | 4 |

**Triage of what remains**

- em-dash (9), popover-block (7), long-sentence (3 of 7): markdown tables read as one paragraph, plus the quoted memory stamp *Day 3, evening — two days ago*.
- long-sentence (other 4): help-topic prose, one topic each; two copy their page's sentence word for word.
- ellipsis (5): quoted labels that end in "…" (**Add From Library…**, **Save Connections…**) and the quoted narration "The alpha…".
- app-subject (4): "the game" is the presence detector in play; the close prompt is a confirmation.
- uncontracted (3): "as it is" idiom and quoted labels.
- figurative (2): example actions ("the fire", "ride off") are player text.
- label-case (2): "Simple vs. Advanced" is a title, case only (Q5).
- on-off-preamble, definition-cadence, term-character (1 each): another setting's state; a defined term (**linked copy**); the **Characters** section name (R2).

**Drive-by corrections**

- Memories topic said "Nothing you do here is permanent". **Reset All My Changes** deletes your own memories and can't be undone; the topic now says so.
- Scripts topic said `player` exists "in every other timing", which included the item timings. It now names the four timings.
- Leave prompts drop "Are you sure…?" and state the consequence.
- `Formaquestion.codeInsert.test.tsx` pinned the old Insert tooltip ("a stat's Code tab"), red on main since 585db2158 changed it to "Scripts tab". The pin now matches the code.
- Memory row tooltips name the AI; `docs/Memory.md` "Kept vs Sent" quotes the new string (R14, spec-session ruling).

**Findings** (pages leave out facts the topics keep, R37; pages not edited)

- World-Editor-Traits "Placeholder Pins" leaves out chip pins, blueprint pins and the rank order.
- World-Editor-Traits "Stat Changes" leaves out that the AI never reads them.
- World-Editor-Entities "Names and aliases" leaves out that every alias is prompt text.
- World-Editor-Placeholders "Pins" leaves out that within one kind the lower source in its list wins, and that a row's first box moves the pin.
- World-Editor-Entities "Strangers" says the AI tracks a stranger's other name "while it plans the scene". "Plans" is a pipeline word; the topic drops the clause.

**Not verified**

- Nothing unticked. The topics were not opened in the browser.

**For you**

- Open the help pop-out on a few editor sections and on the game screen, and compare each to its wiki page.
