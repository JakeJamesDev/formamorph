# 06 — Extract The Narration Assembly Out Of The Turn Handler

**What to build:** The turn handler is 681 lines, down from 882. Two of its named steps are nearly pure and account for most of what is left: `assembleNarration` (~180 lines — the dictionary scan, the system-prompt render, the notes fallback, the history trim, the precall planner's band) and `readNarration` (~110 — participants, the scene list, visitors, the scene entity tokens). Move both to lib modules that take plain values and return the material patch, leaving their handful of ref/state writes at the call site. Target: the handler around 350 lines.

**Blocked by:** 05 — Convert GameViewer (done).

Status: done

**Why it was split off:** `assembleNarration` builds the narration system prompt — the highest-risk surface in the app — and issue 05 was already a nine-commit unpushed stack. Re-proving that assembly deserves its own diff and its own parity capture.

- [x] `assembleNarration` is a lib module taking plain values; the view keeps only the ref/state writes (`lastRelevanceScoresRef`, `lastActionVecRef`, `pendingDictionaryDebugRef`, `addMessageToHistory`, `setLastPromptChars`)
- [x] `readNarration`'s pure half (participants, scene list, visitor selection) is a lib module; the `setVisibleEntities` / `setDiscoveredEntities` calls stay in the view
- [x] Both have unit tests over plain inputs — no GameViewer render
- [x] The turn handler is under ~400 lines
- [x] A live baseline Sedge Landing run still emits the recorded pass order and envelope (the check issue 05 ran)
- [x] The narration system prompt is byte-identical for a fixed input, proven by a test — not by eye
- [x] Four gates green; graphify updated

## What landed

Four lib modules, not two — the assembly split along its own seams rather than moving as one lump:

| module | what it owns |
|---|---|
| `lib/turnPipeline/narrationPrompt.ts` | dictionary scan → activation → both lorebook blocks → prompt render → notes fallback → language → the AI-context capture |
| `lib/turnPipeline/plannerBand.ts` | the precall planner's own history band (its endpoint's window, floor, no rehydration) |
| `lib/turnPipeline/narrationReading.ts` | participants, the scene list, visitor selection, the post-narration fan-out split, the choices-scoped entity list |
| `turnPlan.ts` `emptyTurnMaterial` | a turn's starting material from the four values known up front |

Two blocks also moved out of the handler to component scope, unchanged: `reportTurnFailure` (error presentation) and `applyTurnCommit` (the thin-setter apply step the spec already describes as its own thing).

**Handler: 681 → 392 lines.** 28 new tests; 5 guards mutation-proven (notes-fallback placement, presence-reads-prose, visitors-take-full-names-only, the planner's own window, suppression in the fan-out split).

**Parity re-run** — `npm run baseline -- --profile parity --model gemma4-e4b-cloud`, 7 turns / 79 requests, against the recorded fixture:

- Pass order identical on all 7 turns once fan-out is collapsed; envelope (cap, silent, attach, messages) identical for all 12 pass types; drainers 7/7; orphans 0/0.
- The only differences are fan-out *widths*, and both track the model's own answer: `character` passes == the director's non-player cast bullets (14/14 turns across both runs), `diary` passes == authored entities the narration prose names (14/14).
