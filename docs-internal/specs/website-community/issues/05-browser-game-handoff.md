# 05: Open the same creation in the browser game

Status: ready-for-human
Blocked by: 02 — Share and open individual creations

Parent: [Website community spec](../spec.md)

## What to build

Visitors can move from website creation details to the same creation in the browser game using one Open in app action.

## Acceptance criteria

- [ ] Show one Open in app action for a selected creation, targeting the browser game and carrying its listing identity and kind.
- [ ] Implement the receiving production URL flow in the browser game, feeding the existing listing-opening behavior rather than requiring another search.
- [ ] Honor the receiving app's content gate and preserve the target through acceptance; do not fetch or expose community content before authorization.
- [ ] Handle malformed, removed, and inaccessible targets without bypassing visibility rules or leaving the game stuck.
- [ ] Existing activity remains visible on the website; comments and contest participation are accessed in the game without individual unusable mutation controls on the website.
- [ ] Do not add installed-desktop launching or OS protocol registration.
- [ ] Follow the action into the actual browser-game entry in the end-to-end harness and assert the same creation opens, including a case requiring warning acceptance. Checking only the outgoing URL is insufficient.
- [ ] Regression-check ordinary game entry and internal listing opening so an absent or consumed external target does not reopen details unexpectedly.

## Completion checks

- [ ] Run typecheck, lint, tests, the app build, and the website build; report timed test results and investigate unexplained process tail time.
- [ ] Use the spec's approved behavioral test boundaries, measure relevant coverage, and prove new guards catch their target regressions without removing real failure triggers.
- [ ] Verify the changed UI in the live preview using static DOM/frame evidence, including relevant mobile and theme cases.
- [ ] Add the appropriate In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
- [ ] Commit only this completed slice after its checks pass; do not push.
