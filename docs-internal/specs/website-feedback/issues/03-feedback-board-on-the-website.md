# 03: Feedback Board on the Website

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: new site routes, the age gate, the bundle-boundary widening and the Tailwind scan meet in one slice. A silent boundary or scan miss passes every gate.

**What to build:** a visitor reaches `/feedback` from a Feedback link in the site header, accepts the content warning, and reads the Suggestions and Questions boards with the app's search, filters, sorts and paging. Opening a thread changes the address to `/feedback/<id>`, and that address opens the thread directly. A bug, a missing thread or an invalid ID shows the site's not-found page. A guest who presses Vote, Comment or New goes to sign in with `next` set to the current address and returns there, with nothing done automatically. A signed-in visitor sees the same board, and reading a thread clears it in the app's unread badge.

- [x] The site header shows a Feedback link next to Community on every site page. `SiteHeader.tsx` plus the static headers in `hosting/index.html` and `hosting/privacy/index.html`; e2e checks `aria-current` on `/feedback`.
- [x] Before the content warning is accepted, no feedback request is sent (Playwright, controlled responses). e2e "sends nothing before the warning is accepted".
- [x] After acceptance, the board loads both tabs; search, a filter, a sort and paging each change the list. e2e "search, a filter, a sort and paging each change the list"; `?board=questions` holds the tab.
- [x] A direct `/feedback/<id>` link opens that thread; back and forward move between board and thread. e2e "a thread has its own address"; a trailing slash reads as the same address (`feedbackPath.test.ts`).
- [x] A bug ID, a missing ID and an invalid ID each show the not-found page, for a guest and for a signed-in reader. e2e, both sessions; jsdom: an invalid ID sends no request.
- [x] Vote, Comment and New as a guest each go to `/login?next=…` and return to the same place; no vote, comment or form is sent after sign-in. e2e, one test per control, through the real sign-in form.
- [x] A server outage and an empty board show different messages. `FeedbackPage.test.tsx` and `FeedbackList.test.tsx` (failed state with Try Again, app and site).
- [x] A guest read refused by a server without ticket 01 (401) shows the sign-in nudge in place of the board. `FeedbackPage.test.tsx`.
- [x] A feedback read that answers 401 to a held token clears the site session and retries once as a guest, so a stale token shows the guest board, not an error. (The server treats any Authorization header as `protect`; ticket 01 ruling.) `FeedbackPage.test.tsx` asserts one token request, then one guest request; mutation-tested.
- [x] No staff control shows for a staff session. `FeedbackPage.test.tsx` with an admin session.
- [x] The guest copy ticket 02 added ("Sign In to Reply") and any new guest labels pass the copy-sweep rules. Read by hand against `docs/Writing-Guide.md` and the Standards review; the load-failure line follows the Design System's Try Again row. The `copy-sweep` skill was not run.
- [x] The bundle-boundary test passes with a deliberate allow-list and ceiling change, and still fails when a forbidden import is added once. Lazy feedback route with its own allow list, ceiling 89 and three reviewed contexts; a `GameDataContext` import turned three checks red.
- [x] The website Tailwind scan covers every newly reachable component. `FEEDBACK_FILES` in `tailwind.site.content.cjs`; the scan check also reads class tables in lib files.
- [x] `docs/Community-Creations.md` says the Suggestions and Questions boards can also be read at formamorph.ai/feedback.
- [x] Frames: `.scratch/frames/feedback-board-desktop.png`, `.scratch/frames/feedback-thread-desktop.png`, `.scratch/frames/feedback-board-mobile.png` (375 wide), dark theme (the site is dark only). Written by the e2e spec.

For you: read a long thread on the site on your phone and check that it is comfortable to read.

## Landed

**Not verified:**
- None. Signed-in vote, reply and filing stay live but untested here; tickets 04 and 05 own them (spec-session ruling).

**For you:**
- Read a long thread on the site on your phone and check that it is comfortable to read. (`.scratch/website-feedback-03/frames/feedback-thread-desktop.png`, `.scratch/website-feedback-03/frames/feedback-board-mobile.png`)
- Below 480px the site header now shows the icon without the Formamorph wordmark (your pick). Check it on the landing page on your phone.
- Make a feedback list fail in the app (go offline in the Feedback dialog): it now shows "Formamorph couldn't load these threads." with **Try Again**, beside the usual error toast.
