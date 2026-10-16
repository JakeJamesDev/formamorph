# 08: Owner Wording in the Editor and Design System

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: copy and showcase changes, checked with `copy-sweep`.

## What to build

The editor says owner.

- The requirement picker's **Same Bearer** becomes **Same Owner**. The persona stays **You** (Q4).
- "Search bearers" becomes "Search owners".
- The `owner` code global's info line drops the exception wording.
- The Link panel, Detach and Overrides say **Own** or **Linked** where they read otherwise today (Q3).
- The Design System's flyouts become Owner Flyouts, in the showcase and on its docs page.
- Call sites in these files move to the owner names.
- Fold a line into the rename changelog entry.

Spec: Q3, Q4; stories 2, 3, 8, 11, 14.

## Acceptance criteria

- [ ] The picker shows **Same Owner** and **You**
- [ ] Search, info line, Link panel, Detach and Overrides use the new words
- [ ] The showcase and Design System page say Owner Flyouts
- [ ] `copy-sweep` run on the changed labels; verified with `verify-ui`; four gates green

## Blocked by

- 02
