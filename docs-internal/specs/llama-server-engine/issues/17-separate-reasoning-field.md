# 17: Separate Reasoning Field

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one server argument, two tests, and a fixture re-record against real models.

## What to build

A model's thoughts never show in the narration, whatever tag format its template uses (spec: Proxy; ruling T17). Today the engine runs `--reasoning-format none`, so a Gemma 4 model's `<|channel>thought … <channel|>` arrives raw in `content`, and the app's tag stripper doesn't know it. The player sees the thought as the start of the story.

Run `llama-server` with `--reasoning-format deepseek`. llama.cpp's per-template parsers then put each family's thoughts in `reasoning_content`, and the proxy passes that field through unchanged. The app already reads a separate reasoning field for every endpoint: callers get the answer text, the thought streams live, and the AI-context viewer shows it under Raw Reasoning.

A prompted `<think>` (Inline thinking mode) stays in `content` on Gemma 4, so Inline mode is unchanged there.

## Acceptance criteria

- [x] `serverArgs` passes `--reasoning-format deepseek`, and the engine test that expected `none` checks it. (`runs the router with a separate reasoning field`)
- [x] The thinking fixture is re-recorded with `scripts/recordLlamaServerFixtures.mjs --thinking` from a Qwen-style thinking model, and a new one from a Gemma 4 model. Tests check that each puts the thought in `reasoning_content` and leaves `content` free of thought tags. (Qwen3.6 Anko and Gemma4-12B; `llmEngine.test.mjs` `describe.each`, `aiStream.llamaServer.test.ts`)
- [x] The guard is proven to bite: with `none` back, the Gemma 4 test fails. (Re-recorded the Gemma fixture with `none`: 3 Gemma cases failed in `aiStream.llamaServer.test.ts`, then restored.)
- [ ] A real turn on this PC with a Gemma 4 model shows no thought text in the narration, and the AI-context viewer shows it under Raw Reasoning.
- [x] The stale comments in `docs-internal/designs/thinking-modes/design.md` and `testing/baseline/harness/run.mjs` match the new format.
- [x] Changelog: edit the unreleased proxy entry in place if its "keeps raw `<think>` text" no longer holds; no new entry. (The spec session edited the entry on the target branch.)

For you: play a few turns with your Gemma 4 model and check that no thought text reaches the story.

Local GPU use: check nothing else is loaded first, keep each load short, and stop the server after.

## Landed

**Not verified**
- A real in-app turn with Gemma 4 and the AI-context viewer's Raw Reasoning section. The recorder ran a real Gemma4-12B turn through `llama-server` (thought in `reasoning_content`, `content` "Four"), and `streamAiRequest` splits the recorded stream correctly. No app run.
- A prompted `<think>` (Inline mode) staying in `content` on Gemma 4: no test covers it.
- The Qwen fixture's `content` is empty because the 600-token cap cut its looping thought off, so its "no thought tags in content" check is weak. The Gemma fixture finishes with `stop`.
- The `none` bite proof was a manual re-record; the fake server ignores its args, so no committed test fails on a code-only revert except the args test.

**For you**
- Play a few turns with a Gemma 4 model on the desktop engine; check that no thought text reaches the story (Narration).
- Open AI Context on a turn; check the thought sits under **Raw Reasoning**.
- The `gemma-4-E4B-it-heretic` template never opens a thought, even with `enable_thinking`, so the Gemma fixture comes from Gemma4-12B.
