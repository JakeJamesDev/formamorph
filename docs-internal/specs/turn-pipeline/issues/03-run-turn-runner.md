# 03 — The Runner: Scheduler, Typed Errors, Narration Forwarding

**What to build:** The effectful runner of the Turn Pipeline: it takes a Turn Plan plus the single seam — an injected request adapter — and executes the full turn: staged planner call, narration (forwarding AI Stream events to a callback so presentation stays in the view), then the post-narration passes through one scheduler whose concurrency knob replaces today's duplicated concurrent/sequential paths. The outcome is a typed result: ok, aborted, or failed with a named error kind; the HTTP-status taxonomy becomes implementation.

**Blocked by:** 02 — Turn Plan, Pass Records, And The Planner.

Status: done

- [x] One dispatch path; serial and parallel are the same code under a knob — `src/lib/turnPipeline/turnRunner.ts` (`isBatched` is the only place the knob is read)
- [x] Narration events forwarded in order; the view-side consumer sees exactly what the stream emitted — the sink is handed to the narration pass only
- [x] Abort mid-narration and mid-pass produce the aborted result; stopped turns freeze nothing (the aborted run carries no post-narration outcomes, so nothing from a stopped batch is read)
- [x] Failure modes return named error kinds; no mutation of flags onto error objects — `turnErrors.ts` (`connection` / `notFound` / `badRequest` / `parse` / `emptyNarration` / `unknown`)
- [x] Fake-adapter tests cover ordering, both concurrency modes, abort points, and each error kind — `turnRunner.test.ts` (30) + `turnErrors.test.ts` (6)
- [x] Parity replay test: the recorded fixture inputs through planner + runner emit a request sequence identical to the fixture — `turnRunnerParity.test.ts`: all 7 turns, type/cap/silent/attached-turn per request plus byte-exact messages for the 8 passes whose inputs the fixture holds
- [x] Key guards mutation-proven — 11 mutations run, each caught
- [x] Four gates green

## Notes for the next tickets

- **Two hooks, one seam.** The request adapter is the only effect seam. `advance` is the caller's *pure* derivation step — it is where world knowledge (context values, entity matching, cast classification, participant extraction) enters, called at each stage boundary and after each pass answers. Ticket 05 supplies GameViewer's version of it.
- **Fan-out subjects live in the material** (`TurnMaterial.subjects`), filled by `advance`. The runner never invents one: a due fan-out pass with no subjects sends nothing.
- **A batched failure is absorbed; an unbatched one ends the turn.** That asymmetry is today's behavior, preserved deliberately — sequentially dispatched, a failed aux request has always taken the turn down with it. Worth revisiting *after* the extraction, as a behavior change with its own decision.
- **The commit is not the runner's.** It returns `TurnRun` (final material + every outcome, parsed by the pass that asked); folding that into state is ticket 04.
- **Open for 05, found in review — two view behaviors the runner has no home for yet:**
  - *Early choices unblock.* Today `setChoicesReady(true)` fires the moment the choices request resolves, ahead of the rest of the batch (`GameViewer.tsx:2048`). The runner's batch hook fires only after the whole batch settles, so 05 needs a per-request settled callback (or the input stays blocked until the diaries finish). Not added here — a hook with no consumer is speculation.
  - *Silent passes and the connection guide.* `makeAIRequest` rethrows a silent failure **before** the connection toast, so today a sequential `timePassed`/`openingTime` network failure surfaces the generic message. The runner names it `connection` regardless, so 05's kind→toast mapping must decide whether to keep that quirk.
- **The 404/400/parse cascade now exists twice** — here and in `GameViewer.tsx:2273`. Deliberate while the view still dispatches; 05 deletes the view's copy.
- **No tail abort check.** Every await is followed by one and nothing between the last of them and the return can await, so a tail guard would be unreachable (see 28d3d79 for the same call made before).
