# Turn Pipeline

Status: done
Status note: issues 01–06 all complete (parity fixture, plan, runner, commit, conversion, assembly extraction).

## Problem Statement

Running one game turn is implemented as a single 882-line function (`sendGameAction`) inside the GameViewer god node. The decisions (which passes run this turn, concurrent vs sequential dispatch, what folds into the commit) are interleaved with React state effects, the concurrent and sequential dispatch paths are two hand-kept-identical copies, the error taxonomy communicates with its caller through a mutated flag on the error object, and none of it is testable: the pure helpers underneath have tests, but the real bugs hide in how they are called. Understanding or changing turn behavior means reading the whole function and hoping the two dispatch paths stay in sync.

## Solution

Carve the turn into a **Turn Pipeline**: a React-free module that owns one full turn behind one seam. A pure planner produces a **Turn Plan** (which passes run, with what prompts and caps), a runner executes it — planner, narration, and the post-narration passes — through a single injected request adapter with one scheduler and a concurrency knob, and a pure commit computation produces the **Turn Commit** (the state delta) that the view applies with thin setters. Narration stream events are forwarded to the view so reveal/TTS presentation stays where it is. Player-visible behavior is unchanged; the change is that every decision the turn makes becomes testable through the pipeline's interface.

## User Stories

1. As a developer, I want the whole turn's control flow in one module, so that understanding a turn no longer means reading 882 contiguous lines of a React component.
2. As a developer, I want turn planning to be a pure function from state, settings, and action to a Turn Plan, so that "which passes run this turn" is answerable by a unit test.
3. As a developer, I want one dispatch path with a concurrency knob, so that the concurrent and sequential behaviors cannot drift apart.
4. As a developer, I want the pipeline to accept its request function as an adapter, so that tests can run a full turn without a model server.
5. As a developer, I want turn errors returned as a typed result (ok / aborted / failed with a named kind), so that the view maps kinds to toasts instead of reading a flag mutated onto an error object.
6. As a developer, I want the commit computed as a pure value before it is applied, so that the trickiest merge logic (history, clock, stats, discoveries) has tests.
7. As a developer, I want each post-narration pass described as data (id, due-check, request builder, parser), so that adding a pass is one record, not edits to interleaved control flow.
8. As a developer, I want the pass records shaped for reuse, so that the future background-pass scheduler consumes the same definitions instead of maintaining a second copy.
9. As a developer, I want a parity fixture recorded from the real app before the extraction, so that the new pipeline is proven to emit an identical request sequence to the code it replaces.
10. As a developer, I want the extraction staged with all four gates green after each stage, so that any regression bisects to a small diff.
11. As an agent working in this codebase, I want the glossary terms Turn Pipeline / Turn Plan / Turn Commit used consistently, so that the module is navigable by name.
12. As an agent working in this codebase, I want turn logic reachable without rendering GameViewer, so that I can verify turn behavior from tests instead of driving the UI.
13. As a player, I want turn behavior — narration streaming, choices, stats, location, time, diaries, discoveries — unchanged by this work, so that the refactor is invisible to me.
14. As a player, I want stopping a turn mid-stream to behave exactly as it does today, so that aborting stays predictable.
15. As a player, I want connection failures to produce the same guidance they do today, so that error recovery is unchanged.

## Implementation Decisions

- The Turn Pipeline is a React-free lib module. The GameViewer keeps all React state; the pipeline receives plain values and adapters and returns plain values.
- Three-part interface: a pure planner (state + settings + action → Turn Plan), an effectful runner (Turn Plan + adapters → typed turn result), and a pure commit computation (turn result → Turn Commit). The view's apply step is thin state setters over the Turn Commit.
- The runner owns the full turn: staged planner, narration, and all post-narration passes. Narration AI Stream events are forwarded through a callback in the runner's interface; reveal pacing, TTS, and scene-list presentation stay in the view.
- One scheduler inside the runner replaces the duplicated concurrent/sequential dispatch paths; the existing concurrent-turn-requests setting becomes a concurrency knob on the plan.
- Post-narration passes are data records — id, due-check, request builder, response parser — scheduled generically. The records are shaped so the future background-pass scheduler (separate effort) can consume the same definitions.
- Errors cross the seam as a typed result: ok, aborted, or failed with a named error kind. The HTTP-status taxonomy becomes runner implementation; the view maps kinds to toasts. The `connectionHandled` mutation on error objects is removed.
- Two seams, and only two (settled during the conversion — see `docs/adr/0001-turn-pipeline-seams.md`). The **request adapter** is the only way a request reaches the network: production passes the real AI-call function, tests a fake, the parity harness a recording wrapper. The **derivation callback** is the only way the caller's own world knowledge reaches the run — a turn's later passes depend on it (who the director cast, who the narration confirmed, where the router moved the turn) and none of it exists when the plan is made. It is awaited, so a stage boundary is also where the caller can hold the turn.
- Extraction is staged — planner first, then the scheduler/runner, then the commit computation — with typecheck, lint, test, and build green after every stage.
- Glossary terms Turn Pipeline, Turn Plan, and Turn Commit are already in the domain glossary; use them verbatim in names and docs.

## Testing Decisions

- Tests exercise external behavior through the module interfaces only: the planner and commit computation as pure functions (inputs → outputs), the runner through its interface with a fake request adapter. No reaching past the seam, no mocking pipeline internals.
- Runner tests cover: pass ordering, the concurrency knob (serial vs parallel interleavings), abort mid-narration and mid-pass, typed error kinds per failure mode, and that narration events are forwarded in order.
- Parity harness: instrument the request adapter during a baseline Sedge Landing run of the current code to record the ordered request sequence (type, system prompt, messages, caps) per turn as a fixture; a unit test replays the same inputs through the new pipeline and asserts an identical sequence. The fixture is captured before any extraction begins.
- Key guards are mutation-proven: reinstate the bug (e.g. skip a due pass, swap pass order, drop the abort translation) and show the test fails.
- Prior art: the AI Request Spec and AI Stream test suites (plain-value inputs, fake streams) are the pattern to mirror; the staged-planning and turn-digest tests show the pure-function style.

## Out of Scope

- Splitting `makeAIRequest` into a background call module and a narration-turn module (separate candidate; the pipeline consumes the current request function through the adapter).
- The background-pass scheduler replacing the five idle drainers (separate candidate; this spec only shapes the pass records it will reuse).
- The turn-policy module over the settings destructure (separate candidate; the planner takes today's derived booleans as inputs).
- Any change to prompts, sampler pins, pass eligibility rules, or player-visible behavior.
- Scene-image orchestration (separate candidate; the commit keeps triggering it exactly as today).
- New E2E coverage.

## Further Notes

- Settled in the 2026-08-13 architecture-review grilling session; glossary terms committed in 36e8962.
- The parity capture requires a local model server and the baseline harness profile, so stage 0 (capture) is interactive; the resulting fixture makes all later stages model-free.
- Stopped turns freeze nothing (existing notes-freeze semantics) — the aborted result kind must preserve that.
