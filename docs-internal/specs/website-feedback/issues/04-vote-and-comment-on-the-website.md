# 04: Vote and Comment on the Website

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: wires existing service calls through the seams 02 and 03 built; few new decisions.

**What to build:** a signed-in visitor on the website votes and removes a vote, comments on a suggestion or question, edits their own thread, and edits or deletes their own comments, under the same author rules as the app. A locked thread shows as locked with no comment box. If the session ends while the page is open, the page changes to the guest view without a reload.

- [x] Vote and unvote update the count and the control; on a failed request the count and control stay unchanged and a message shows under the control. (Spec-session ruling: no optimistic flip; the app keeps its toast.) jsdom 'updates the count and the control on a vote' and 'keeps the count and control and says so under Vote'; e2e 'votes and unvotes' and 'says a failed vote under the button' (desktop and mobile).
- [x] A comment posts and appears in the thread; a failed post keeps the typed text. jsdom and e2e post a comment; jsdom 'keeps the typed text and says so under the reply box'.
- [x] An author edits their own thread and their own comment, and deletes their own comment after confirming. jsdom and e2e edit an own thread and an own comment, and delete a comment after the confirm dialog; failed thread save and failed delete say so in place.
- [x] Edit and delete controls do not show on other people's posts. jsdom 'shows no edit or delete on other people’s posts' (also for a staff session).
- [x] A locked thread shows the locked state and no comment box. jsdom 'shows a locked thread as locked with no comment box'.
- [x] Signing out in another tab moves the open page to the guest view, and the next Vote press goes to sign-in. e2e 'moves to the guest view when another tab signs out' (storage event), then Vote goes to `/login?next=`.
- [x] A vote and a comment made on the site show in the app's thread view (service-level: the site and the app send the same endpoints and bodies; spec-session ruling). jsdom 'sends the same requests from the website as from the app'. No live server run.

## Landed

**Not verified:**
- None. The app-parity check is service level, not a live server (spec-session ruling).

**For you:**
- Vote, reply and edit your own post on formamorph.ai/feedback against the live server once ticket 01 is deployed.
