# 04: Vote and Comment on the Website

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: wires existing service calls through the seams 02 and 03 built; few new decisions.

**What to build:** a signed-in visitor on the website votes and removes a vote, comments on a suggestion or question, edits their own thread, and edits or deletes their own comments, under the same author rules as the app. A locked thread shows as locked with no comment box. If the session ends while the page is open, the page changes to the guest view without a reload.

- [ ] Vote and unvote update the count and the control; on a failed request the count and control stay unchanged and a message shows under the control. (Spec-session ruling: no optimistic flip; the app keeps its toast.)
- [ ] A comment posts and appears in the thread; a failed post keeps the typed text.
- [ ] An author edits their own thread and their own comment, and deletes their own comment after confirming.
- [ ] Edit and delete controls do not show on other people's posts.
- [ ] A locked thread shows the locked state and no comment box.
- [ ] Signing out in another tab moves the open page to the guest view, and the next Vote press goes to sign-in.
- [ ] A vote and a comment made on the site show in the app's thread view (service-level: the site and the app send the same endpoints and bodies; spec-session ruling).
