# 03: Endpoint Model Suggestions

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/prompt-sharing/spec.md`

## What to build

The Models field on the Overview suggests the models the author's endpoints report, with clean names.

- A new pure function turns a `/models` response body into a list of model ids. It accepts the LM Studio
  body shape and the OpenAI body shape. A malformed body gives an empty list.
- The function cleans each id for display: it removes a model file extension and a trailing quant suffix,
  then de-duplicates. Keep the rule table small and tested; do not guess at vendor prefixes.
- A small loader fetches the list for one endpoint on demand and caches it per endpoint for the session.
  It reuses the existing models-URL derivation. A failed fetch gives an empty list and no toast.
- The Models field requests lists for the active endpoint and for every endpoint a prompt is routed to,
  when the field opens.
- The existing reachability probe keeps its three-value verdict. Do not widen its return type.
- On the desktop built-in engine, use the local model list the engine already exposes.

## Acceptance criteria

- [ ] Pure function tests: both body shapes, extension removal, quant removal, de-duplication, malformed body
- [ ] The loader fetches once per endpoint per session (test with a counted fetch stub)
- [ ] The Models field shows the cleaned ids as suggestions; free text still commits
- [ ] An unreachable endpoint leaves the field usable with no error shown
- [ ] The reachability probe and its tests are unchanged
- [ ] Verified in the preview against a real local model server
- [ ] Four gates green
