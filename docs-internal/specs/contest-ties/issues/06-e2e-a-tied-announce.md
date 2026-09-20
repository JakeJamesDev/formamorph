# 06: E2E: A Tied Announce

Status: ready-for-human
Status note: Built in `e2e/contest-entry.spec.ts`. The tied announce replaces the REST announce test, on the spec session's ruling (one contest announces once). The podium is 1, 1 only: the user changed the ranking rule mid-ticket, so the journey says nothing about whether a place after a tie is skipped, and tickets 08/09 add the sole lower place once the rule lands. `npm run test:e2e` desktop: both contest tests pass in 41.4 s. Four gates green: typecheck 0 errors (25.3 s), lint 0 errors, 11,980 tests pass in 110.1 s, build succeeds in 24.0 s.
Base: 43b0faaf
Blocked by: 01, 02, 03, 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Contest Ties](../spec.md)

**What to build:** The existing contest journey in the Playwright suite announces one tie and proves that players see it. An admin places two worlds, sets **Tie With Above** on the second, and announces. The test then asserts the podium band, a card badge on each tied world, and the contest bar's count line. The suite runs outside the four gates.

- [x] The journey announces a podium with two 1st-place worlds through the dialog
- [x] The band shows both worlds with gold plates, in publish-time order
- [x] Each tied world's card shows the 1st-place badge
- [x] The contest bar reads "2 worlds tied for 1st"
- [x] The journey still passes for a podium with no ties
- [x] `npm run test:e2e` result and run time stated; four gates green

## Comments

**What the journey does now.** It publishes a world into the running contest, closes the contest through
the admin API, signs in as the admin, opens Admin Panel -> Events without the `tab` slot (that slot serves
the canned calendar), and clicks **Announce Results**. In the dialog it clicks this run's entry and one
seeded entry, checks the second row reads 2nd Place, ticks **Tie With Above**, and checks both rows then
read 1st Place. After announcing it signs back in as the author and checks the contest bar line, the band's
two gold cards in publish-time order, the 1st-place badge on each tied world's catalog card, and the badge
on the author's own downloaded copy.

**Guards proved by putting the bug back.** Reversing the server's tied ordering turned the band-order
assertion red. Dropping the bar's tie branch turned the bar line red. A third mutation (competition to
dense ranking) also bit, but its assertion is gone with the rule change.

**Three pre-existing breaks had to be fixed first**, or the journey could not run at all:

1. A fresh account raises the age gate after sign-in, because each account keeps its own answer under its
   own id and `openApp` can only seed the device store. `signIn` in `e2e/app.ts` now answers it the way a
   player does.
2. The app reads the public reasoning catalog once per launch, which the stray-request guard counted as a
   run pointed at production. That one address is now expected; everything off-machine is still cut off.
3. `getByRole('button', { name: 'Contest' })` matched the menu's event banner as well when the contest's
   own title carried the word. It is exact now.

**What the second flow costs.** Six of the server's twenty credential calls per quarter hour, up from
four. Two full runs inside fifteen minutes hit the limiter, which reads as a skip with a note. Recorded in
`e2e/README.md`.

**Full-suite state, and what is not mine.** `npm run test:e2e` over both projects ran 566 tests in 47.1
minutes: 424 passed, 93 skipped, 49 failed. Both contest tests are in the passing set. Of the 16 spec files
that failed, 15 never call anything this ticket edited. The sixteenth, `session-sync.spec.ts`, calls
`signIn`; its two failures reproduce unchanged with this ticket's `e2e/app.ts` edit reverted, so they are
not from this work. Some failures are load (four sessions were building at once; `fullscreen-morph` passed
on a quiet re-run), and at least one names privacy copy another session is mid-way through writing. The
e2e suite is outside the four gates and was already not clean on this tree.

**The changelog entry was swept into a neighboring session's commit** (`baae96ea`). Per the implement
protocol it stays there; the wording was corrected in place for the 1, 1 podium.
