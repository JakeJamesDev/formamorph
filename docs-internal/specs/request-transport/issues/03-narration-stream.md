# 03: Narration Stream And The View Adapters

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: replaces four hand-kept sentence cursors with one event module and rewires the reveal, read-aloud, scene list and history persistence; off-by-one errors here duplicate or drop a sentence the player hears.

## What to build

The Narration Stream module: listens to a narration request's sink and emits sentence events — opened, display text, each completed sentence once and in order, retract, finished with the final text, canceled. It owns the sentence cursors and the partial-persistence rule (add the assistant message once on first text, refresh on sentence boundaries).

Four view adapters listen to it and nothing else sentence-shaped stays in the view: the reveal (fade or smooth), read-aloud (sentence feed, restart on retract, cancel, final flush), the scene list (rebuild per completed sentence from the live scene inputs), and history persistence. A choices adapter owns the live choices list for a choices request: parse each delta, clear on retract. Live reasoning stays in the view on the transport's reasoning and delta events.

The view attaches the Narration Stream to a request by type: only the narration pass has that type, so opening and regenerate narration are covered through the runner.

No changelog entry.

## Acceptance criteria

- [ ] Narration Stream unit tests feed deltas and assert the event list: each sentence once, in order; the trailing in-progress sentence held back; retract clears and later sentences restart from zero; finished flushes a last sentence with no terminator; canceled emits no further sentences.
- [ ] A mounted test shows the partial assistant message appears once and refreshes per sentence, and an abort before text leaves no lone user turn.
- [ ] Read-aloud, the scene list and the reveal behave as before in the running app on a streamed turn, a tool-call retract and a Stop.
- [ ] Reinstating a duplicate sentence emission turns a test red.
- [ ] Four gates green.
