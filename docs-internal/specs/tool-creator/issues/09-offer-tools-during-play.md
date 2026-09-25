# 09: Offer Tools During Play

Status: ready-for-human
Status note: built in 6e0d959e plus review follow-up; a router move restarts the turn snapshot; the drainer path and the router restart have no end-to-end test
Base: 1794c589
Blocked by: 03 — Give the Code Editor a Surface and JSON Highlighting; 06 — Run the Tool Loop in the Request Layer; 08 — Edit and Try a Tool
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## Parent

[Tool Creator](docs-internal/specs/tool-creator/spec.md)

## What to build

During play, a prompt that offers Tools sends them and the narration uses what they fetch. The game view builds one Tool Snapshot per turn and hands the pipeline's request adapter each prompt's enabled Tools (user Tools plus catalog Tools the preset turned on) and the executor. Fetched entries stay out of later turns' history.

No status line shows by default. With Show Silent Requests on, a "Looking up…" status line shows while Tools run, and AI Context shows each Tool round with its call, arguments, result and reasoning, JSON-highlighted. Stop cancels an in-progress round as it cancels anything else.

One Playwright spec defines a Tool, plays a turn against a mocked endpoint that calls it, and checks the result reached the next round and the narration landed. Append the changelog entry to the In-Progress bucket.

Model rationale: Opus at high effort for wiring through the game view, the silent-request setting, AI Context rendering and an end-to-end spec with a mocked endpoint.

## Acceptance criteria

- [x] A prompt with an enabled Tool offered to it sends that Tool; a prompt without one sends none.
- [x] The snapshot is built once per turn and shared by every request in the turn.
- [x] History for the next turn holds narration only.
- [x] With Show Silent Requests off, no status line or AI Context entry mentions a Tool; with it on, both appear, highlighted.
- [x] Stop during a Tool round ends the turn cleanly.
- [x] The Playwright spec passes on the E2E port.
- [x] Changelog In-Progress entry added in the 👤 bucket; four gates green.

## Comments

- **2026-09-25, implementation.** Built in `6e0d959e`, with the closing review folded into the commit after it. Notes:
  - `makeAIRequest` picks each request's Tools with `toolsOfferedTo(type, [...catalogTools, ...userTools])` (`src/lib/tools/toolOffer.ts`), so drainers send them too (ruling B). `AiCallArgs` keeps only `executeTool`. The turn adapter hands every request one `snapshotToolExecutor`; a request outside a turn builds its own from `toolWorld`.
  - A move by the location router starts the turn's executor over. So a Tool offered to Location that fires before the move doesn't freeze the narration's snapshot on the old scene. Such a turn builds at most two snapshots.
  - The loop yields `toolCalls` before calls run and `roundStarted` at the next round's first token, held or not. They drive **Looking up…**, gated on **Show Silent Requests**, per the round-start ruling.
  - The capability resolve now also fires when an enabled Tool is offered to any prompt. Without it, a preset with reasoning off never learned tools support, and no Tools went out. Ticket 04 left this gate for 06/09.
  - AI Context renders `toolRounds` in a **Tool Rounds** section (`ToolRoundsView`), with each round's reasoning, discarded content, calls, arguments, results and failure kind. Try It and AI Context share `ToolText` for JSON-or-text blocks.
  - Playwright: `e2e/tools-during-play.spec.ts`, 4/4 on desktop and mobile. It defines a Template Tool in the UI, checks the call, the result in round 2, **Looking up…**, the AI Context round with highlighted arguments, and next-turn history with no `tool` or `tool_calls` messages. With the silent setting off, it checks there's no status line and no AI Context round, and that Stop ends a held round with no further request.
  - Guards proven red: the enabled filter, the offered filter, the snapshot memo, the `toolCalls` and `roundStarted` events (including a reasoning-first round), the silent gate on the status line, unconditional round capture, Tools not sent, the lookup never starting or never ending, JSON highlighting off, failure label and empty-reasoning branches, and the resolve gate.
  - Not covered by a test: the drainer path, which shares the code path the turn exercises with a default executor. Also the router-move restart, which would need a routed turn with a Tool offered to Location in e2e. And the `roundStarted` → end-lookup mapping in the game view: Playwright's `route.fulfill` can't stall a stream mid-round.
  - Review items left as they are: `snapshotToolExecutor` drops `signal` because `runToolCall` takes none, and 06 already recorded that Stop can't interrupt a script. The recorded narration `reasoning` joins every round's reasoning, per 06.
