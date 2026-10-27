# 12: App Bug Chip Address

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q11, Q35)

## What to build

In the app, a thread chip that links to a bug carries the website address `/feedback/<N>` as its href. A click opens the bug in place, but opening it in a new tab or copying the link leads to the website's not-found page, because the website never serves bugs. Give a bug chip in the app no website href, so it opens only in place.

Found by the close review.

## Acceptance criteria

- [x] In app mode, a chip for a readable bug opens the bug in place and carries no website href. (`FeedbackThreadView.links.test.tsx`: no link role, no href, click calls `onOpenThread(9)`.)
- [x] Chips for suggestions and questions keep their `/feedback/<N>` href. (Existing suggestion assertion on `/feedback/7`; a question shares the same code path.)
- [x] Site mode is unchanged: a bug target still renders the unavailable form. (Boards gate untouched; the site test still passes.)

## Landed

**Not verified**
- Not checked in the browser pane: the button chip's look next to the link chips (it reuses `CHIP_CLASS`).

**For you**
- Look at a bug chip in an app thread: it should match the other chips, show a pointer on hover, and open the bug on click.
