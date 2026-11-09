# Spec: Overview Right Tabs

Status: ready-for-human

## Problem Statement

The World Editor's Overview tab puts all of the world's writing in one long right column: the Player-Facing Description, the Readme, the AI-Facing Description, and then Custom Prompts. Custom Prompts is one picker that holds four unlike things. Three are system prompts (Narration, Choices, Stat Updates). The fourth, Openings, is not a prompt at all: it is the player's first message. An author looking for the openings has to know they live inside a section called Custom Prompts. An author writing a prompt has to scroll past the descriptions and the Readme to reach it. The picker also carries a lot of custom chrome (deselect-to-close, a checkbox beside each item, pipe separators, a container-query grid) that exists only to keep four large fields out of one scrolling column.

## Solution

In Advanced mode, the right column becomes three tabs: **Details**, **Custom Prompts**, and **Openings**.

- **Details** holds what the column holds today above Custom Prompts: the Player-Facing Description, the Readme with its Introduction and Gameplay sub-tabs, and the AI-Facing Description.
- **Custom Prompts** has its own sub-tabs, Narration, Choices, and Stats, with one always selected. Each prompt panel opens with a checkbox that turns that prompt on or off, then the prompt field, then the note-and-Reset footer.
- **Openings** opens with a checkbox that turns the world's openings on or off, then the openings panel as it is today.

In Simple mode, the column shows no tab strip. It shows the Details content exactly as Simple mode shows today.

The editor remembers the right-column tab and the prompt sub-tab for the editing session. Find and undo/redo open whichever tab and sub-tab hold the field they go to.

## User Stories

1. As a world author, I want the world's openings on their own tab, so that I find them without knowing they were filed under Custom Prompts.
2. As a world author, I want the custom prompts on their own tab, so that I reach them without scrolling past the descriptions and the Readme.
3. As a world author, I want the descriptions and the Readme on a Details tab, so that the text players and the AI read about my world sits together.
4. As a world author, I want the Details tab to be the one I see first, so that the fields every world needs come before the optional ones.
5. As a world author, I want to switch between Narration, Choices, and Stats with sub-tabs, so that I edit one prompt at a time without a long scroll.
6. As a world author, I want one prompt sub-tab always selected, so that the Custom Prompts tab never shows an empty panel.
7. As a world author, I want Custom Prompts to open on Narration the first time, so that the tab always starts in the same place.
8. As a world author, I want a switch at the top of each prompt panel, so that I turn that prompt on or off where I am editing it.
9. As a world author, I want switching a prompt off to keep its text, so that a stray click costs me nothing.
10. As a world author, I want switching a prompt on to keep me on that panel, so that I can start editing at once.
11. As a world author, I want the prompt panel to show the active preset's prompt until I edit it, so that I start from something that works.
12. As a world author, I want Reset to stay in the prompt's footer and appear only for text I stored, so that I can drop back to tracking the preset.
13. As a world author, I want a switch at the top of the Openings tab, so that I turn the world's openings on or off where I edit them.
14. As a world author, I want the Openings switch disabled until my world has an opening, so that I cannot set a flag that reads off again.
15. As a world author, I want the Openings group headers to keep opening the entity's or location's Openings tab, so that I can jump to where an opening lives.
16. As a world author in Simple mode, I want no tab strip, so that the column looks the way it does today without a strip of one tab.
17. As a world author, I want the editor to remember which right-column tab I had open when I leave Overview and come back, so that I return to where I was working.
18. As a world author, I want the editor to remember which prompt sub-tab I had open, so that coming back to Custom Prompts returns me to the same prompt.
19. As a world author, I want the remembered tab to last only for this editing session, so that nothing about my editor layout is saved into the world.
20. As a world author, I want Find to open the right tab and sub-tab for a match in a prompt or an opening, so that the match is on screen when Find lands on it.
21. As a world author, I want Find to open the Details tab for a match in a description or the Readme, so that a match there is never hidden behind another tab.
22. As a world author, I want undo and redo to open the tab and sub-tab where the edit was made, so that I see what changed.
23. As a world author, I want an undo of an edit made on a tab that Simple mode does not offer to land on Details, so that undo never leaves me on a hidden tab.
24. As a world author, I want the tabs to look like the editor's other tabs, so that the column reads as part of the same app.
25. As an author using the help window's Take Me There, I want a link to Custom Prompts or Openings to open that tab, so that I land on what the help describes.
26. As a world author with existing worlds, I want my prompts, their on/off state, and my openings unchanged, so that the new layout changes nothing about how my world plays.

## Implementation Decisions

- **Rulings.** Q1: Simple mode hides the tab strip. Q2: Custom Prompts uses sub-tabs with one always selected; the toggle-group picker is removed. Q3: each prompt panel and the Openings tab carry their own switch at the top; no checkbox sits on any tab. Q4: the first tab is named Details. Q5: no tab or sub-tab shows an on-state marker. Q6: the editor remembers the last right-column tab for the editing session, not in the world. Q7: Custom Prompts opens on Narration the first time. Q8: the World Editor bench is the one test seam.
- **Scope of the module change.** The Overview details manager splits its column into the three tabs. The Custom Prompts section loses the toggle group, the deselect-to-close behavior, the pipe separators and the container-query grid. The Openings panel itself is unchanged; it moves to its own tab and gains the switch above it.
- **Overview state.** The editor holds two values: the right-column tab (Details, Custom Prompts, Openings) and the prompt kind (Narration, Choices, Stats). The "no panel open" state goes away, because some tab is always shown and one prompt kind is always selected. The overview-panel module's type and its history helpers change to match.
- **History Origins.** A Step's Origin on Overview records the place the author saw: Details for the descriptions and the Readme, the prompt kind for a prompt edit, and Openings for an opening. Reveal maps that value back onto both the tab and the prompt kind. A value the mode does not offer falls back to Details, as other tabs fall back to their first sub-tab. Editor history is session-only, so the old "none" value needs no compatibility path.
- **Find.** The editor sets the outer tab when Find navigates to an Overview hit, once per navigation, so a remount never replays an old hit over the remembered tab. A prompt field key opens Custom Prompts on that kind. An opening field key opens Openings. A description or Readme key opens Details, and the Readme's own sub-tab logic keeps working inside it.
- **Simple mode.** Custom Prompts and Openings stay Advanced only. With no strip, Simple mode renders the Details content directly.
- **Switch behavior is today's.** Prompt off clears only the enabled flag and keeps the text. Openings on/off writes the same world flag as today, and the switch stays disabled while the world has no authored opening.
- **Design.** The tabs and sub-tabs reuse the app's existing tab component and the entity-panel tab pattern. The on/off control is the editor's labeled checkbox (“Use This Prompt”, “Use These Openings”); the app has no switch component, and the prompt field stays visible while off, as today. No new visual pattern is introduced.
- **Copy.** The tab names are Details, Custom Prompts, Openings, Narration, Choices, Stats. Stats is the label players already see for that prompt. The switch labels and any hint text are written per the Writing Guide at build time.
- **Take Me There.** The `custom-prompts` target was a help-window surface target, not a tour step. It is replaced by a `worldEditorOverview` tab ledger (Details, Custom Prompts, Openings), so help routes open the right tab; the Openings guide's route points at the Openings tab.
- **Dev-router.** The World Editor's dev route reaches each right-column tab, so the UI can be verified per tab.
- **Export shape.** No change to the world or save `.json`. The remembered tab is editor state only.

## Testing Decisions

- **One seam: the World Editor bench.** Every test drives the real editor through the bench and reads what is on screen. No test reaches into the manager's internal state.
- **A good test here** asserts what the author sees: which tab is selected, which labels the right pane shows, whether a switch is checked or disabled, and what a field holds after an edit. It never asserts on component props or the history entry's shape.
- **What to cover.**
  - Advanced mode shows the three tabs, and each tab's label list is exact (the existing per-column label-list test becomes per tab).
  - Simple mode shows no tab strip and the Details labels.
  - Custom Prompts opens on Narration, and one sub-tab is always selected.
  - A prompt switch turns the prompt off and keeps its text; turning it back on restores the same text.
  - The Openings switch is disabled with no authored opening and enabled once one exists.
  - Leaving Overview and coming back keeps the right-column tab and the prompt sub-tab.
  - Find on a prompt match, an opening match, and a Readme match each lands on the right tab and sub-tab.
  - Undo of a prompt edit made on Custom Prompts, from the Details tab, reopens Custom Prompts on that kind.
- **Guards must bite.** For the reveal and Find cases, reinstate the bug (do not set the outer tab) and confirm the test fails.
- **Prior art.** The World Editor Overview panel test (label lists per pane, Find cases) and the editor undo/history reveal tests on other tabs' sub-tabs. The Overview bench tests of the details manager move to the editor bench or are kept only where they still pass unchanged.

## Out of Scope

- The Overview tab's left column (identity and listing fields). The user named it as a later step.
- Any change to what a custom prompt or an opening does in play.
- An on-state marker on any tab (Q5).
- Saving the tab choice into the world or into settings (Q6).
- Any new prompt kind or a change to which system prompts a world can replace.

## Further Notes

- The Readme keeps its own Introduction and Gameplay sub-tabs inside Details, so Details nests one tab set and Custom Prompts nests another. This is accepted.
- In the editor, the entities and locations already have an Openings tab, so the world's Openings tab uses the same name for the same thing.

## Landed

Verified by the editor-bench suite `WorldEditor.overviewPanel.test.tsx` (tabs per mode, prompt sub-tabs, both checkboxes, remembered tab, Find to each tab, no replay on remount) and `WorldEditor.historySubView.test.tsx` (undo to Details, a prompt kind, Openings). Find, reveal, the Openings disable and the remount replay were each mutation-tested: the right test went red. Live preview at 1024×768 and 375×812: frames below.

**Not verified**
- Take Me There from the help window into the new tabs, end to end: the route tables are unit-tested, the click-through is not.
- The Playwright helper in `e2e/app.ts` was updated but not run; the e2e suite sits outside the gates.
- Light theme: no colors changed, so it was not checked.

**For you**
- Open a world in Advanced mode and look at the three tabs: `.scratch/overview-right-tabs/frames/details.jpg`, `custom-prompts.jpg`, `openings.jpg`.
- The changelog's unreleased line "An Overview edit with no prompt panel open closes the panel" is now stale. It is fixed on main after this lands.
