# 09: Offer Tools During Play

Status: in-progress
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

- [ ] A prompt with an enabled Tool offered to it sends that Tool; a prompt without one sends none.
- [ ] The snapshot is built once per turn and shared by every request in the turn.
- [ ] History for the next turn holds narration only.
- [ ] With Show Silent Requests off, no status line or AI Context entry mentions a Tool; with it on, both appear, highlighted.
- [ ] Stop during a Tool round ends the turn cleanly.
- [ ] The Playwright spec passes on the E2E port.
- [ ] Changelog In-Progress entry added in the 👤 bucket; four gates green.
