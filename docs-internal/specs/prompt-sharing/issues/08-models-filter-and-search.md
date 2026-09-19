# 08: Models Filter and `model:` Search

Status: ready-for-agent
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

- [ ] Filter hook tests: substring match, case, multiple chips, empty filter
- [ ] Search prefix test: `model:` parses and filters; it combines with `tag:` and `author:`
- [ ] Saved filters of the other sections survive the change (test with a stored pre-change value)
- [ ] The Models filter does not render in other sections
- [ ] Checked in the preview at desktop and mobile width
- [ ] Changelog In-Progress entry added; four gates green
