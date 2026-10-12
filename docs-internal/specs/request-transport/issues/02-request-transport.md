# 02: Request Transport With A Per-Call Sink

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: lifts a 350-line closure out of the god node into a React-free module and defines the sink vocabulary every later ticket builds on; the split between transport and presentation must be exact or parity and the viewer drift.

## What to build

The Request Transport module: one function that carries an AI request from spec to final text outside React. It resolves the endpoint, offers Tools, runs the AI Stream and its tool rounds, strips reasoning, trims a length-capped narration to its last sentence (narration only), notes the reasoning capability, records parity at its entry, and classifies failures as today (rejected override surfaces even when silent; a silent failure throws without a toast; a foreground failure toasts once).

It reports through one sink per call with a typed event vocabulary: request captured, stream opened, delta, reasoning, tool calls, round started, tool round, response captured, failure classified, done. It takes a plain context built by the view (settings snapshot resolver, Tool list and enablement, Tool snapshot executor, inspection toggle) and reads it once per call.

The view's adapter becomes a thin composition: build the context, attach a sink that drives today's presentation code unchanged (reveal, read-aloud, scene list, partial persistence, live reasoning, choices, lookups, status label, debug capture), call the transport. The Turn Pipeline runner's dead per-request stream hook and narration event option are removed; the runner's request adapter type stays as ADR-0001 defines it. The written-page runner test is rewritten without those hooks and still proves the adapter is never called.

ADR-0012 records the decision: the Request Transport has one sink per call; the Turn Pipeline's two seams stand. ADR-0001 gets a one-line pointer.

No changelog entry.

## Acceptance criteria

- [ ] The transport module imports nothing from React or the view and is covered by tests with a fake AI Stream and a recording sink: abort before any text resolves to empty text and emits no opened event; abort after text emits canceled; a tool-call round after text emits retract and the final text excludes the retracted round; a length-capped narration is trimmed and a length-capped stats reply is not; a silent failure throws without a failure event; a rejected override emits its notice on a silent request; request and response captures carry the wire body and raw reply.
- [ ] The parity recorder records at the transport's entry; the runner parity replay is unchanged.
- [ ] A turn, a re-roll and a silent pass behave as before in the running app: reveal, read-aloud, scene list, AI-context viewer capture, failure toast.
- [ ] The runner's unused stream hooks are gone; the written-page test still passes.
- [ ] ADR-0012 exists and ADR-0001 points to it.
- [ ] Reinstating the stats trim or dropping the canceled event turns a test red.
- [ ] Four gates green.
