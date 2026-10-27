# Spec: Feedback on the website

Status: done
Status note: Closed 2026-10-27. Tickets 01–06 landed; last landing 5b75e28df. Review: three gaps fixed by ticket 06; spec text corrected. Gates green on 2026-10-27 (lint and test run before ticket 06; ticket 06 passed its own prepare gates).
Spec session: website-feedback — spec

Server side: the FormamorphServer repo, `docs-internal/specs/website-feedback/spec.md`. It holds the read-access contract. This spec follows it.

## Problem Statement

Players can read, vote on and discuss suggestions and questions only inside the game. A visitor on formamorph.ai cannot see what others have asked or requested, cannot share a link to a thread, and cannot add a vote without launching the app. A player who wants to check whether an idea is already filed must open the game first. Staff answers to common questions are hidden from anyone who has not installed it.

## Solution

Add a feedback board to the website at `/feedback`, with each thread at `/feedback/<id>`. It shows the two Votable boards, suggestions and questions, and never shows bugs. It sits behind the same content warning (age gate) as the website's community page.

Guests can read every suggestion and question and its comments. Voting, commenting, filing and editing need an account. When a guest presses one of those controls, the site sends them to sign in and returns them to the same thread, the same as the Like nudge on the community page. Signed-in visitors can vote, comment, file a suggestion or question, and edit their own posts. Staff tools stay in the app.

The site header gets a Feedback link next to Community.

## User Stories

1. As a visitor, I want a Feedback link in the site header, so that I can find the board from any website page.
2. As a visitor, I want the content warning before any feedback content loads, so that the website treats all user content the same way.
3. As a visitor who already accepted the warning on the community page, I want the board to open without a second prompt, so that I am not asked twice.
4. As a visitor who declines the warning, I want to return to the landing page, so that no feedback content loads.
5. As a guest, I want to read suggestions without an account, so that I can see what others have requested.
6. As a guest, I want to read questions and their accepted answers, so that I can find help without installing the game.
7. As a guest, I want to switch between the Suggestions and Questions tabs, so that I can browse each board.
8. As a guest, I want the app's search, filters and sorts on the board, so that finding a thread works the same as in the game.
9. As a guest, I want to page through long boards, so that I can reach older threads.
10. As a guest, I want to open a thread and read all its comments, so that I can follow the discussion.
11. As a visitor, I want each thread to have its own address, so that I can share a link to it.
12. As a visitor opening a shared thread link, I want that thread to open directly, so that I do not have to search for it.
13. As a visitor opening a link to a bug, a deleted thread or an unknown ID, I want a not-found page, so that I know the link does not work.
14. As a guest, I want to see each thread's vote count, so that I can tell which requests are popular.
15. As a guest who presses Vote, I want to be sent to sign in and then back to the same thread, so that I can vote after I sign in.
16. As a guest who presses Comment, I want the same sign-in round trip, so that I can join the discussion.
17. As a guest who presses New, I want the same sign-in round trip back to the board, so that I can file after I sign in.
18. As a guest who signs in after a nudge, I want nothing done for me automatically, so that I stay in control of my vote or comment.
19. As a signed-in visitor, I want to vote and remove my vote, so that I can support the requests I care about.
20. As a signed-in visitor, I want to comment on a suggestion or question, so that I can add to the discussion.
21. As a signed-in visitor, I want to file a new suggestion or question from the website, so that I do not have to open the game.
22. As a signed-in visitor filing a question, I want to see similar threads while I type the title, so that I do not file a duplicate.
23. As a signed-in visitor who wants to report a bug, I want to be told that bug reports are filed in the app, so that the report includes the app's diagnostics.
24. As an author, I want to edit my own thread on the website, so that I can fix a mistake without opening the game.
25. As an author, I want to edit and delete my own comments on the website, so that I can correct what I wrote.
26. As a signed-in visitor, I want locked threads to show as locked with no comment box, so that I know why I cannot reply.
27. As a staff member, I want the website to show no moderation controls, so that moderation happens in one place, the app.
28. As a signed-in visitor, I want my vote and my comments to show in the app as well, so that both surfaces show one board.
29. As a signed-in visitor, I want reading a thread on the website to clear its unread badge in the app, so that I do not read it twice.
30. As a visitor whose session ends while on the board, I want the page to change to the guest view, so that controls do not fail silently.
31. As a visitor, I want a clear message when the server cannot load the board or a thread, so that I can tell an outage from an empty board.
32. As a visitor on a phone, I want the board and threads to fit the screen, so that I can read and vote on mobile.
33. As a keyboard user, I want every control on the board reachable by keyboard, so that I can use it without a mouse.

## Implementation Decisions

- **Rulings (grill, 2026-10-27).**
  - Q1: Guests read. The server makes list, thread and meta reads optional-auth. Writes still require sign-in.
  - Q2: The website shows only the Votable boards (suggestions and questions). It never shows bugs.
  - Q3: Signed-in visitors file suggestions and questions on the website. The bug option points to the app.
  - Q4: Out of scope (see below).
  - Q5: Vote, Comment and New use the Like nudge: sign in with `next` set to the current thread or board, then return. Nothing replays after sign-in.
  - Q6: The routes are `/feedback` and `/feedback/<id>`. A bug, a missing thread or an invalid ID shows the website's not-found page.
  - Q7: The entry point is one link in the shared site header, next to Community.
  - Q8: Staff tools (status, lock, accept answer, delete thread) stay in the app.
  - Q9: Authors may edit their own thread and edit or delete their own comments, under the same rules as the app.
  - Q10: The New form keeps the similar-threads check.
- **Reuse the app's feedback components through a capabilities object**, the same way the community page reuses the community browser. A website capabilities set turns off the bug tab, the bug filing type, staff controls and the in-app unread badge. Capabilities are flags only; the landed set also has `profileThreads` (drops the in-app profile wording on the site) and `inlineNotes` (writes a failure under its control). Guest mode is a separate optional `onGuestWrite` prop that the page supplies; when present, Vote, Comment and New call it. With staff controls off, a staff viewer is treated as a normal player; the asker's own Accept Answer stays (ticket 02 ruling).
- **The page owns routing.** The page maps the address to a board tab or a thread ID, and maps a thread opened in the list back to `/feedback/<id>`. Back and forward work through the site router.
- **The content warning wraps the page** through the existing site age-gate component, outside the feedback host, so no feedback request starts before acceptance.
- **The website must never mount a toast container** (prior ruling from the accounts effort). The reused components report results through a required `notify(message, kind, error?)` callback. The app passes toast, keeping the Error Details link; the site writes a line under the control (ticket 02 ruling).
- **Bundle boundary.** The site's allow list and module ceiling widen deliberately for the feedback components, the markdown renderer and the prompt field. Each widening is reviewed against the forbidden downstream list. The website Tailwind content scan covers every newly reachable component.
- **Guest reads skip per-user state.** For a guest, the server returns `voted: false` and `unread: false` and records no seen-marker. A signed-in read on the website marks a thread seen exactly as the app does.
- **A stale token never becomes a guest on the server (ticket 01 ruling).** Any Authorization header gets full `protect`, so the site clears a session whose feedback read answers 401 and retries once as a guest.
- **A converted bug keeps its comments (ruling after ticket 01).** A bug refiled as a suggestion or question is a Votable board thread, and every comment on it stays readable, guests included. Only its diagnostics are cleared.
- **Ticket 03 rulings.** The thread address is `/feedback/<uuid>` through one parse/format pair that the feedback-links effort swaps to `#N`; a segment that is not a UUID is not-found with no request. `?board=questions` holds the tab; bare `/feedback` is Suggestions. A guest never sees the Mine/Everyone's scope select. Author names link to the site's `/u/<name>`. The page is a lazy route with its own boundary allow list and ceiling; the account chunk does not change.
- **Ticket 04 rulings.** A failed write shows its message under the failing control on the site; the app keeps its toast. Voting is not optimistic, so a failed vote leaves the count and control unchanged. App parity is a service-level check of endpoints and bodies.
- **Ticket 05 rulings.** Filing reuses the app's filing dialog with the website capabilities. A similar thread picked in the form closes it (the draft stays) and opens the thread's site address. After filing, the visitor lands on the new thread. The bug line links to plain `/play/`; no app deep link to the bug form. Drafts stay in localStorage on the site too.
- **A failed list load is not an empty board (Q11, user ruling).** In the app and on the site, a failed load shows "These couldn't be loaded." with Retry in place of the empty label. The app's toast still fires.
- **A bug ID on the website is not-found.** For a guest, the server refuses it. For a signed-in visitor, the page refuses to render a thread whose type is not a Votable board, so a bug never renders on the website for anyone.
- **Filing on the site** offers only suggestion and question. It collects no diagnostics. A short line in the form tells the visitor to report bugs in the app, with a link to open it.
- **Session changes.** The page reads session changes through the existing shared-session listener. A sign-out moves the page to the guest view without a reload.

## Testing Decisions

- A good test drives the rendered page or a real route and asserts what a visitor sees, the requests sent and where the visitor ends up. It never asserts on component internals.
- **Primary seam:** the rendered `/feedback` and `/feedback/<id>` routes in the Playwright site harness, with controlled server responses. Prior art: the website community and site-pages e2e specs.
  - Before acceptance, assert that no feedback request is sent. Then accept and prove the board loads.
  - Cover guest reading, tabs, search and filters, paging, a direct thread link, the not-found cases (bug, missing, invalid), and the nudge round trip for Vote, Comment and New with no automatic action after sign-in.
  - Cover signed-in vote and unvote, comment, file with the similar-threads list, edit own thread, and edit and delete own comment.
  - Cover desktop and mobile widths and keyboard use.
- **Secondary seam:** jsdom page tests in the style of the community page tests, for failure states (server outage versus empty board), sign-out mid-page, a bug type returned to a signed-in reader, and the absence of staff controls for a staff session.
- **Bundle boundary:** the existing boundary test, including the Tailwind scan check, must stay green with the deliberate widening. Prove the widening still bites by adding a forbidden import once.
- **App regression:** the existing feedback dialog, thread view and list tests must stay green with the new capabilities and `notify` seams.
- Prove each new guard fails when its bug returns. Do not weaken a fixture to remove a real trigger. Time every test run.

## Out of Scope

- **Bug queue exposure in the app (Q4).** Today any signed-in app user can list and read every bug, diagnostics included. This needs its own decision.
- **Links and mentions in feedback text** (`@user`, `#N`, content links). A separate effort grills this.
- Staff moderation on the website.
- Filing bugs from the website.
- Replaying a vote or comment after a nudge sign-in.
- A My Feedback section on the account page.
- Feedback notifications by mail.

## Further Notes

- The glossary's **Votable board** is the term for "suggestions and questions". Do not call them "public boards": every thread is readable by a signed-in user.
- The server ticket must deploy before the website board is useful to guests. Until then, the page shows guests the sign-in nudge in place of the board.
