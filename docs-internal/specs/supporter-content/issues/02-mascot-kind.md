# 02: Server: Mascot listing kind

Status: ready-for-agent
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

- [ ] The kinds list includes `mascot`; kind drift assertions are updated.
- [ ] Create, update and download of a Mascot listing work and store the content verbatim.
- [ ] Content over 10 MB is refused with a 400 that states the size; a missing thumbnail is refused.
- [ ] A Mascot listing goes to review when Listing Review is on and lists at once when it is off.
- [ ] Ownership, quarantine, comments, likes, changelog and reports behave for `mascot` as for other kinds (route tests in the `model` kind suite's style).
- [ ] List reads filtered to `mascot` return only Mascot listings.
