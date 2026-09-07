# 03: Download importable creation files

Status: ready-for-human
Blocked by: 01 — Browse community creations on the website

Parent: [Website community spec](../spec.md)

## What to build

Guests can save published creations as importable files directly from the website, with clear progress and recoverable failures.

## Acceptance criteria

- [ ] Offer device downloads from the shared browser's applicable card and detail surfaces without requiring sign-in.
- [ ] Reuse shared content fetching and existing export serializers: world JSON, entity WebP card, and dictionary JSON.
- [ ] Skip optimization prompts and preserve published authored content. Retain world image links and embed the portrait required by entity cards.
- [ ] Do not add a local-library copy or show library update/re-download states as the website action.
- [ ] Keep listing-only metadata, including Listing Changelog, out of the exported content according to the existing formats. Introduce no new export schema, migration, or version bump.
- [ ] Report content-fetch, portrait-fetch, and serialization failures without a false success or corrupt artifact; allow retry.
- [ ] Capture actual files saved through the website route and validate all three formats through existing import/parser boundaries. Assert content fidelity, retained world links, embedded entity portrait, no optimization prompt, and no local-library writes.
- [ ] Regression-check the app's existing download-to-library behavior and export formats.

## Completion checks

- [ ] Run typecheck, lint, tests, the app build, and the website build; report timed test results and investigate unexplained process tail time.
- [ ] Use the spec's approved behavioral test boundaries, measure relevant coverage, and prove new guards catch their target regressions without removing real failure triggers.
- [ ] Verify the changed UI in the live preview using static DOM/frame evidence, including relevant mobile and theme cases.
- [ ] Add the appropriate In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
- [ ] Commit only this completed slice after its checks pass; do not push.
