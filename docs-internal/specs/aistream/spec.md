# Spec: AI Stream extraction

Status: ready-for-human
Status note: all four issues built and their boxes ticked; 03/04 are done, 01/02 sit at ready-for-human awaiting review.

## Problem Statement

Every AI call in Formamorph runs through one ~350-line function buried inside the GameViewer god module. It owns endpoint routing, sampler resolution, request-body construction (including per-engine quirks like dual penalty spellings and omit-the-field rules), SSE parsing, reasoning-field accumulation, throttling, and abort — all closed over ~20 pieces of component state. None of it is testable without mounting GameViewer, and GameViewer has no tests. Every model-compatibility bug (reasoning fields, penalty spellings, empty-content models) lands in untested code, and there is no place to write a regression test when one is fixed.

## Solution

Extract the entire request path — settings resolution through streaming — into two deep modules behind small interfaces: a pure **AI Request Spec** layer (settings snapshot in, complete request spec and body out) and an **AI Stream** layer (spec in, typed async event stream out). GameViewer becomes a consumer: it snapshots settings, iterates events, and renders. All protocol knowledge concentrates in one tested place.

## User Stories

1. As a player, I want AI narration to stream exactly as it does today, so that the refactor is invisible to me.
2. As a player, I want the Stop button to keep the partial narration already streamed, so that an aborted turn is still usable.
3. As a player using a native-reasoning model, I want live reasoning text to update smoothly (throttled), so that the UI doesn't jank.
4. As a player on the built-in local engine, I want reasoning budget sent as the engine expects, so that thinking modes work.
5. As a player on an external OpenAI-compatible endpoint, I want reasoning effort sent in the form that endpoint expects, so that reasoning models behave.
6. As a player on LM Studio, I want penalty fields sent in the spelling it accepts, so that sampler pins actually apply.
7. As a player, I want a failed request (HTTP error, missing body) to surface as the same error handling as today, so that a dead endpoint doesn't hang a turn.
8. As a developer, I want request-body construction to be a pure function, so that every engine quirk is a table-driven unit test.
9. As a developer, I want SSE parsing tested against chunk-split events, so that the buffering rule ("never assume one event per chunk") is guarded.
10. As a developer, I want a typed event vocabulary (delta / reasoning / debug / done), so that consumers can't misread the stream.
11. As a developer, I want the done event to carry content, reasoning text, finish reason, and timings, so that consumers need no side accumulation.
12. As a developer, I want debug-turn capture fed from stream events, so that the AI-context debug view works without reaching into the module.
13. As a developer fixing a future model quirk, I want one file to edit and one test table to extend, so that the fix has locality.
14. As a developer, I want GameViewer's call sites to read as plain for-await loops, so that the turn flow is legible.
15. As a maintainer, I want the module free of React imports, so that it can be tested headless and reused (e.g. by probes or the baseline harness) later.

## Implementation Decisions

- Two modules, two seams (settled in grilling, 2026-08-12):
  - **AI Request Spec** module: takes a plain per-call settings snapshot (endpoints, sampler pins, reasoning preferences, generation params) plus prompt/messages/request-type, resolves endpoint and sampler, and exposes `buildRequestBody` producing the full engine-split body. Pure values in, pure values out; no React, no fetch.
  - **AI Stream** module: takes an `AiRequestSpec`, performs the fetch, and returns an async iterator of typed events `delta | reasoning | debug | done`. `done` carries `{ content, reasoningText, finishReason, timings }`.
- The 80 ms reasoning throttle lives inside the AI Stream module; consumers receive render-ready cadence.
- Abort (AbortSignal) ends the stream gracefully: `done` with partial content and `finishReason: 'aborted'`. No throw on user stop.
- Failures throw a typed `AiStreamError` with kind `http | no-body | parse` (plus status where relevant).
- Debug information (built body, timings) is emitted as `debug` events; GameViewer's debug-turn capture consumes them. The module knows nothing about debug UI.
- The whole request path converts to the modules in this effort — no old protocol code (fetch, SSE parsing, body building) survives in GameViewer. Call sites keep calling GameViewer's consumer function; it is a consumer of the stream, not a compatibility wrapper (revised 2026-08-13: only narration/choices consume per-delta state, and one site passes the function by value, so per-site for-await loops would duplicate the capture/label/toast concerns ~30×).
- GameViewer retains only: building the settings snapshot, the for-await loop, and UI state updates (reveal, TTS cursors, entity cursors, debug turns) plus its consumer concerns (debug capture, status label, silent-request rules, error toasts).
- Engine variance behind the seam: built-in local engine vs external OpenAI-compatible vs LM Studio — including the reasoning body split (budget-tokens vs effort), the dual penalty spellings, and omit-field rules. These become data-driven cases, not comments.
- Vocabulary per CONTEXT.md: **AI Stream**, **AI Request Spec**. Use these names.

## Testing Decisions

- Test only through the two seams; no tests reach into internals, and no new GameViewer seam is created.
- **AI Request Spec tests**: table-driven — one row per (engine kind × reasoning mode × sampler pin) covering field presence/absence, penalty spellings, budget vs effort, stop sequences. Prior art: the pure-function test style of `statCodeAnalysis.test.ts` / `statCodeSurface.test.ts`.
- **AI Stream tests**: mocked fetch returning scripted `ReadableStream` chunks — events split across chunk boundaries, reasoning/reasoning_content fields, finish_reason, abort mid-stream (asserting graceful `done` + partial content), HTTP error, missing body, malformed JSON line. Fake timers for the throttle. Prior art: worker/service tests such as `StatTemplateStorageService.test.ts` for the mock discipline.
- Good test = asserts observable events/results at the seam, never internal state; each guard must fail if its quirk-handling is removed (mutation check per the test-bar).
- End-to-end proof of the call-site conversion: four gates green plus one `npm run baseline` Sedge Landing run comparing AI-context dumps before/after.

## Out of Scope

- Any behavior change: prompts, sampler values, endpoint routing rules, reveal pacing, and TTS remain exactly as today.
- App-side handling of native-reasoning `content`-emptying models (pending design decision; probes/harness only today).
- Converting other GameViewer responsibilities (turn orchestration, presence, memory) — this effort extracts the request path only.
- Reusing the module from the baseline harness or probes (enabled, not done here).
- Any world/save export-shape change (none expected; flag immediately if one appears).

## Further Notes

- GameViewer is ~4,870 lines; the extraction should remove roughly 350 of them plus per-call-site accumulation code.
- Riskiest element (acknowledged in grilling): converting all 31 call sites in one effort. The baseline smoke is the non-negotiable mitigation.
- Architecture review report (2026-08-12) rated this the strongest deepening candidate: ~250 untested protocol lines, 31 call sites of leverage.
