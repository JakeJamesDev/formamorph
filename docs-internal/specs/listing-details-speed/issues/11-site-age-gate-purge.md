# 11: Clear the community caches on the website's age gate

Status: ready-for-human
Base: 45b59f13
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

One call site plus tests, but it must match the app's rules for when a purge runs, and it must keep the site bundle boundary.

## What to build

Spec story 16 and Q7 on formamorph.ai. The app clears every community cache (catalog, thumbnails, listing details, and the prefetch state) when the age gate is unanswered or declined. The website's age gate does not, so a reader who declines on the site keeps the cached catalog and listing details on that device. The website's age gate clears the same caches at the same moments the app's does: an unanswered gate, and every decline.

Found in the effort-wide review; not caused by this effort, but story 16 does not hold on the site without it.

## Acceptance criteria

- [ ] A decline on the website's age gate clears the catalog, thumbnail, and listing details caches, and the prefetch state.
- [ ] An unanswered website gate clears them the same way the app's does; an unresolved or failed lookup clears nothing.
- [ ] The site bundle boundary test still passes.
- [ ] Tests at the site's age gate seam cover each rule and fail when the purge call is removed.
