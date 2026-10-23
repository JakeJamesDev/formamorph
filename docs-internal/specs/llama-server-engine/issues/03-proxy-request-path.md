# 03: Proxy Request Path

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: streaming proxy semantics that must keep today's request behavior exactly, plus a template edge case to verify.

## What to build

A thin proxy of ours fronts `llama-server` on the engine's current port and keeps today's request behavior (spec: Proxy; Q16, Q20, Q22).

- Strip image parts when the loaded model has no projector, and set the images-dropped header with the count.
- Merge all system messages into one at the top, and treat messages the way the current engine does, so templates that reject extra system messages or a trailing assistant turn keep working.
- Answer every `*/models` path, including the LM Studio-style probe, with the loaded model's id and state.
- Pass through unchanged: `response_format`, Extra Parameters, sampling fields, both penalty spellings, the reasoning budget fields, `chat_template_kwargs`, and `seed`.
- Run with `--reasoning-format none`, so `<think>` text reaches the app in `content`. Verify the opening tag survives when a template's generation prompt opens it, and restore it in the proxy if it doesn't.
- Abort the upstream request when the client disconnects. Stream and non-stream responses both work.

## Acceptance criteria

- [ ] Proxy tests through the fake server: image strip + header, system-message merge, the `*/models` answer on both paths, and each pass-through field arriving upstream unchanged.
- [ ] Streaming and non-streaming replies keep the OpenAI shape the app reads today.
- [ ] A client disconnect cancels the upstream request.
- [ ] The opening `<think>` tag is present for a template that opens it in the generation prompt (recorded fixture from a real thinking model).
- [ ] A real turn on this PC runs choices, stats and the location check without errors.
- [ ] Changelog fragment in `docs-internal/changelog.d/`.

For you: play a few turns with a thinking model and check the raw-output viewer still shows the thought text.
