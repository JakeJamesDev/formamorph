# 03: Feedback Board on the Website

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: new site routes, the age gate, the bundle-boundary widening and the Tailwind scan meet in one slice. A silent boundary or scan miss passes every gate.

**What to build:** a visitor reaches `/feedback` from a Feedback link in the site header, accepts the content warning, and reads the Suggestions and Questions boards with the app's search, filters, sorts and paging. Opening a thread changes the address to `/feedback/<id>`, and that address opens the thread directly. A bug, a missing thread or an invalid ID shows the site's not-found page. A guest who presses Vote, Comment or New goes to sign in with `next` set to the current address and returns there, with nothing done automatically. A signed-in visitor sees the same board, and reading a thread clears it in the app's unread badge.

- [ ] The site header shows a Feedback link next to Community on every site page.
- [ ] Before the content warning is accepted, no feedback request is sent (Playwright, controlled responses).
- [ ] After acceptance, the board loads both tabs; search, a filter, a sort and paging each change the list.
- [ ] A direct `/feedback/<id>` link opens that thread; back and forward move between board and thread.
- [ ] A bug ID, a missing ID and an invalid ID each show the not-found page, for a guest and for a signed-in reader.
- [ ] Vote, Comment and New as a guest each go to `/login?next=…` and return to the same place; no vote, comment or form is sent after sign-in.
- [ ] A server outage and an empty board show different messages.
- [ ] A guest read refused by a server without ticket 01 (401) shows the sign-in nudge in place of the board.
- [ ] No staff control shows for a staff session.
- [ ] The bundle-boundary test passes with a deliberate allow-list and ceiling change, and still fails when a forbidden import is added once.
- [ ] The website Tailwind scan covers every newly reachable component.
- [ ] `docs/Community-Creations.md` says the Suggestions and Questions boards can also be read at formamorph.ai/feedback.
- [ ] Frames: `.scratch/frames/feedback-board-desktop.png`, `.scratch/frames/feedback-thread-desktop.png`, `.scratch/frames/feedback-board-mobile.png` (375 wide), dark theme (the site is dark only).

For you: read a long thread on the site on your phone and check that it is comfortable to read.
