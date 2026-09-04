# 02 — Turn Plan, Pass Records, And The Planner

**What to build:** The pure planner of the Turn Pipeline: given plain-value state, settings, and the player's action, it returns a Turn Plan — which passes run this turn, with what prompts, token caps, and concurrency. Passes are data records (id, due-check, request builder, response parser) shaped so the future background-pass scheduler can consume the same definitions. Nothing is wired into the view yet; the deliverable is verifiable through the planner's own interface.

**Blocked by:** 01 — Record The Parity Fixture.

Status: done

- [x] Planner is pure: same inputs, same Turn Plan; no React, no globals, no clock — `src/lib/turnPipeline/planTurn.ts`
- [x] Every pass the current turn dispatches exists as a pass record, including the openings/edge variants — `src/lib/turnPipeline/turnPasses.ts` (14 records: the up-front router and the post-narration suggest variant are separate passes; `openingTime` is opening-turn only)
- [x] Pass eligibility rules match today's behavior exactly (the derived-boolean conjunctions become tested planner logic)
- [x] Unit tests cover eligibility per pass, prompt/cap assembly, and the concurrency knob's presence on the plan — `planTurn.test.ts` (26) + `turnPasses.test.ts` (29)
- [x] Plan output validated against the parity fixture's request contents for the recorded turns — `turnPlanParity.test.ts`: pass sequence, caps, silent/attach/quiet and byte-exact messages for all 7 turns (the character, diary and storyboard messages excepted — the fixture holds no separate record of the entity blurbs, diaries and intents they carry)
- [x] Key guards mutation-proven (e.g. a due pass wrongly skipped fails a test) — 11 mutations run, each caught
- [x] Four gates green

## Notes for the next tickets

- **The narration's system prompt is assembled by the caller** and reaches the pass as `TurnMaterial.narrationSystemPrompt`. The dictionary scan, semantic lore, banded history and notes fallback that produce it are the narration request's own assembly, not a turn decision — ticket 03/05 decides whether that moves too.
- **The parity test compares system prompts by template, not byte-for-byte**: the context values a template renders against were never recorded. The runner (03) is handed the real context, so byte parity of system prompts is checkable there.
- **Two gates, not one.** `isDue(input)` is the settings-time question; `isReady(material)` is the second one a pass can fail once the turn is under way. Only the storyboard has it today (an empty director cast skips both the character and the storyboard requests, `stagedPlanning.ts:473`), and the runner must honor it.
- **`quiet` is on the request, not the runner.** It suppresses a pass's own status label; today that is true for the batched choices/stats/location passes only. The fixture cannot verify it (the recorder never saw it), so it is unit-tested only.
- **`TURN_PASS_CAPS` is now the single source** of the per-pass token caps; GameViewer's constants read from it so the two cannot drift before 05 removes them.
