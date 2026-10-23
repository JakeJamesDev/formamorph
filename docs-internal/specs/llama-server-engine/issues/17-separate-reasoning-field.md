# 17: Separate Reasoning Field

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one server argument, two tests, and a fixture re-record against real models.

## What to build

A model's thoughts never show in the narration, whatever tag format its template uses (spec: Proxy; ruling T17). Today the engine runs `--reasoning-format none`, so a Gemma 4 model's `<|channel>thought … <channel|>` arrives raw in `content`, and the app's tag stripper doesn't know it. The player sees the thought as the start of the story.

Run `llama-server` with `--reasoning-format deepseek`. llama.cpp's per-template parsers then put each family's thoughts in `reasoning_content`, and the proxy passes that field through unchanged. The app already reads a separate reasoning field for every endpoint: callers get the answer text, the thought streams live, and the AI-context viewer shows it under Raw Reasoning.

A prompted `<think>` (Inline thinking mode) stays in `content` on Gemma 4, so Inline mode is unchanged there.

## Acceptance criteria

- [ ] `serverArgs` passes `--reasoning-format deepseek`, and the engine test that expected `none` checks it.
- [ ] The thinking fixture is re-recorded with `scripts/recordLlamaServerFixtures.mjs --thinking` from a Qwen-style thinking model, and a new one from a Gemma 4 model. Tests check that each puts the thought in `reasoning_content` and leaves `content` free of thought tags.
- [ ] The guard is proven to bite: with `none` back, the Gemma 4 test fails.
- [ ] A real turn on this PC with a Gemma 4 model shows no thought text in the narration, and the AI-context viewer shows it under Raw Reasoning.
- [ ] The stale comments in `docs-internal/designs/thinking-modes/design.md` and `testing/baseline/harness/run.mjs` match the new format.
- [ ] Changelog: edit the unreleased proxy entry in place if its "keeps raw `<think>` text" no longer holds; no new entry.

For you: play a few turns with your Gemma 4 model and check that no thought text reaches the story.

Local GPU use: check nothing else is loaded first, keep each load short, and stop the server after.
