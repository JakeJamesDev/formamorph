# 02: Share and open individual creations

Status: ready-for-human
Blocked by: 01 — Browse community creations on the website

Parent: [Website community spec](../spec.md)

## What to build

Visitors can share a creation's website URL, open it directly after the warning, and reach those details from a public profile.

## Acceptance criteria

- [ ] Give each listing a shareable destination identifying the listing and kind. Opening a card updates the URL; opening or refreshing that URL restores the intended category and details.
- [ ] Preserve the selected destination through warning acceptance, with no community content loaded beforehand. Declining still returns home.
- [ ] Connect public website profile creation cards to their listing destinations.
- [ ] Use the shared listing-opening flow, waiting for catalog resolution before deciding that a listing is unavailable.
- [ ] Handle malformed, removed, and unavailable destinations without hanging or opening an unrelated listing. Preserve existing hidden/quarantined access restrictions.
- [ ] Closing details and browser Back/Forward navigation keep the URL and visible selection consistent.
- [ ] Prove direct entry, refresh, warning acceptance, profile navigation, and unavailable states through the rendered website route, including a mobile viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, the app build, and the website build; report timed test results and investigate unexplained process tail time.
- [ ] Use the spec's approved behavioral test boundaries, measure relevant coverage, and prove new guards catch their target regressions without removing real failure triggers.
- [ ] Verify the changed UI in the live preview using static DOM/frame evidence, including relevant mobile and theme cases.
- [ ] Add the appropriate In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
- [ ] Commit only this completed slice after its checks pass; do not push.
