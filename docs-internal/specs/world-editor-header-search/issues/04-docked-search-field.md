# 04: Docked Search Field

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: splits the find bar into two layouts and owns the focus, shortcut and lazy-collection rules; subtle state and many tests.

## What to build

On desktop, the app bar's center is a **Search World** field. It searches as you type, with no Find to open first. It holds a search icon, the field, a match counter, Previous Match and Next Match. Enter and Shift+Enter step through matches. Ctrl+F focuses the field. This ticket has no expand button; ticket 05 adds it.

The find bar gains a docked layout beside its floating one; matching, navigation and the match marker are shared. The floating layout stays for mobile.

Rules (from the spec's Implementation Decisions):
- Search targets are collected only while the docked query has text.
- Find's open state is mobile only: on desktop, Ctrl+F never sets it, so resizing to mobile does not mount the floating bar.
- The docked field never takes focus on mount.
- Ctrl+F records the control focused before it, unless focus was already in the search. Escape clears the search and the match marker, then returns focus to that control when it is still connected; otherwise focus stays in the cleared field. The recorded control is dropped on Escape and when focus leaves the search.
- Accessible names: the field "Search World"; "Previous match", "Next match" unchanged.

The Test Bench moves from the center to the right: Mode Select, divider, world actions, Test Bench, Save. The Take Me There `find-button` target names the docked field on desktop. The Surface App Bar pattern's center-line rule and composition line change to the search field and the Bench's new place.

Changelog fragment: the lead for the effort, e.g. **The World Editor's header has a search field: type to search the whole world.**

From the prototype branch `prototype/editor-header-search` (commit `9fae1fb0`, variant B's collapsed field).

## Acceptance criteria

- [ ] Typing in Search World navigates to the first hit and shows the counter; the arrows and Enter/Shift+Enter step.
- [ ] An empty field collects no search targets, proven by a test that fails when collection is made eager.
- [ ] Ctrl+F focuses the field; the field does not take focus when the editor opens.
- [ ] Escape after Ctrl+F returns focus to the earlier field; Escape after a click leaves focus in the cleared field.
- [ ] Resizing to mobile with a desktop search active does not open the floating bar.
- [ ] The Bench sits between the world actions and Save; the Take Me There landing test follows the new target.
- [ ] The find-focus tests cover the docked field in place of the old header button.
- [ ] Four gates green; verified at desktop width in both themes.
