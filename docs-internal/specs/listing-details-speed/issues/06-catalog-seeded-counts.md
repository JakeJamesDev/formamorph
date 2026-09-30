# 06: Catalog-seeded tab state and comment count

Status: ready-for-human
Base: fdd8a87c
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Seeding from two sources with a correction rule; needs care with the old-server fallback.

## What to build

Spec Q3 and Q4. The details window reads the catalog row's `changelog_count` and `comment_count` at open. The switch state, the default tab, and the comments header are right from the first frame. Comment placeholder rows show only when the count is above zero, one per expected comment up to one page. At zero, the empty state shows at once. The details and comments answers correct the seeded values when they differ.

The server half (`changelog_count`) is the FormamorphServer spec of the same name. This ticket does not wait for it: a row without the field behaves as ticket 05 does.

## Acceptance criteria

- [ ] With `changelog_count` above zero on the row, Changelog is enabled at open, and the default tab rule applies at once.
- [ ] Without the field, the state is unknown until the details answer, as in ticket 05.
- [ ] The comments header shows the row's count until the comments answer.
- [ ] Placeholders show only for a count above zero; zero shows the empty state at once.
- [ ] A details answer that disagrees with the row count wins.
- [ ] Tests at the details window seam cover each rule and fail when it is removed.
