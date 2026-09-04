# Abuse Signals, Privacy Policy, and Account Deletion

Status: ready-for-agent

Staff can see when several accounts come from one place; every user is told so in a privacy policy they accept at signup or next login; and any user can delete their own account. Designed in a grilling session on 2026-09-03, prompted by a contest-vote ring caught the same day.

**Ordering constraint.** The server is already down for shipped clients (they point at the old hostname) and a client update must go out soon. Tickets are ordered so the backend lands first, the smallest client change ships with that update, and the moderation surfaces come last — they can be built any time.

## Problem Statement

A user made four accounts in under two minutes and used each to like their own contest entry seconds after creating it. Staff caught it, but only by reading timestamps out of the database by hand — the server keeps no record that could link the accounts, so the same trick works again tomorrow and proof is impossible in principle. Meanwhile nobody who plays has ever been told what the server stores about them, there is no privacy policy anywhere, and a user who wants their account gone has no way to ask except finding a staff member.

## Solution

Whenever an account does something that matters — sign up, log in, like, publish, comment, follow — the server records a **Signal**: a salted hash of the network address and a coarse browser family, kept for 90 days, then purged. Signals do nothing on their own. Staff see them in two places: a user's row shows which other accounts share a Signal, and a contest listing's like list flags Likers that share one with each other or with the author. Every look is written to the audit log.

A **Privacy Policy** joins the two existing server-hosted policies. New users accept it to register; existing users see it once at their next login and choose Accept, Delete my account, or Sign out. The server refuses every action from an account that has not accepted it, so old builds fail with a message that says to update rather than quietly skipping the policy. The same text is published on the public site for anyone not signed in.

Any user can delete their own account: password re-entered, a single choice of whether their published listings and comments go with it, and a seven-day **Grace Period** during which logging back in cancels the request. Suspended accounts ask staff instead.

## User Stories

### Being informed

1. As a new user, I want to read the Privacy Policy before my account exists, so that I know what is stored about me before I agree to it.
2. As a new user, I want declining the policy to mean no account is created, so that I am never logged into something I did not agree to.
3. As an existing user, I want to see the Privacy Policy once at my next login, so that I am told about the change without hunting for it.
4. As an existing user, I want the policy prompt to offer Accept, Delete my account, or Sign out, so that every honest choice is one button.
5. As an existing user who signs out at the prompt, I want my account left intact, so that I can come back and accept later.
6. As a user who accepted, I want never to see the prompt again unless the policy actually changes, so that it is not nagware.
7. As a user, I want the policy to say plainly what is collected, why, for how long, and who hosts it, so that I can decide with real information.
8. As a user, I want the policy to say that the network hash is kept 90 days and used only to detect abuse, so that the reason for it is not hidden.
9. As a user, I want the policy to say that Cloudflare and the hosting provider process my requests, so that I know who else handles my data.
10. As a user, I want the policy to say how to delete my account and how long that takes, so that the exit is documented.
11. As a user, I want the policy to say that moderation records keep my username after deletion, so that erasure is not overstated.
12. As a user, I want the policy to say that the optional email is currently used for nothing, so that I am not misled about why it was asked for.
13. As someone not signed in, I want to read the Privacy Policy on the public site, so that I can decide before registering.
14. As a user on an old build, I want a clear "update Formamorph to continue" message rather than silent failures, so that I know what happened.
15. As a user, I want the policy to state the minimum age, so that the existing age gate has a written basis.

### The Signal

16. As the operator, I want a Signal recorded at signup, login, like, publish, comment, and follow, so that a ring of accounts can be linked wherever it acts.
17. As the operator, I want the network address stored only as a salted hash, so that the record links accounts without being a readable address.
18. As the operator, I want a coarse browser family stored beside the hash, so that a shared household on two browsers still reads as two people.
19. As the operator, I want Signals purged after 90 days automatically, so that retention is enforced by code rather than promised.
20. As the operator, I want the salt to live in the server's environment like the token secret, so that rotating it is the emergency unlink lever.
21. As the operator, I want the server to refuse to boot without a salt, so that a misconfigured deploy never writes unsalted hashes.
22. As the operator, I want the Signal to use the same client-address resolution the rate limiter already uses, so that the proxy and Cloudflare are handled once.
23. As a user behind a shared connection, I want a shared Signal to cause no automatic consequence, so that a dorm or a household is never punished by a machine.
24. As the operator, I want a deleted account's Signals to go with it, so that erasure includes them.

### Moderating with it

25. As staff, I want a user's row to show how many other accounts share a Signal with them, so that a ring is visible at a glance.
26. As staff, I want to expand that into the list of linked accounts with when and on which event they matched, so that I can judge whether it is one person.
27. As staff, I want a contest listing's like list to flag Likers that share a Signal with each other, so that a vote ring is one screen.
28. As staff, I want that list to flag Likers that share a Signal with the listing's author, so that self-voting is visible.
29. As staff, I want each Liker's account age shown beside the like, so that seconds-old accounts stand out.
30. As the operator, I want every linked-accounts view written to the audit log with who looked at whom, so that access to linkage data is itself accountable.
31. As staff, I want the existing like-removal and suspension tools to be what I act with, so that the Signal informs a decision rather than making one.

### Deleting an account

32. As a user, I want a Delete account control in my profile, so that leaving does not require finding a staff member.
33. As a user, I want to re-enter my password to delete, so that a stolen session cannot erase my account.
34. As a user, I want to choose once whether my published listings and comments are deleted too, so that I decide what of my work survives.
35. As a user who keeps their content, I want it shown under a fixed "[deleted user]" name with no profile behind it, so that my name is gone even where my work stays.
36. As a user, I want a seven-day Grace Period during which logging in cancels the deletion, so that a bad day does not cost me the account.
37. As a user, I want to be told at login that my deletion was cancelled, so that I know the account is back.
38. As a user, I want nothing hidden during the Grace Period, so that cancelling restores everything because nothing was removed.
39. As a user, I want deletion to complete on its own after seven days, so that I do not have to come back to finish it.
40. As a suspended user, I want to be told to request deletion through Feedback instead, so that I know the path exists.
41. As staff, I want a suspended account unable to self-delete, so that a suspension's evidence is not erased by the person it is about.
42. As a contest organizer, I want placements to keep the listing's name with the author anonymized after deletion, so that results stay readable.
43. As the operator, I want deletion requests, cancellations, and completions in the audit log, so that the account's end is traceable.
44. As the operator, I want the deletion logic shared by the route and the existing command-line tool, so that there is one erasure and not two.

## Implementation Decisions

### The Signal

- **Storage.** A new append-only table: one row per event with the user, the event name (`signup`, `login`, `like`, `publish`, `comment`, `follow`), the address hash, the browser family, and a timestamp. Indexed on the hash, the user, and the timestamp. The user reference cascades on delete. Added as a boot-time schema step in the existing additive pattern.
- **Hash.** SHA-256 over a fixed secret salt concatenated with the client address, hex-encoded. The salt is a new environment variable beside the token secret. Boot fails fast with a clear message if it is unset — the first environment validation this server has; tests inject one the way they inject the token secret.
- **Browser family.** A low-cardinality string of the form `Browser/OS` derived from the user agent by a small fixed table (major browsers × major platforms); anything unrecognized is `Other/Other`. Stored plain. It is a tiebreaker, not an identifier.
- **Client address.** The existing rate-limit key resolver — Cloudflare's connecting-address header, else the request address under the loopback proxy trust already set — is extracted into a shared helper both consumers use. When the API record is proxied, the firewall restricts the HTTPS port to Cloudflare's published ranges so that header cannot be forged by reaching the origin directly.
- **Where recorded.** Inside the six handlers, after the action succeeds. Recording never fails the action: a write error is logged and swallowed, on the audit log's `tryRecord` model.
- **Retention.** A sweeper on the quarantine/events pattern deletes rows older than 90 days: one catch-up run at boot, then hourly, timer unreferenced, and it takes a `now` so tests can drive it.
- **Legal basis.** Legitimate interest. Acceptance of the policy is acknowledgement, not consent to collection; declining does not switch collection off. Collection must not start before the policy is publicly published — enforced by ticket order, not code.

### The Privacy Policy

- **A third fixed policy id** beside the upload gate and the tag notice, with a title and body editable in the existing admin Policies tab, an `enabled` flag, and an acceptance version. Bumping the version re-prompts everyone; the existing "require re-accept" control is reused.
- **Seeded disabled** by a schema step so the server can deploy ahead of the client. Enabling it is the cutover.
- **Read.** The policies endpoint returns it alongside the others with an `accepted` flag, exactly as the upload gate is returned.
- **Accept and decline** endpoints mirror the upload gate's. Decline records the response and does nothing else server-side.
- **Enforcement.** A middleware applied to every authenticated route except registration, login, logout, password change, the deletion request, and the policy routes themselves. The deletion request is exempt because the prompt's third button is Delete my account. The public catalog reads serve an unaccepted caller as a signed-out visitor: browsing stays open, the account's own privileges do not. While the policy is enabled and the caller has not accepted the current version, it responds 403 with a fixed code and a plain message: the app needs updating to continue. New clients key on the code; old builds surface the message.
- **Signup flow.** Registration is unchanged. The client shows the policy before submitting; on accept it registers and then accepts back-to-back; on decline it submits nothing.
- **Login flow.** Login is unchanged. The client fetches policies after login; an unaccepted privacy policy opens the prompt with Accept, Delete my account, and Sign out. Sign out clears the session and nothing else.
- **Public copy.** A static page on the public site at a `/privacy` path carries the same text. The server row is canonical; the page is a copy and the spec names it as such.

### Account deletion

- **Request.** An authenticated endpoint taking the password and a boolean for whether published content goes too. Wrong password: 401. Suspended account: 403 with a message pointing at Feedback. Success stamps a deletion-requested timestamp and the content choice on the user row and writes an audit row. Nothing else changes.
- **Grace Period.** Seven days. A login with a pending request succeeds, clears the request, writes an audit row, and the response carries a flag the client turns into "your deletion was cancelled." Content is never hidden during the window.
- **Erasure.** A sweeper on the same pattern erases accounts whose request is older than seven days. It shares one module with the existing command-line tool, which becomes a thin caller of it. The tool's hazard — file removal inside an open transaction — is fixed on the way: rows go in one transaction, file paths are collected, files are removed after commit.
- **Content goes.** Listings and their files, comments everywhere, avatar, then the user row; foreign keys cascade likes, follows, acceptances, Signals, and the rest as they already do.
- **Content stays.** Listings and comments are reassigned to a reserved system user whose username is the fixed placeholder, whose status can never log in, and which is seeded by a schema step. Avatar removed. Contest placements have their stored author name replaced by the placeholder. Then the user row goes and everything else cascades as above.
- **Audit.** Three new actions: deletion requested, deletion cancelled, account deleted. The audit log keeps usernames by design; the policy says so.

### Moderation surfaces

- **Linked accounts.** A staff endpoint for a user returning every other account sharing any of that user's address hashes within retention, with each match's event and timestamp. Calling it writes a `signals_viewed` audit row naming the viewer and the subject. The Manage Users row shows the count and expands into the list.
- **Likes audit.** A staff endpoint for a contest listing returning each Liker with account age, the groups of Likers sharing a hash, and whether each shares one with the author. Calling it writes the same audit row per listing. The listing's like list in the staff panel renders it.
- **Roles.** All staff. Nothing about these views is automatic; the existing like-removal and suspension tools remain the actions.

## Testing Decisions

A good test drives the system from outside and asserts what a user or a staff member would observe. It never reaches into a module's internals or mirrors its code.

**Server — one seam, HTTP.** Every server behavior is tested through supertest against the real app over the in-memory database the suite already uses. Signals are asserted by what the staff endpoints return, not by reading the table. Sweepers are called with a `now` to move time. Prior art: the policies suite for accept/decline/enforcement, the likes and like-moderation suites for the like path, the quarantine suite for a sweeper driven by time, the token-invalidation suite for a login that changes account state, and the boot-schema drift test for the new steps.

Required guards, each proven by reinstating the defect it watches for:
- boot refuses to start without the salt;
- a Signal is recorded for each of the six events and never fails the action;
- a Signal older than 90 days is gone after the sweeper runs and a younger one is not;
- with the policy enabled and unaccepted, every protected route returns the fixed 403 code, and the exempt routes do not;
- with the policy disabled, nothing is refused;
- a suspended account cannot request deletion; a wrong password cannot;
- a login inside the Grace Period cancels the request and reports it;
- after seven days the sweeper erases; with content kept, listings and comments belong to the placeholder and the original username appears nowhere; with content deleted, the listing files are gone from storage;
- a linked-accounts request writes an audit row, and returns only matches inside retention;
- the likes audit groups Likers by shared hash and flags the author link.

**Client — component seam plus one e2e.** Component tests mount the real auth and policy services over a mocked fetch, on the pattern of the publish-policies hook test, the Terms tab test, and the profile dialog test. They cover: the signup flow refusing to register on decline; the login prompt's three buttons and what each does; the deletion flow's password step, content choice, and the suspended message; the cancelled-deletion notice on login. One Playwright spec, on the community-browser pattern, drives signup → policy → accept → a like succeeds, because that is the path the client update ships on.

**Not tested by motion or timing.** Nothing here asserts seconds.

## Out of Scope

- Any automatic action on a Signal: no holds, no blocks, no scoring rule. Dropped, not deferred.
- Removing or repurposing the optional email field. Its own cleanup; the policy states it is unused.
- Locking the server's CORS to the client origin. Unrelated hardening.
- Self-service deletion for suspended accounts. They ask through Feedback.
- Backfilling Signals for existing accounts. Impossible; they acquire one at next login.
- Legal review. I draft; the owner edits; a lawyer confirms before enabling.

## Further Notes

- **New glossary terms** for the domain doc: Signal, Browser Family, Linked Accounts, Privacy Policy, Grace Period, Erasure. Listing, Like, Liker, and Staff are used as already defined.
- **No export-shape change.** Everything here is server-side state; world and save files are untouched.
- **Cutover order is load-bearing:** public page live → server deployed with the policy disabled → client update shipped → policy enabled. Collection is legitimate-interest-based and starts with the server deploy; the public page being first is what makes "informed" true from the first row.
- **Changelog:** each ticket appends its own In Progress entry; the feature is one ⚙️ Backend group with a 👤 entry for the prompt and the deletion flow.
- The evidence that prompted this — four accounts, 1.8 minutes, likes 5–14 seconds after creation, author active two minutes before and nine after — lives in the untouched pre-cleanup database copy under the server repo's ignored migration folder.
