# Anonymous Likes

Status: ready-for-agent
Spec session: Anonymous Likes

A person who is not signed in can like a listing, and a downloaded world asks for a like once during play. Designed in a grilling session on 2026-09-20, then checked against the client and the server code the same day. The work spans both repos; the server part lands first.

**Ordering constraint.** The public privacy text must state the new collection before the server stores one Anonymous Like. The server ships with the feature switched off, the text goes live, and only then does the operator switch it on.

## Problem Statement

Very few downloads become likes. A person who only downloads and plays has little reason to make an account, and the heart sends every guest to sign-in. Most of them stop there. The like button also lives only in the community browser, and a player who downloads a world plays it in the app and never returns to the listing. Good listings look unloved, and authors get little feedback.

## Solution

A guest presses the heart and it fills. The server stores an **Anonymous Like** against the person's **Install**, a random id the app makes once and keeps in local storage. The number on a listing is the sum of account Likes and Anonymous Likes, and the Likes sort and profile totals use the same sum.

When a player reaches 15 turns in a world they downloaded from the community, a small prompt asks once whether they enjoy it, with a heart. It shows to signed-in players too, and writes an account Like for them.

When a guest signs in, the Install's Anonymous Likes move to the account, so a new account starts with a liked list. The server remembers which account claimed the Install, so signing out does not give a second like on the same listing.

The number ranks nothing competitive, because staff pick contest podiums by hand. It is still guarded: an address can give one listing at most three Anonymous Likes, the route has its own rate limit, staff see Anonymous Likes grouped by shared address and can remove them, and one server setting switches the feature off.

The public website keeps sending guests to sign-in.

## User Stories

### Liking as a guest

1. As a guest in the app, I want the heart to fill when I press it, so that I can thank an author without an account.
2. As a guest, I want to press the heart again to take my like back, so that a mistake costs nothing.
3. As a guest, I want the heart to stay filled the next time I open the app, so that I know what I already liked.
4. As a guest, I want the count to change the moment I press, so that the press feels real.
5. As a guest, I want to like any kind of listing (world, entity, dictionary, model, prompt), so that the heart works the same everywhere.
6. As a guest, I want the detail view and the tile to agree on my like, so that the two never contradict.
7. As a guest on a shared connection where three people already liked a listing, I want a plain message instead of a broken heart, so that I know to sign in to like it.
8. As a guest, I want no sign-in wall on the heart in the app, so that liking takes one press.
9. As a website visitor, I want the heart to take me to sign-in and back to the listing, so that the website behaves as it does today.
10. As a guest when the feature is switched off, I want the heart to take me to sign-in as before, so that nothing looks broken.
11. As a guest on an old build, I want nothing to change, so that the update is not forced on me by this feature.

### The in-game prompt

12. As a player of a downloaded world, I want one small prompt after 15 turns that asks if I enjoy it, so that I can like it without finding the listing again.
13. As a player, I want the prompt to be dismissible with one press, so that it never blocks play.
14. As a player, I want the prompt never to return for that listing after I like or dismiss it, so that it is not nagware.
15. As a player who loads a save already past 15 turns, I want the prompt after my next turn, so that it does not greet me on load.
16. As a signed-in player, I want the prompt too, and I want it to write a Like on my account, so that my liked list stays complete.
17. As a player who already liked the listing, I want no prompt, so that I am not asked twice.
18. As an author playing my own published world, I want no prompt, so that I am not asked to like my own work.
19. As a player of a bundled world or an imported file, I want no prompt, so that it only shows where a listing exists.
20. As a player who is offline, I want no prompt until a like can succeed, so that I never press a heart that fails.
21. As a player whose like fails, I want a short message and the prompt to return on a later turn, so that my like is not lost silently.
22. As a player of a world whose listing is now unlisted, hidden, or deleted, I want the prompt to go away quietly, so that I see no error about something I cannot fix.
23. As a player with reduced motion on, I want the prompt to appear without animation, so that my setting is respected.

### Signing in

24. As a guest who signs up, I want the likes I gave on this Install to become my account's Likes, so that my account starts with my history.
25. As a guest who signs in to an existing account, I want the same, and I want a listing both had liked to count once, so that the total never double counts.
26. As a user, I want the listing totals to stay the same when my likes move, so that a claim changes nothing public.
27. As a user who signs out, I want hearts I liked on my account to show filled and refuse a second like, so that signing out is not a way to like twice.
28. As an author who signs out, I want the heart on my own listings to refuse, so that I cannot like my own work.
29. As a user on a shared computer, I want to still like things when the last person has signed out, so that the app works for guests there.
30. As a user who has not accepted the Privacy Policy, I want the app to treat me as a guest for likes, so that the heart still works while the rest of my account waits.
31. As a suspended user, I want signing out to give me no way to like, so that a suspension means what it says.
32. As a user who deletes my account, I want the link between my Install and my account to go with it, so that erasure is complete.

### Counts

33. As a visitor, I want one number on a listing, so that I do not need to know there are two kinds of like.
34. As a visitor, I want the Likes sort to order by the number I see, so that the order makes sense.
35. As an author, I want my profile's like total to match the sum of my listings' numbers, so that my profile and my tiles agree.
36. As an author, I want Anonymous Likes on a listing that leaves the public catalog to leave my public total, so that totals follow the rule they follow today.

### Privacy

37. As a guest, I want the public privacy page to say that liking while signed out stores a salted hash of my address for 90 days, so that I am told before it happens.
38. As a guest, I want the page to say the hash is used only to limit and detect abuse, so that the reason is not hidden.
39. As a guest, I want the page to say how to remove an Anonymous Like (press the heart again on the same Install), so that the exit is documented.
40. As a guest, I want the hash blanked after 90 days while my like stays, so that retention is enforced by code.
41. As a guest, I want my Install id to be random and carry nothing about my device, so that it identifies only this copy of the app.
42. As the operator, I want the feature off until the privacy text is live, so that collection never starts before disclosure.

### Moderating

43. As staff, I want the Likers list to show how many Anonymous Likes a listing has, so that I can see how much of the number is accounts.
44. As staff, I want the audit to show Anonymous Likes grouped by shared address, beside the accounts that share it, so that inflation from one place is one screen.
45. As staff, I want a lone Anonymous Like that shares the author's address flagged, so that self-liking while signed out is visible.
46. As staff, I want to remove one address group's Anonymous Likes from a listing, so that I can undo inflation without touching honest likes.
47. As staff, I want to remove all Anonymous Likes from a listing, so that an old blanked-hash flood can still be cleared.
48. As staff, I want every removal written to the audit log, so that the action has a record.
49. As staff, I want a Like that came from a claim marked as claimed, with the time it was first given, so that an old like on a new account does not read as a vote ring.
50. As staff, I want a claimed Like to carry a Signal for the account, so that it joins the address grouping like any other Like.
51. As the operator, I want one server setting that switches Anonymous Likes off without a deploy, so that a flood has an emergency stop.
52. As the operator, I want switching off to stop new Anonymous Likes and keep the stored ones counted, so that the stop is not destructive.
53. As the operator, I want the like routes to have their own rate limit keyed by address, so that one client cannot hammer them inside the global limit.
54. As the operator, I want nothing automatic to punish a shared address beyond the cap, so that a dorm is never penalized by a machine.

## Implementation Decisions

### Terms

- **Install**: one copy of the app's local storage, named by a random id from `crypto.randomUUID()`. Made on first need, never shown, never put in a URL. The desktop shell, the web build, and the website each hold their own.
- **Anonymous Like**: one Install's revocable mark on a listing. The existing **Like** stays "one account's mark"; the glossary entry for Like changes only to say the public count is the sum.
- **Claim**: moving an Install's Anonymous Likes to an account and linking the two.

### Server

- A new table holds Anonymous Likes: listing, Install id, address hash (blank after 90 days), browser family, created time. One row per listing and Install. It cascades when the listing goes.
- A new table links an Install to the one account that last claimed it. It cascades when the account goes, which covers erasure.
- The Like table gains one nullable column that marks a claimed Like. The Like keeps the time the Anonymous Like was given. This is the only change to an existing table; the Signal table does not change.
- The address hash uses the same salt, the same client-address resolution, and the same browser-family function as Signals.
- The Install id travels in a request header. The header joins the CORS allow list, and every response that reads it varies on it.
- One new route sets or clears an Anonymous Like. It needs the Install header and no token. It answers with the liked state and the summed count, the same shape the account route returns. It reuses the existing listing-visibility check.
- The route refuses, in this order: feature switched off; listing not visible; the Install's linked account is suspended; the linked account wrote the listing; the linked account already Likes the listing (answers liked, not an error); the address already holds three Anonymous Likes on this listing from other Installs. The cap counts only rows whose hash is not blank. Each refusal carries a distinct code so the client can choose its message.
- The "already Likes" answer is a 200 with its code, the liked state true, and the count. Nothing is stored. A clear press on that listing gets the same answer, because a request without a token never removes an account Like.
- The suspended and own-listing guards fire on a like press only. A clear press always removes the Install's own Anonymous Like, so the privacy text's removal promise holds for everyone.
- A request that carries a token for an account that has not accepted the Privacy Policy is a guest request, as optional authentication already treats it.
- One new authenticated route performs the Claim in one transaction: for each of the Install's Anonymous Likes, insert a claimed Like unless the account already Likes the listing or wrote it, then delete the Anonymous Like; upsert the link; write one `like` Signal for the account when at least one claimed Like was inserted. It is idempotent, and a repeat Claim writes no Signal.
- The public count becomes the sum everywhere the public sees it: the catalog select, the single-listing count, the Likes sort expression, and the author totals. The staff Likers list and the likes-given list stay account-only.
- The per-viewer liked flag, absent for guests today, is present for a guest request that carries an Install header. It is true when the Install holds an Anonymous Like or its linked account holds a Like.
- The hourly sweep gains a step that blanks Anonymous Like hashes older than the Signal retention period. The step is separate from the Signal purge and fails on its own.
- The likes audit gains Anonymous Like rows. The address grouping takes a second kind of node, so an Anonymous Like joins a group through its hash. A single Anonymous Like that shares the author's address is reported even though a group of one is otherwise dropped. The audit route still writes no audit entry.
- Two staff removal routes: by address group on a listing, and all Anonymous Likes on a listing. Each writes a new audit action when rows went.
- A new declared setting, default off, gates the route. The server has no public settings read, and that stays. The catalog list response and the listing detail response each carry one top-level boolean that follows the setting, the same for every viewer. The "setting off" refusal on the route is the fallback for a stale flag.
- A route-specific rate limiter keyed by client address covers both like routes.
- The server's policy text gains the Anonymous Like paragraph.

### Client

- One module owns the Install id: read, create on first need, and tolerate storage that throws. It follows the existing storage key prefix.
- The storage service sends the Install header on catalog, detail, and like requests when no session exists. The reader part of the catalog cache tag includes the Install id, so a guest cache and an account cache never mix.
- The browser capabilities gain a guest-likes field: true for the app, false for the website. With it on and the server setting on, the heart toggles for a guest; otherwise the existing guest handler runs. The like coordinator picks the account route or the anonymous route by session.
- The cap refusal shows a short toast that offers sign-in. Other refusals restore the heart and stay silent, except a network failure, which toasts.
- The session-change seam calls Claim after sign-in, sign-up, and an adopted session, then refreshes the catalog. A failed Claim retries on the next session change and never blocks sign-in.
- The in-game prompt follows the existing once-only notice pattern. Eligibility: the local world has a source listing id and a downloaded time, is not a bundled world, and the listing is not marked prompted. Trigger: the post-turn commit, when derived total turns are 15 or more and the browser reports online. It is a non-blocking card, not a dialog.
- The prompted mark lives in app storage keyed by listing id, outside the world record and the save. It is set on like, on dismiss, and on a not-visible or own-listing refusal. It is not set on a network failure or a cap refusal.
- The prompt fetches the listing's liked state before it shows, and marks the listing prompted without showing when it is already liked.
- The prompt gets a dev-router entry.
- The staff Likers dialog shows the anonymous count, the audit shows the anonymous groups, and both removal actions sit beside the existing one. A claimed Like shows a marker and its original time.
- The public privacy page gains the same paragraph as the server's policy text.
- Copy follows the player-facing voice and the help-copy pattern. The word is "like", never "vote".

**No export shape changes.** The world file and the save file stay as they are. The Install id, the prompted marks, and the source listing id are all local-only.

## Testing Decisions

A good test here drives a public seam and asserts what a person or staff member would see: a response body, a count, a heart state, an audit row. It never asserts table contents that no route exposes, and it never shapes a scenario so a guard cannot fire. Each guard gets a test that fails when the guard is removed.

- **Server seam: HTTP through supertest over the in-memory database.** Prior art: the like-moderation and abuse-signals route tests. Cases: set and clear; the summed count in catalog, detail, sort order, and author totals; each refusal in its order; the cap with four Installs on one address, and the cap after the sweep blanks hashes; Claim with overlap, with an own listing, twice in a row; signed-out refusal after a Claim; a suspended linked account; an unaccepted-policy token treated as a guest; erasure removing the link; the sweep blanking only old hashes with a passed-in clock; audit grouping with mixed account and anonymous rows and the lone author match; both removals and their audit entries; the setting off keeping stored likes counted; the CORS preflight accepting the header.
- **Client seam: the storage service and the browser host over mocked fetch.** Prior art: the community browser tests and the controlled-listing test. Cases: the header is present only without a session; the guest heart toggles with the capability on and routes to sign-in with it off or the setting off; the cap refusal toasts; Claim runs on each session event and a failure does not block; the cache tag changes with the Install.
- **Prompt seam: a pure eligibility function plus one component test.** The function takes the world record, turn count, online state, and prompted marks, and returns show or not. The component test covers like, dismiss, the already-liked skip, and the failure path that leaves the mark unset.
- **One Playwright spec** covers a guest liking in the browser and the prompt appearing after the fifteenth turn against a stubbed server. It runs outside the four gates, like the rest of that suite.
- The dev-router drift guard must stay green with the new entry.

## Out of Scope

- Anonymous Likes on the public website.
- Any contest scoring from likes.
- Any automatic action against an address, beyond the cap and the rate limit.
- Address or hash bans.
- Deduplicating the download counter, although its raw count makes the like-to-download ratio look worse than it is.
- Anonymous comments, follows, or reports.
- A personal "liked" list for guests.
- Syncing an Install across devices.
- An Android-specific storage path; the Android effort owns that.
- Any version bump, save migration, or world migration.

## Further Notes

- Rollout order: server with the setting off, then both privacy texts live, then the client release, then the operator switches the setting on. The last step is the operator's.
- `CONTEXT.md` needs **Install**, **Anonymous Like**, and **Claim**, and a changed **Like** entry. The abuse-signals effort still owes its six terms; add these in the same pass.
- The cap of three and the 15-turn threshold are single named constants, one on each side.
- A Claim frees the Anonymous Like's place under the cap. That is accepted: the result is an account Like, which the existing account linkage already covers.
- Server tickets belong in the server repo's spec folder under the same slug, with this file as the parent.
- Anti-abuse wording in code, tests, and commits names the pattern only, never an account or a listing.

## Comments
