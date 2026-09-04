# 09 — Moderation: the contest likes audit

Status: ready-for-human
Type: task
Blocked by: 08
Spec: ../spec.md (Implementation Decisions › Moderation surfaces › Likes audit; User Stories 27–29, 31)

Both repos. The contest vote ring in one screen. Can be built whenever.

## Task

**Server**
- A staff endpoint for a listing returning each Liker with: username, status, account age at the time of the like, the like timestamp, a group id shared by Likers whose hashes match each other within retention, and a flag for sharing a hash with the listing's author.
- Any listing, not only contest entries — the screen is most useful there but the data is the same.
- Writes audit `signals_viewed` with the listing as target, once per call.

**Client**
- In the staff panel's listing view, the like list gains an Audit control that fetches and renders: Likers grouped by shared signal, each with account age and like time, and a marker on any Liker linked to the author.
- The existing like-removal control sits on each row so the decision and the action are one screen.

## Acceptance

- Four accounts sharing a hash render as one group of four; a Liker matching the author carries the marker; account age reads in minutes when under an hour.
- Removing a like from the audit view updates the list without a reload.
- Each open writes one audit row.

## Tests

- Supertest. Prior art: `tests/likeModeration.test.js`, `tests/likes.test.js`.
- Component test for the grouping and the author marker over a mocked response.

## Answer

Shipped in FormamorphServer `2d8e3d2` ("Add The Likes Audit Endpoint") and formamorph "Add The Likes
Audit To The Like List". `GET /api/worlds/:id/likes/audit` is its own route beside the plain like list.
Changelog: both moderation surfaces now sit under a **Linked Accounts** group in the ⚙️ Backend bucket,
which re-indents ticket 08's entry without changing its text.

Four decisions the ticket text did not settle:

- **Grouping is transitive.** "Likers whose hashes match each other" reads as pairwise, but a ring that
  moves between two connections is one person twice over. Union-find, and one test drives exactly that —
  it is the only test that fails when the implementation is swapped for per-hash grouping.
- **The audit row names the listing *and* its author.** The ticket asked for the listing as target, so
  the kind and name are the listing's; the author goes in `target_user` on `listing_deleted`'s shape
  rather than `like_removed`'s, since no single account is the subject of the read.
- **`auditPresentation` gained a branch**, because ticket 08's sentence for `signals_viewed` reads
  "viewed the accounts linked to …" and is wrong for a listing. One action, two reads, split on the
  target's kind rather than on a second action name.
- **Groups are re-counted on the client after a removal.** A pair cut down to one stops being a group
  without a second call — which matters because a second call would file a second look in the log.

Two additions the ticket did not ask for, both small: the button relabels to **Audit again** after a
run, so a deliberate second check is possible and is logged as the second look it is; and a one-line
summary beside it counts the groups and the author links. "Each open writes one audit row" is met as
"each press" — the fetch waits for the button exactly as ticket 08's expander does, so opening a like
list to count it files nothing.

A code review caught one real defect, now fixed with a test that fails when the guard is removed: an
audit that answered after the dialog moved to another listing landed its rows and marks on the listing
then on screen. A moderation screen reporting "no two of these accounts share a network address" over
somebody else's likes is the worst failure this feature could have, so the request now carries the
listing it asked about and a stale answer is dropped.

Two notes for review:

- **The author can never carry the mark.** Liking your own listing is refused with a 400, so the row that
  would trivially carry it cannot exist. The guard stays in the model because that method's contract is
  general; the test asserts the route-level rule instead of the unreachable branch.
- **Not checked in a live preview.** The dev router's `likers` modal needs a staff session, and the
  grouped state needs seeded Signal rows in the dev database. Structure, grouping, the marker and the
  removal path are covered by 29 component tests over the real dialog; the visual pass is outstanding.
  The group box and the mark reuse the `warning` token the row already used for a fresh account, so no
  new color entered the component.

Named, not fixed: the parent spec's Further Notes asks for **Signal**, **Browser Family**, **Linked
Accounts**, **Privacy Policy**, **Grace Period** and **Erasure** in the domain doc. `CONTEXT.md` defines
none of the six, and tickets 02–08 did not add them either. That is spec-level work, not this ticket's.
