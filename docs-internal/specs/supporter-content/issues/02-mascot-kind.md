# 02: Server: Mascot listing kind

Status: done
Base: 4260262
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: adds a kind beside five existing ones, following the `model` kind's pattern and tests.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings.

## What to build

FormamorphServer accepts a sixth listing kind, `mascot` (Q13). Its content is the mascot card data: rig, picks, Mask, Voice, transition and every layer as a data URL. A thumbnail is required (the client fills it from the card's Initial render, Q24). Decoded content over 10 MB is refused (Q23). Every kind-agnostic rule applies unchanged: ownership, suspension, Listing Review (Q17), quarantine, comments, likes, Listing Changelog, reports, cascade delete.

## Acceptance criteria

- [x] The kinds list includes `mascot`; kind drift assertions are updated. (`kind.test.js` KINDS list)
- [x] Create, update and download of a Mascot listing work and store the content verbatim. (`mascotKind.test.js` "creates, then returns the card content verbatim", "replaces the content on update")
- [x] Content over 10 MB is refused with a 400 that states the size; a missing thumbnail is refused. (size cap suite; "refuses a missing thumbnail"; cap proven by flipping `measuresDecodedImages` and watching 3 tests fail)
- [x] A Mascot listing goes to review when Listing Review is on and lists at once when it is off. (Listing Review suite)
- [x] Ownership, quarantine, comments, likes, changelog and reports behave for `mascot` as for other kinds (route tests in the `model` kind suite's style). (kind-agnostic suite)
- [x] List reads filtered to `mascot` return only Mascot listings. ("returns only Mascots when asked for the mascot kind")

## Landed

Spec rulings from the spec session: the 10 MB cap counts decoded bytes of every base64 image data URL in the card (not serialized JSON), the 400 states the measured size for `mascot` only, and a Mascot cannot enter a contest. Client ticket 07 should measure the same way.

**Not verified**
- Nothing unticked. The review ran inline against `4260262` with no documented standards files in the repo.

**For you**
- Note: `src/utils/feedbackLinks.js` `LISTING_KINDS` omits `mascot` (no website page exists). Not changed.
