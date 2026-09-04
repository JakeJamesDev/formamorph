# 04 — Convert GameViewer to the AI Stream

**What to build:** GameViewer's request path runs through the new modules: `makeAIRequest`'s ~250 lines of endpoint/body/SSE code are replaced by a body that snapshots settings, calls `buildAiRequestSpec`, and for-awaits `streamAiRequest` events — per-delta handling (reveal, TTS, entity cursors, live reasoning) and debug capture consume the typed events. The function survives only as GameViewer's consumer (capture, status label, silent rules, error toasts); no protocol knowledge remains in the component. Call sites are untouched. Stop must keep partial narration exactly as today — the graceful `done` now *returns* partial content, so guard against double-committing it. Player-visible behavior is unchanged. See [../spec.md](../spec.md) — especially Out of Scope (no behavior change, request path only).

**Blocked by:** 01 — AI Request Spec module; 02 — AI Stream module; 03 — Baseline before-capture.

Status: done

- [x] No fetch/SSE/body-building code remains in GameViewer; the request path is module-only
- [x] Reveal pacing, TTS cursors, entity cursors, and debug-turn view behave as before
- [x] Four gates green
- [x] `npm run baseline` "after" run compared against ticket 03's dumps with no unexplained AI-context differences
- [x] Changelog In-Progress entry appended (🛠️/⚙️ bucket)

## Comments

**Converted 2026-08-13** over three commits, all on `main` and unpushed:

| Commit | What |
|---|---|
| `ab439fe` | The conversion. `makeAIRequest` lost ~250 lines. |
| `bba69e1` | Three regressions the code review caught, plus the standards items. |
| `28d3d79` | Deleted the abort branch the conversion made unreachable. |

A `grep` for `data: ` / `TextDecoder` / `getReader` / `max_tokens` / `repeat_penalty` /
`resolvePromptSampler` / `reasoningBudgetBody` / `reasoningEffortBody` over
[GameViewer.tsx](src/views/GameViewer.tsx) returns nothing.

**Gates (final):** typecheck 0 · lint 0 · test 4091 passed / 3 skipped (24.1s) · build ✓.
**Coverage** on `src/lib/aiRequest`: 100% stmts, 98.1% branch (`aiRequestSpec.ts` 100/100,
`aiStream.ts` 100/97.7).

**After-capture:** two runs, both 7/7 turns, same arm and profile as ticket 03 —
`A-cydonia-lmstudio-2026-08-13T15-01-35-333Z.json` (after the conversion) and
`…T15-28-03-316Z.json` (after all three commits). Compared against the before-dump on AI-context *shape*
— per turn: action, request types and their order, message roles, system-prompt lengths, resolved
endpoint, dictionary attachment, response presence. **All 7 turns identical across all three runs.**
Request *body* fields aren't in the dump; those rest on
[aiRequestSpec.test.ts](src/lib/aiRequest/aiRequestSpec.test.ts), not on the baseline.

### Three ordering hazards, all found by review rather than by the gates

The four gates and the first baseline run were green *before* any of these were found — worth recording,
because it means neither gate covers the consumer side of the seam.

1. **Reveal reset / TTS start.** These used to run after the `response.ok` check. Hoisting them above the
   stream (the naive conversion) blanks the narration on a dead endpoint; deferring them to the first
   token left the previous turn's reasoning state on screen through the whole TTFT window. The stream now
   emits a `response` debug once the endpoint has accepted the request and has a body — the same point the
   old code cleared at — and the consumer opens on that. Pacing was never at risk either way:
   [useSentenceReveal.reset](src/lib/useSentenceReveal.ts:134) nulls `lastArrivalAt`, so the pacer's clock
   starts at the first `push()`.
2. **Graceful abort.** The `done` event carries partial content. The turn still returns `""`, so the kept
   narration remains the assistant message persisted during streaming — not a second commit.
3. **Per-delta errors killed the turn.** The old `processLine` wrapped every per-token side effect in one
   catch that logged and continued; the `for await` loop only inherited the module's *parse* guard, so a
   throw from the reveal push, TTS, `buildSceneList` or `parseChoices` escaped to the outer handler and
   toasted the turn dead. The `try` is back around the per-event body.

### One bug in the ticket-02 module, fixed here

`firstContentAt` was stamped by any content frame, but the old gate was non-empty *stripped* display. A
model leading with a newline stopped its own live scratchpad rendering and stamped the think duration at
the whitespace. It now waits for a visible character
([aiStream.ts:172](src/lib/aiRequest/aiStream.ts:172)).

### Testing

Both new module guards mutation-tested: reverting the whitespace gate reddens 2 tests, deleting the
`response` debug reddens 1. Source restored and verified by grep, not by memory.

**Named as untested:** the per-delta `catch`. It lives in GameViewer, which has no test harness, so it
rests on inspection against the old `processLine` — not on a running test.

### Deviation from the original ticket text

The "for-await at all 31 call sites / delete the function" wording was revised before implementation
(see the dated note in [../spec.md](../spec.md)): only narration and choices consume per-delta state, and
the staged-thinking pipeline takes `makeAIRequest` as a function value, so per-site loops would have
duplicated the capture/label/toast concerns ~30×.
