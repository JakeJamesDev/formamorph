# 01: Demo AI Identity and Rename

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/demo-ai/spec.md`

## What to build

The hosted endpoint gets the name **Demo AI** in every player-facing place that names it today. The name
applies only when the built-in default preset points at the hosted service URL. A build that overrides the
default endpoint keeps the name "Default".

This ticket is the tracer for the whole effort. It adds the one rule that says "this is the Demo AI", and
every later ticket reads that rule.

- The hosted service URL becomes its own constant. The overridable default-endpoint constant falls back to
  it.
- A pure helper answers "is this resolved endpoint the hosted Demo AI": the preset id is the built-in
  default id, and the URL is the hosted service URL. The existing "built-in preset is active" check does not
  serve, because it is also true for the desktop engine and for ghost ids.
- The built-in preset's display name, the active-preset name fallback, and the routed-prompt preset name
  fallback all follow the rule.
- The Settings hint that says "shared endpoint" says "Demo AI" on the hosted URL.

## Acceptance criteria

- [ ] On the hosted URL, the endpoint preset list, the active preset name, and routed-prompt preset names in the AI context viewer and Prompt Options read **Demo AI**.
- [ ] On a build with an overridden default endpoint, the same places read "Default".
- [ ] The helper is true only for the built-in default id on the hosted URL. It is false for an overridden default, for a user preset on any URL (the hosted URL included), and for the desktop engine.
- [ ] The helper accepts a resolved endpoint, so a caller can ask about the narration prompt kind's endpoint.
- [ ] The preset id, the constants' names, the `VITE_DEFAULT_*` names, and the model alias do not change. A stored active preset and stored prompt routing survive the change.
- [ ] Other "Default" labels do not change: prompt presets, dictionary books, image presets, "Endpoint Default".
- [ ] The Settings context-window hint uses "Demo AI" in place of "shared endpoint", with copy per the help-copy rules.
- [ ] Tests at the text endpoint preset seam and the prompt routing seam prove each case above. Each guard fails when its bug returns.
- [ ] `docs/Changelog.md` has one In-Progress entry in the player bucket that states the rename from "Default" to "Demo AI". Released sections do not change.
- [ ] No world or save export shape changes.
- [ ] Four gates green. `graphify update .` run.
