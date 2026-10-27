# 12: App Bug Chip Address

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q11, Q35)

## What to build

In the app, a thread chip that links to a bug carries the website address `/feedback/<N>` as its href. A click opens the bug in place, but opening it in a new tab or copying the link leads to the website's not-found page, because the website never serves bugs. Give a bug chip in the app no website href, so it opens only in place.

Found by the close review.

## Acceptance criteria

- [ ] In app mode, a chip for a readable bug opens the bug in place and carries no website href.
- [ ] Chips for suggestions and questions keep their `/feedback/<N>` href.
- [ ] Site mode is unchanged: a bug target still renders the unavailable form.
