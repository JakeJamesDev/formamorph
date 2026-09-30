# 05: Always-shown Changelog switch

Status: ready-for-human
Base: e822d2f5
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Contained UI change in one modal with existing test prior art.

## What to build

Spec Q1 and Q2. The listing details window always shows the Changelog | Comments switch. Changelog is disabled until the window knows the listing has entries. The author's own listing enables it regardless. A server without changelogs keeps it disabled. The default tab applies only while the reader has not picked a tab in this open.

## Acceptance criteria

- [ ] The switch renders on every listing from the first frame.
- [ ] Changelog is disabled with no entries and enabled with entries; enabled on the author's own listing.
- [ ] Against a server without changelogs, Changelog stays disabled and nothing breaks.
- [ ] A reader's tab click during loading is kept when the details answer arrives.
- [ ] The existing changelog tests are updated for the always-shown rule; a new test fails when a late default overrides a click.
