# 03: Proxy Request Path

Status: done
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

- [x] Proxy tests through the fake server: image strip + header, system-message merge, the `*/models` answer on both paths, and each pass-through field arriving upstream unchanged. The "proxy request path" block in `llmEngine.test.mjs`; 10 mutations, each red on its own test.
- [x] Streaming and non-streaming replies keep the OpenAI shape the app reads today. "keeps the OpenAI reply shape, streamed and not".
- [x] A client disconnect cancels the upstream request. Two hang-up tests: mid-stream and before a non-stream reply.
- [x] The opening `<think>` tag is present for a template that opens it in the generation prompt (recorded fixture from a real thinking model). `b11829-thinking.json`, Qwen3.6-35B-A3B: the generation prompt ends in `<think>\n` and `content` starts with it, so no restore was built (T03-3).
- [x] A real turn on this PC runs choices, stats and the location check without errors. World probe, drone world, 2 runs × 3 turns through the real engine with Impish 3B; see Landed.
- [x] Changelog fragment in `docs-internal/changelog.d/`.

For you: play a few turns with a thinking model and check the raw-output viewer still shows the thought text.

## Landed

**Shown on this PC (RTX 4090)**
- Thinking fixture: one short load of Qwen3.6-35B-A3B Anko, nothing else loaded. With `--reasoning-format none`, both the plain and the streamed reply start with `<think>\n`.
- Real turns: the engine served Impish 3B, and the world probe played the drone world through it, 2 runs × 3 turns. All 20 requests answered: narration, choices, stats and the location check (`NONE`, then `Scavenger Wastes`), with no errors. Impish wrote the choices as prose, so 1 of 6 parsed as a list: model quality, not the proxy. Stop left no `llama-server` process.

**Not verified**
- The `keepImages` path runs only in a unit test of `shapeChatBody`: nothing sets a projector until ticket 08.
- Branch coverage of `chatShape.cjs` is 70.7%; the misses are null and empty defaults (`content || ''`, an empty messages list).
- The thinking reply hit its 600-token cap before `</think>`, so the fixture shows the opening tag only.

**For you**
- Play a few turns with a thinking model and check the raw-output viewer still shows the thought text.
- The world probe's tracked `appDriver.mjs` waits for "Start game", but the button now reads **Start Game**, so every probe run stops before the game screen. I ran a scratch copy with the label fixed.
- `npm run llama-server:fetch` fails on Windows while it unpacks the macOS builds: tar can't create their `.dylib` symlinks ("Invalid argument"). The Windows build lands first.
