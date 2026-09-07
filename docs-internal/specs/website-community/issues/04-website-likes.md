# 04: Like creations on the website

Status: ready-for-agent
Blocked by: 02 — Share and open individual creations

Parent: [Website community spec](../spec.md)

## What to build

Signed-in visitors can add or remove a Like directly on the website; guests can sign in and return to the same creation before choosing to Like it.

## Acceptance criteria

- [ ] Expose Like and unlike through shared controls and services on applicable cards and details, with consistent count and account-specific state.
- [ ] Guest Like activation starts website sign-in with a safe same-site return destination for the exact creation, including its category.
- [ ] Return from successful sign-in to that creation's details without automatically sending a Like request; a fresh click is required.
- [ ] Follow sign-in, sign-out, and account changes while the page is open; do not retain another account's liked state or capabilities.
- [ ] On Like/unlike failure, show an actionable error and reconcile displayed state without falsely reporting success; allow retry.
- [ ] Preserve content-warning requirements across authentication and return navigation.
- [ ] Prove Like/unlike, request failure and retry, session changes, and guest sign-in return through rendered UI and observed service requests. Explicitly assert no Like is cast by authentication alone.
- [ ] Retain existing Like/Liker visibility rules and keep other website mutations excluded.

## Completion checks

- [ ] Run typecheck, lint, tests, the app build, and the website build; report timed test results and investigate unexplained process tail time.
- [ ] Use the spec's approved behavioral test boundaries, measure relevant coverage, and prove new guards catch their target regressions without removing real failure triggers.
- [ ] Verify the changed UI in the live preview using static DOM/frame evidence, including relevant mobile and theme cases.
- [ ] Add the appropriate In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
- [ ] Commit only this completed slice after its checks pass; do not push.
