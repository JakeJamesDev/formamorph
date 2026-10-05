# 06: Image probe and badges

Status: done
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The image endpoint preset select and the in-game image preset picker show whether the active image server answers.

- A provider-keyed probe beside the text probe. ComfyUI reads its node info. InvokeAI reads its model list. A1111 reads its model list. OpenAI reads its model list through the desktop bridge and is disabled in the web build. NovelAI is disabled.
- A provider with a model list reports "Reachable, but no model" when the configured model is absent.
- The hook's cache keys on provider, endpoint and model. The Settings select and the in-game picker share one answer.
- No probe sends a generation request.

Spec: Q5, Q6; Implementation → Image probe, Reachability on endpoint selects.

Recommended model rationale: five provider paths with distinct protocols, a desktop-only branch, and fetch-mocked tests per provider.

## Acceptance criteria

- [ ] Fetch-mocked tests cover each provider, the two disabled cases, and the missing-model state.
- [ ] The badge appears under the image preset select and the in-game picker, with no badge for NovelAI or OpenAI on web.
- [ ] One probe serves both surfaces for the same preset.
- [ ] Changelog line under In Progress.
