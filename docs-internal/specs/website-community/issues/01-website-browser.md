# 01: Browse community creations on the website

Status: ready-for-human
Blocked by: None (can start immediately)

Parent: [Website community spec](../spec.md)

## What to build

Visitors can enter the website community browser, accept the content warning, and explore all categories and full listing details without signing in.

## Acceptance criteria

- [ ] Serve the community route on direct visits and refreshes, with canonical trailing-slash handling; link it from landing and account/profile navigation and retain the website header.
- [ ] Reuse the community host, browser, cards, filters, and details. Establish explicit presentation and action capabilities before mounting the website surface; preserve the app modal behavior.
- [ ] Offer worlds, Characters (entities), dictionaries, and contests with shared search, filters, sorting, pagination, images, and existing activity.
- [ ] Keep the host unmounted and make no catalog, event, contest, detail, or thumbnail requests before warning acceptance. Declining returns to the landing page.
- [ ] Honor current guest acceptance and account-backed acceptance, including version mismatch, failed account reads/writes, retries, and session changes. A guest acceptance remains effective for the current visit when local storage refuses the write.
- [ ] Website capabilities exclude comment mutation, contest participation, publishing, author management, reports, and staff moderation, including for privileged accounts. Preserve established visibility rules for Likes and Likers.
- [ ] Until their dependent slices land, omit unfinished website download, Like mutation, and app-handoff controls; never expose the app's local-library download action as a substitute.
- [ ] Load the community surface separately so lightweight account routes do not fetch its browser/game dependencies. Include all reused styles and retain meaningful bundle-isolation checks.
- [ ] Prove ordinary entry, gate failure/recovery, all categories, representative filtering, details, and image viewing at the rendered route. Verify desktop/mobile, keyboard use, and both themes with static evidence.
- [ ] Verify the existing app modal and downloads still work after shared-boundary changes.

## Completion checks

- [ ] Run typecheck, lint, tests, the app build, and the website build; report timed test results and investigate unexplained process tail time.
- [ ] Use the spec's approved behavioral test boundaries, measure relevant coverage, and prove new guards catch their target regressions without removing real failure triggers.
- [ ] Verify the changed UI in the live preview using static DOM/frame evidence, including relevant mobile and theme cases.
- [ ] Add the appropriate In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
- [ ] Commit only this completed slice after its checks pass; do not push.
