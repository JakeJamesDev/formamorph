# 10: Catalog Suggestions in Overview

Status: ready-for-agent
Blocked by: 01, 06
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: low

Spec: `docs-internal/specs/prompt-sharing/spec.md`

## What to build

The Overview's Tags and Models fields suggest the values other prompt listings use, so spellings converge.

- When the catalog is loaded, collect the tags and the models from listings of kind `prompt`. Rank by how
  many listings use each value.
- Tags suggests only these values. The world tag vocabulary is never used.
- Models merges these values with the endpoint ids from ticket 03, if that ticket has shipped.
  De-duplicate without regard to case and keep the more common casing.
- With no catalog loaded, or offline, the fields work as plain chip inputs. Opening the Overview does not
  start a catalog fetch by itself.

## Acceptance criteria

- [ ] Pure collector test: ranking, case-insensitive merge, other kinds ignored
- [ ] Tags shows no world-vocabulary suggestions
- [ ] Offline, both fields still accept free text with no error
- [ ] Opening the Overview makes no catalog request (network read in the preview)
- [ ] Four gates green
