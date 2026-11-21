# 09: Mobile Performance

Status: ready-for-human
Blocked by: 05, 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Layered pictures stay smooth on mobile. The spec covers this in its Rendering section.

- Measure an eight-Layer full-size rig at mobile width on a realistic device profile. Record frame times while narration streams and during a transition, and decoded image memory.
- If play stutters, draw the settled stack as one flattened bitmap (ticket 07's flatten), cached by the stack's state. Use separate Layer elements only during a transition.
- Record the numbers before and after in the ticket's Landed section.

## Acceptance criteria

- [x] Numbers recorded for the eight-Layer rig at mobile width, with the method. (`e2e/perf/layered-perf.spec.ts`; tables below)
- [x] If the cache was added, a test proves a state change rebuilds it and an unchanged state reuses it. Not needed: settled p95 is 16.8 ms, under the 20 ms bar (Q38).
- [x] Changelog fragment written, only if behavior changed. Not needed: no player-facing change; the rig, fixture and probe are dev-only.

For you: play a layered world on the Android build and judge smoothness (entity panel, backdrop).

## Landed

**Result: no cache.** The settled stack keeps p95 16.8 ms (one frame at 60 Hz) with the rig, so the cache of Q38 stays unbuilt. Nothing in play changed.

**Method.** `e2e/perf/layered-perf.spec.ts` (off unless `E2E_PERF=1`; README, "Performance probes"). Headless Chromium, 390 × 844, 3× scale, touch, CDP 4× CPU throttle. The rig, `fixture=layeredPerf`, is eight 1024 × 1536 PNG Layers drawn in code (Normal, Multiply, Screen, a tinted Layer, a Layer at 0.8 opacity, a two-Variant Face). It links the visible scout and the White Room backdrop, so 16 Layer elements draw. The control is the plain White Room fixture. Frame times are rAF deltas.

| Scenario (4× throttle) | Control | Eight-Layer rig |
|---|---|---|
| Settled play, 3 s × 6 runs: p50 / p95 | 16.7 / 16.8 ms | 16.7 / 16.8 ms |
| Settled frames over 20 ms (runs 2–6) | 0 | 0 |
| Narration turn (mock model, whole turn): p95 | 1.0–1.5 s | 0.18–4.3 s |
| Editor preview, Dissolve change × 6: p95 | | 16.7–16.8 ms |
| Editor preview, Jelly change × 6: p95 | | 16.7–33.3 ms (run 1), else 16.8 ms |

- Run 1 of each settled series has 3–4 slow frames at 0.2–0.7 s: first decode of the 1024 × 1536 images.
- The narration turn is dominated by the turn pipeline under throttle, and the control is as slow as the rig (p95 1.0–1.5 s), so the Layers are not the cost. The run to run spread is large; read it as "not worse than the control", no more.
- Changes: single frames of 80–470 ms hit 1–6 times per 1.4 s run, for both modes. Not separated from the page's own work; a flatten cache would not touch them, since a transition draws separate elements.
- Decoded image memory, by arithmetic: 8 Layers × 1024 × 1536 × 4 B = 48 MB on the entity, shared with the backdrop (same data); 54 MB with the second Face Variant. Chromium's JS heap read 110–120 MB in play, so decoded bitmaps are not in it. No browser read of decoded memory was available.

**Read with care**
- rAF deltas show main-thread stalls and the vsync floor. They do not show compositor or raster cost, so a flat 16.8 ms is evidence that the main thread is idle in settled play, not proof of a phone GPU's cost.
- The first view of a rig stalls 0.2–0.7 s at 4× throttle while the images decode. A flatten cache would not remove it: the Layers still decode once.
- The 80–470 ms hitches in changes were not traced. The claim that a cache cannot touch them rests on the design (a change draws separate elements), not on a measurement.
- Runs 2–6 open a new page in the same browser context, so they reuse its HTTP and decode caches; run 1 is the cold one. The probe's default is 3 runs; I ran 6.
- The narration spread is too wide to read as more than "not clearly worse than the control".

**Not verified**
- A real phone GPU and compositor. Headless software compositing is a proxy (Q38).
- In-play Layer changes (a rule flip on the entity panel or backdrop). The probe has no way to change game state without an AI turn, so changes are measured in the editor preview, which draws through the same picture.
- Memory read from the browser (CDP `Memory`), not tried.
- Decoded memory as the browser holds it, only by arithmetic.
- Frame times on a real streaming narration: the mock model returns the whole reply at once.

**For you**
- Play a layered world on the Android build and judge smoothness (entity panel, backdrop).
