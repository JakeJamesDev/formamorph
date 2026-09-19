# 08: Models Filter and `model:` Search

Status: ready-for-human
Base: 43675466
Blocked by: 06
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/prompt-sharing/spec.md`

## What to build

A player narrows the Prompts section to presets that fit a model.

- The filter bar gains a Models chip filter beside Tags and Authors. It renders in the Prompts section only.
- Suggestions come from the models on the prompt listings in view. Free text commits.
- A listing matches when any of its models contains any chip text, case-insensitive. There is no Match
  Any/All toggle.
- The search box accepts a `model:` prefix with the same match rule, beside `author:`, `tag:`, and
  `status:`.
- The filter joins the per-section filter state and persists with it. Saved filters of the other sections
  survive the change.
- The active-filter chip bar shows model chips like the other facets.
- Filter the prefetched catalog on the client, as the other facets do. Use the server's model filter only
  where the browser already pages on the server.

## Acceptance criteria

- [x] Filter hook tests: substring match, case, multiple chips, empty filter
- [x] Search prefix test: `model:` parses and filters; it combines with `tag:` and `author:`
- [x] Saved filters of the other sections survive the change (test with a stored pre-change value)
- [x] The Models filter does not render in other sections
- [x] Checked in the preview at desktop and mobile width
- [x] Changelog In-Progress entry added; four gates green

## Comments

**2026-09-19, ticket session:** Done in `Add A Models Filter To The Prompts Section`.

- `model:` is taken only in the Prompts section. Elsewhere it stays search text, because a hidden model chip would empty the grid.
- No prompt view pages on the server, so the filter is client-side only.
- Live check against the local API server: `model:` chip, a match, a no-match, the suggestions, persistence across a reload, and no Models field in Worlds. Desktop 1366 px and mobile 375 px.
