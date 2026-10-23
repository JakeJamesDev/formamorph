# 11: Engine Docs

Status: ready-for-agent
Blocked by: 05, 06, 07, 08
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: player docs for settings that already exist, in a set house style.

## What to build

Player docs for the new engine (spec: Solution; Q15).

- Settings help: rows for Unified KV Cache, K Cache Type, V Cache Type, KV Cache in RAM and Context Overflow, plus the corrected Parallel Requests and Flash Attention rows.
- Image input: how a vision model finds its projector.
- Rebuild the Formaquestion help vectors so it answers about the new settings.
- Check the changelog leads from tickets 02–08 read as one coherent story for the release.

## Acceptance criteria

- [ ] Settings help covers every new and changed engine setting; `copy-sweep` passes on it.
- [ ] The help vectors are rebuilt, and a Formaquestion query for each new setting returns its section.
- [ ] The changelog leads for this effort name the Unified KV Cache default and the Flash Attention change.
