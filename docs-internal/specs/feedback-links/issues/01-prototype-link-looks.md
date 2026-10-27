# 01: Prototype Link Looks

Status: ready-for-agent
Type: prototype
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q20, Q21, Q16, Q18, Q22)

## What to build

A throwaway `/prototype` that shows each link form inside a real feedback thread, in both themes, so the user can settle Q20. Show the variants side by side in a comment body:

- Resolved `#N`: as typed with a hover card (title, type, status); `#N` plus the title inline; a titled chip.
- `@username` link, and the "unknown user" form.
- Listing chip (title, kind, thumbnail) and the unavailable chip.
- The unavailable form for a thread.

Use fixed fake data. Nothing ships from the prototype branch.

## Acceptance criteria

- [x] Each variant renders in a feedback thread view, light and dark, at desktop and mobile width. Frames: `.scratch/frames/links-<variant>-<theme>-<width>.png`. (24 Playwright frames; variants `all`, `thread-a-hover-card`, `thread-b-title-inline`, `thread-c-titled-chip`, `users`, `listings` × light/dark × desktop 1280/mobile 390.)
- [ ] The user's pick for Q20 and any look changes for the other forms are recorded in the spec's rulings.

For you: pick the `#N` look and approve the chip and unavailable forms from the prototype frames.

## Landed

**Prototype record**

- Question: how a resolved `#N` looks inline (Q20), plus the `@`, listing-chip and unavailable forms.
- Where: one labeled comment in the `feedbackThread` dev route, on the app's FeedbackThreadView. Labels: A Hover card, B Title inline, C Titled chip, Users, Listings. Each thread look shows its own unavailable form for `#57`.
- Code: uncommitted in the kept worktree `.claude/worktrees/prototype-feedback-links` (the ticket hook refuses commits on `prototype/feedback-links`). Patches and the capture script are kept with the frames: `prototype.patch`, `prototype-newfile.patch`, `frames.mjs`.
- Launch: `preview_start` name `prototype-feedback-links` (port 5262), then `__fmDev.goto('mainMenu', { modal: 'feedbackThread', fixture: 'feedback' })`.
- Frames: `.scratch/feedback-links-01/frames/`.

**Not verified**

- Criterion 2: the Q20 pick is the user's; the spec session folds it into the rulings.

**For you**

- Pick the `#N` look and approve the chip and unavailable forms from the prototype frames. Start with `links-all-light-desktop.png` and `links-all-dark-mobile.png`.
- A hover card has no hover on touch screens. If you pick A, say what a tap does on mobile.

## Comments

**Second pass (spec session, 2026-10-27).** The user ruled one look family for every link kind: chips (spec Q25–Q28). Reopened to frame that family before tickets 05–07 build it.

- `#N`: the titled chip (variant C). Drop variants A and B.
- `@user`: a chip with the avatar and name, beside the "unknown user" form restyled to match.
- Listings and the unavailable listing chip: as framed in the first pass.
- One comment with all three kinds together, in prose, plus the unavailable form of each.
- Frames: light and dark, desktop and mobile, `.scratch/frames/links-chips-<theme>-<width>.png`.

For you: approve the chip family from the second-pass frames.
