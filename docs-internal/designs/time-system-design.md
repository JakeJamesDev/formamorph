# In-world time — research & design

**Status:** design proposal, nothing implemented. Needs a user decision on export-shape versioning before any code lands.

**Problem:** memory is accurate about *what* happened and useless about *when*. Digests ride as an undated chronicle, so the model cannot tell whether a remembered moment was an hour or three weeks ago, and it invents. No prompt fix reaches this — the data isn't recorded.

---

## 1. What we already have

There is a clock. It is hardcoded, and the AI has never seen it.

| Thing | Where | Reality |
|---|---|---|
| `gameTime` (hours since start) | [gameplay.ts:129](src/types/gameplay.ts:129), [GameplayContext.tsx:52](src/contexts/GameplayContext.tsx:52) | Real state, saved per snapshot |
| Advance | [GameViewer.tsx:1962](src/views/GameViewer.tsx:1962) | `handleTimePassed(1)` — **flat +1 hour per turn**, `// Default 1 hour passed per action` |
| Consumers | [GameViewer.tsx:1042](src/views/GameViewer.tsx:1042), [GamePanels.tsx:333](src/components/game/GamePanels.tsx:333), [GamePanels.tsx:1013](src/components/game/GamePanels.tsx:1013) | Stat regen + starvation; Log rows `[3d 4h]`; stats readout |
| In any prompt | — | **Nothing.** No time/date token appears anywhere in [GamePrompts.ts](src/components/game/GamePrompts.ts) |
| Memory age | [memoryRelevance.ts:16](src/lib/memoryRelevance.ts:16) | `RELEVANCE_HALF_LIFE_TURNS = 40` — decay is in *turns*, not story time |

So: a three-week timeskip and a two-line exchange both cost exactly one hour, and either way the model is told nothing.

---

## 2. Documented prior art

Everything below is from published docs/papers. Source code was **not** read for any unlicensed project — `kaldigo/SillyTavern-Tracker` and `SpicyMarinara/rpg-companion` carry no usable license, so they contributed documentation only. Only [BetterSimTracker](https://github.com/ghostd93/BetterSimTracker) (MIT) is source-readable if we want implementation detail.

### 2a. Roleplay apps

Nobody solved this in code. Every documented implementation is the same shape: **a structured state block regenerated per turn by an AI call, stored per message, hand-editable, re-injected.**

| Project | Mechanism | License |
|---|---|---|
| [SillyTavern-Tracker](https://github.com/kaldigo/SillyTavern-Tracker) (98★) · [pipeline docs](https://deepwiki.com/kaldigo/SillyTavern-Tracker/3-generation-pipeline) | Per-message tracker, 3 modes — **inline** (prepended to the narration), **single-stage** (separate call: context + system + request templates), **two-stage** (summarize the message's *changes* first, then apply them to the tracker). Docs state two-stage "provides more accurate results for complex scenarios by separating change detection from tracker generation." Parses JSON **or** YAML. Persists per message, so it outlives context eviction. | none |
| [RPG Companion](https://github.com/SpicyMarinara/rpg-companion-sillytavern) (292★) | Info-box widgets: date, time, weather, temperature, location, recent events. "Together mode" parses them out of the main response; "Separate mode" makes a second API call and injects a context summary into the next generation. All widgets hand-editable. | NOASSERTION |
| [BetterSimTracker](https://github.com/ghostd93/BetterSimTracker) (34★) | `date_time` as a custom stat kind. Legacy vs **JSON extraction** modes with confidence/delta rules; batched or one-call-per-stat ("slower, usually more robust parsing"). Injection template with size-based trimming. | **MIT** |
| [Doom's Enhancement Suite](https://github.com/DangerDaza/Dooms-Enhancement-Suite) | Scene-header blocks with time/date/location/weather. | NOASSERTION |
| [SillyTavern core](https://docs.sillytavern.app/usage/core-concepts/macros/) | **Real-world time only**: `{{time}}`, `{{date}}`, `{{isodate}}`, `{{weekday}}`, `{{datetimeformat::…}}`, `{{idleDuration}}`, `{{timeDiff::a::b}}`. When asked for in-world time the maintainer [pointed at the macros](https://github.com/SillyTavern/SillyTavern/discussions/4010) — there is no in-world clock. | AGPL |

**Three things worth taking:**
1. **Ask for the delta, not the clock.** Change detection separated from state update is the documented accuracy win. It's also the only shape a 12B model can do — "how much time passed?" is one token; "what is the date now?" is date arithmetic.
2. **Per-message persistence.** The stamp belongs on the turn, not on a global that rollback has to unwind.
3. **Hand-editable.** Universal across all four. The model *will* be wrong; the fix is a correctable field, not a better prompt.

### 2b. Memory research — the part that addresses accuracy

| Concept | Source | Bearing here |
|---|---|---|
| **Bi-temporal facts** — every edge carries `valid_at`/`invalid_at` (world time) *plus* created/expired (ingestion time). A contradiction closes the old validity window instead of deleting. | [Zep/Graphiti](https://arxiv.org/abs/2501.13956) · [explainer](https://www.getzep.com/ai-agents/temporal-knowledge-graph/) | Facts need a validity *interval*, not a creation point. Also: Zep explicitly handles **both** absolute ("June 23, 1912") and relative ("two weeks ago") phrasings. |
| **Semantic time ≠ dialogue time**; **durative** memory (states spanning a period) vs point-wise events. +12.2% on temporal reasoning. | [Beyond Dialogue Time / TSM](https://arxiv.org/html/2601.07468v1) | Names our bug exactly: digests are ordered by *when narrated*, not *when they happened*. And "she's been injured three days" is a duration, not an event. |
| **Timestamped memory stream**; retrieval = relevance × recency × importance, recency an exponential decay (0.995) over **in-sim hours**. | [Generative Agents](https://ar5iv.labs.arxiv.org/html/2304.03442) | We already have relevance × recency × importance ([turnBanding.ts:389](src/lib/turnBanding.ts:389)). The one difference is that their decay runs on the *game clock*. |
| **Ebbinghaus decay** R = e^(−t/S), S strengthened per recall. | [MemoryBank](https://arxiv.org/abs/2305.10250) | Alternative curve if turn-based decay proves wrong. |
| **Custom timestamps** (Unix seconds, decoupled from insert time); v3 temporal reasoning ranks the right dated instance. | [Mem0 docs](https://docs.mem0.ai/platform/features/timestamp) · [blog](https://mem0.ai/blog/introducing-temporal-reasoning-in-mem0) | We already ship Mem0 — feeding story time as `created_at` is nearly free. |
| LLMs infer duration from token count, not elapsed time; self-estimates off 5–10×; timestamps alone lift alignment to only ~65%. | [Do LMs Know Time Passes?](https://arxiv.org/html/2506.05790v1) | Sets the bar: a bare timestamp field will not be enough. Render relative phrasing too. |

**Gap:** no published A/B on absolute timestamps vs. relative phrasing in memory injection. Closest is Memory-R2 prompting the model to *resolve* relative expressions against the supporting memory's timestamp. We'd have to probe it ourselves — see §7.

---

## 3. Design

Three layers. Layer 1 is the AI call; layer 2 is where the accuracy actually comes from; layer 3 is optional and probe-gated.

```
World calendar (authored)  →  Clock (per-turn AI delta)  →  Stamps on turns/digests  →  Rendering + decay
     layer 0                        layer 1                       layer 2                   layer 2/3
```

### Layer 0 — world calendar (authored, optional)

Deliberately *not* a fantasy-calendar engine. Free text plus two numbers.

```ts
/** Optional authored time frame. Absent ⇒ Day 1, 08:00, 24-hour days. */
export interface WorldCalendar {
  /** Free-text label for the story's opening, shown to the AI verbatim
   *  (e.g. "Late spring, the 14th of Emberfall"). */
  epochLabel?: string;
  /** Hour-of-day the story opens at. Default 8. */
  startHour?: number;
  /** Hours in a day. Default 24. */
  hoursPerDay?: number;
}
```

Lives on `World`, edited in a small World Editor panel. Everything downstream works without it.

### Layer 1 — the clock

New `AIRequestType: 'timePassed'`. Runs post-narration, alongside the existing concurrent turn requests.

| Aspect | Choice | Why |
|---|---|---|
| Question | "How much in-world time did this turn consume?" | Delta, not absolute — no arithmetic, one token. The documented two-stage win. |
| Input | player action + the turn's narration | The narration is where timeskips live ("three weeks later…"). Reading only the action misses every one. |
| Output | one token: `0`, `15m`, `2h`, `3d`, `2w` | Parseable by regex; small-model friendly. |
| Temperature | pinned **0** in `PROMPT_SAMPLER_PINS` | Extraction prompt, same class as `statUpdates`/`summary`. |
| Clamp | 0 … 8760h (1 year) | A "500 years pass" hallucination must not detonate the chronicle. Out-of-range → fallback. |
| Fallback | 1 hour (today's behavior) | Unparseable reply, request failure, or feature off ⇒ exactly the current game. Fail-safe, never fail-weird. |
| Zero | legitimate | A single line of dialogue costs nothing. No anti-freeze guard; the player can edit. |
| Override | player-editable per turn | Universal in prior art. Surfaces in the Log panel, which already renders `[3d 4h]`. |

Draft prompt (probe before trusting; follows [prompt-writing-guide](docs-internal/notes/prompt-writing-guide.md) — positive contract, no parrotable values):

> **System:** You measure how much time a scene takes. Read what the character did and what happened, then answer with the elapsed in-world time as a single value: a number followed by `m` (minutes), `h` (hours), `d` (days), or `w` (weeks). A brief exchange takes minutes. A journey, a meal, or a night's rest takes hours. When the text states that time passed, use what it states. Answer with the value alone and nothing else.

Note the last clause: the narration outranks the model's guess whenever it says so. That's the timeskip path.

### Layer 2 — stamps and rendering

**Storage — `timeDelta` on the turn is the source of truth; cumulative time is derived.**

```ts
// AITurnResult (additive)
/** In-world hours this turn consumed, as measured by the 'timePassed' pass. Absent on
 *  pre-clock saves and whenever the pass was off ⇒ the legacy flat 1h applies. */
timeDelta?: number;
```

Cumulative story time at turn *n* = calendar start + Σ deltas. Deriving rather than storing means editing one turn's delta correctly shifts everything after it, and rollback/regen can't desync — the same reason `applyRegenTick` was split out of `handleTimePassed` at [GameViewer.tsx:1042](src/views/GameViewer.tsx:1042). `GameState.gameTime` stays as the live cumulative for stats/UI, seeded from the derivation.

**Rendering — a new pure module `src/lib/gameClock.ts`:**

```ts
formatAbsolute(hours, calendar)  // "Day 3, evening"
formatRelative(then, now)        // "two days ago", "earlier today"
daypart(hourOfDay, calendar)     // "dawn" | "morning" | "midday" | "afternoon" | "evening" | "night"
```

Both forms are emitted, because the research says models are unreliable at deriving one from the other and Zep ships both.

**Dayparts, not clock times.** `Day 3, evening` rather than `Day 3, 19:00`. An exact numeral in context is a parrotable value — small models echo it into the narration ("You glance at the clock: 19:00") — and dayparts are what the prose actually needs. Worth an explicit probe arm.

**Injection points:**

| Where | Change |
|---|---|
| [turnBanding.ts:138](src/lib/turnBanding.ts:138) `bandPieces` | Prefix each digest with `[Day 3, evening — two days ago] ` |
| [GameViewer.tsx:963](src/views/GameViewer.tsx:963) `nowLine` | Append `It is now Day 5, morning.` — this is already the code-built present-state closer, exactly the right home |
| Diary entries ([semanticDiary.ts](src/lib/semanticDiary.ts)) | Stamp each entry so read-back reads as a dated journal |
| Mem0 | Map story hours to the custom timestamp: `epochSeconds + gameHours * 3600` |

### Layer 3 — story-time decay (probe-gated, ship separately)

[`relevanceScore`](src/lib/memoryRelevance.ts:34) decays by turn distance. Once the clock exists, a memory across a three-week skip should age faster than one three quiet turns back. Proposal: blend rather than replace —

```ts
const age = Math.max(ageTurns, ageHours / HOURS_PER_TURN_NOMINAL);
```

— so a dense in-scene sequence never ages *slower* than it does today. Do not ship on intuition; this reorders the band and the band is load-bearing.

**Not in scope (future):** Zep-style `validFrom`/`validUntil` intervals for state-like facts ("wounded", "in hiding"). The natural home is `MemoryNote` and the digest record. Worth revisiting once the clock is proven.

---

## 4. Export-shape impact ⚠️

Both of these change exported JSON and need a version/migration decision before implementation:

| Shape | Field | Additive? | Status |
|---|---|---|---|
| **World** | `calendar?: WorldCalendar` | yes | not built — superseded by `startHour` below, which sources the same seam from the save instead |
| **Save** (`AITurnResult` per turn) | `timeDelta?: number` | yes | shipped (phase 2) |
| **Save** (`GameState`) | `startHour?: number` | yes | shipped (phase 2b) |
| **Save** (`LogEntry`) | `kind?: 'world' \| 'system'` | yes | shipped (log timestamps) |

All additive and absent-tolerant — an old save reads as flat 1h/turn, opening at 08:00, with every log line stamped as a story event, which is exactly how the game behaved before each field existed. Per hard constraint #2 they still require an explicit version/migration call from the user, not from me.

Note that the **world** calendar was never needed: sourcing `startHour` from the save gets the phase-1 `WorldCalendar` seam wired without touching world export shape at all, and without asking authors to fill in a field.

---

## 5. Integration checklist

| File | Change |
|---|---|
| [src/types/world.ts](src/types/world.ts) | `WorldCalendar`, `World.calendar?` |
| [src/types/ai.ts:34](src/types/ai.ts:34) | `AIRequestType` += `'timePassed'` |
| [src/types/ai.ts:52](src/types/ai.ts:52) | `AITurnResult.timeDelta?` |
| `src/lib/gameClock.ts` *(new)* | Pure formatting + parsing + clamp; fully unit-testable |
| [src/lib/promptSamplers.ts:13](src/lib/promptSamplers.ts:13) | `timePassed: { temperature: 0 }` |
| [src/components/game/GamePrompts.ts](src/components/game/GamePrompts.ts) | The prompt + its Settings → Prompts tab entry |
| [src/views/GameViewer.tsx:1962](src/views/GameViewer.tsx:1962) | Replace `handleTimePassed(1)` with the measured delta |
| [src/views/GameViewer.tsx:963](src/views/GameViewer.tsx:963) | Stamp the `nowLine` |
| [src/lib/turnBanding.ts:138](src/lib/turnBanding.ts:138) | Stamp digest pieces |
| [src/components/game/GamePanels.tsx:333](src/components/game/GamePanels.tsx:333) | Per-turn time edit affordance |
| [src/contexts/settingsDefaults.ts](src/contexts/settingsDefaults.ts) | `DEFAULT_AI_CLOCK` (+ `.env.local` reminder if it gets a `VITE_` twin) |
| World Editor | Calendar panel |

---

## 6. Failure modes and their guards

| Failure | Guard |
|---|---|
| Absurd delta ("500 years") | Clamp to 1 year; out-of-range falls back to 1h |
| Narration says "three weeks later", model says "2h" | Prompt clause: stated time wins. Probe case. |
| Regen / rollback double-advances the clock | Delta lives on the turn; cumulative is derived. Mirrors the existing regen-tick split |
| Editing an old delta desyncs snapshot `gameTime` | Derive from deltas; treat snapshot `gameTime` as legacy seed only |
| Exact clock numerals parroted into prose | Dayparts, not `HH:MM`. Probe arm |
| Model spends the whole budget on this pass | One token out, `max_tokens` tiny, runs concurrently |

---

## 7. Probe plan

Per the [prompt-writing-guide](docs-internal/notes/prompt-writing-guide.md) done-bar — both tiers (cloud default endpoint 12 runs/arm, Cydonia 2–3), before/after metrics, other-metric regression check.

**A — RUN 2026-07-26.** `time-delta-probe.mjs` over `time-delta-cases.json` (8 cases, temp 0).

| Tier | measured in range | unparseable | flat-1h baseline |
|---|---|---|---|
| Cydonia (n=24) | **100%** | 0% | 25% |
| Cloud (n=96) | **88%** | 0% | 25% |

Two prompt/parser defects the probe caught, both invisible without it:
- The cloud model replied with the **bare unit** ("h", "d") — 44% unparseable. Fixed by making the contract demand the count first ("a bare unit letter is not an answer"): 56% → 83%.
- It also wrote **spelled-out counts** ("five minutes"). Fixed in `parseTimeDelta`, not the prompt — a word count is a fair reading of the contract: 83% → 88%.
- A third defect was mine: the guidance bullet listed *a night's rest* under "days or weeks", so the model dutifully said `1d`. Moving it to the hours bullet fixed Cydonia but **not** cloud, which still answers `1d` (24h vs a true ~8h) for `sleep` — the one remaining miss, and the entire 12% gap. A follow-up "use the smallest unit that fits" clause changed nothing on either tier and was reverted rather than shipped unmeasured.

**Residual:** cloud over-charges a night's sleep by ~3×. Bounded (right order of magnitude) and correctable by the player, but it accumulates across a long game. Worth another pass before default-on.

**B + C — RUN 2026-07-26.** `testing/baseline/harness/time-stamp-probe.mjs`, over `close-session.json` (45 digests), both tiers, both clock samplings. **Verdict: stamping wins, no prose cost.**

Recall — "how many days ago did this happen?", scored against the clock:

| Tier · clock | A exact | B exact | A mean err | B mean err |
|---|---|---|---|---|
| Cydonia · flat (n=18) | 33% | **50%** | 0.83 d | **0.50 d** |
| Cydonia · measured (n=18) | 17% | **50%** | 1.50 d | **1.00 d** |
| Cloud · flat (n=72) | 0% | **33%** | 1.17 d | **0.67 d** |
| Cloud · measured (n=72) | 0% | **50%** | 1.33 d | 1.33 d |
| Cloud · measured, single old memory (n=30×2) | 0% | **100%** | 3.00 d | **0.00 d** |

Story span — "how many days have passed?" — is the cleanest result: **A 0–25% → B 100%** on every tier and both clocks. Unstamped, the model cannot answer it at all.

Ordering — "which happened first?" — **no effect**: Cydonia 100% in both arms, cloud ~60% in both. The recap is already chronological, so plain order carries ordering; stamps neither help nor hurt it.

Prose regression (turn 35 + turn 7, pooled cloud n=78/arm at turn 35): dialogue **A 73% / B 79%** at turn 35, **100% / 100%** at turn 7; word count shows no systematic shift (A 140–183, B 166–167). An early 12-run read looked like a dialogue collapse (92% → 58%) and did not survive more runs — turn 35's dialogue rate swings from 53% to 92% *within* arm A. **No regression.**

Calendar leak (probe C): cloud **0/108**. Cydonia ~**2/22 (9%)** — a daypart word occasionally reaching the prose. Low, non-zero, and the reason dayparts beat clock readings; worth re-checking if the stamp format changes.

**Caveats.** With the flat clock a 45-turn session spans under two days, so every truth is 1–2 days and "exact" is close to a coin flip — the measured-clock arm is where the spread (0–3 days) makes the metric mean something. Cloud's mean error stays at 1.33 d even while exact-match hits 50%, i.e. when it misses it misses badly.

---

## 8. Phasing

| Phase | Content | Gate to advance |
|---|---|---|
| 1 ✅ **built + probed** | `gameClock.ts` + stamps derived from the **existing** flat 1h; rendered in `nowLine` + digests behind the `timeContext` setting (default off). No export-shape change — the calendar stayed hardcoded. | ✅ Probe B/C passed (§7) — default-on is a product call |
| 2 ✅ **built + probed** | The `timePassed` pass measures each turn; `AITurnResult.timeDelta` stores it; cumulative time is derived, so stamps and regen use the real clock. Behind the `aiClock` setting (default off). Prompt is preset-editable — `timePassedPrompt`/`timePassedUserPrompt` in `PROMPT_TEXT_KEYS`, Settings → Prompts → **Clock** tab (gated on `aiClock`). | ✅ Probe A: 100% Cydonia / 88% cloud vs 25% flat. Residual: cloud's `sleep` case |
| 2b ✅ **built + probed** | The `openingTime` pass seeds where the clock *starts*. `GameState.startHour` (additive, save-only) feeds the `WorldCalendar` every reader already accepted, so Layer 0's seam is finally wired — from the save, not from the world. Behind `aiClock`. Prompt is preset-editable — Settings → Prompts → **Opening**. | ✅ See below |
| 3 | Story-time decay in `memoryRelevance` | Its own A/B on real-session recall |
| 4 | Validity intervals for durative facts | Only if 1–3 hold up |

### Phase 2b — the opening hour (2026-07-26)

Phase 2 made every *duration* right and left the *origin* at a hardcoded 08:00, so a world written to open at midnight was wrong from its first line and stayed wrong by a constant offset forever. Measured deltas can't fix a wrong start.

**Probe** (`opening-time-probe.mjs`, cloud default, 12 runs × 11 cases × 2 arms, twice). The question was whether to let the pass answer `unstated` (arm A) or force a daypart (arm B).

| | A hatch | B forced |
|---|---|---|
| Stated accuracy | 81% / 82% | 83% / 88% |
| Declined (`unstated`) | **0 of 132, twice** | — |
| Spread across 5 worlds | 3 / 3 | 4 / 3 |
| Invalid replies | 10% → 1% | 2% → 0% |

**Verdict: arm B.** Not because it is more accurate — the two runs disagree on the direction of that gap, so it is noise — but because **the hatch is never taken**. Offered an explicit "don't guess" option across 264 opportunities, the model declined zero times. Arm A is arm B plus a word that is never emitted, so B ships for the simpler contract.

The load-bearing metric was **SPREAD**, not agreement. A model answering `morning` for every world scores perfect self-consistency while being byte-identical to the default it replaces. It did not: Sedge Landing → `evening` 12/12, Tempe → `afternoon` 12/12, Timbermaw → `morning` 12/12, Blackrue → `evening`, Vane Hollow → split. World-specific and stable across two independent runs.

**Findings worth keeping:**

- **No tracked test world states a time of day.** A sweep of every world in `testing/baseline/` found only ambient `lantern`/`lamp` and one `sundown` in a location nobody starts at. The real corpus is 100% unstated, which is why the stated cases had to be authored — and why the forced-pick arm is the one that matters.
- **`"day"` was the single largest source of unparseable replies** until the prompt named it. One line ("a broad word like *day* is not one of the answers") took invalids from 10% to 1%. It is load-bearing; do not trim it.
- **Closing that escape did not improve accuracy on `shift`** — it redirected those replies to `midday` instead of `afternoon`. The model is weakest where a scene states a time *relative to noon* rather than naming a daypart. Known, unfixed.
- **`night` → 22:00, not 02:00.** Both are `night` to `daypart()`; 22:00 leaves a realistic stretch before dawn instead of sprinting into sunrise. A round-trip test pins `OPENING_HOURS` to `daypart()`'s bands so the two can't drift.

**Not done, deliberately:** no retroactive ask when `aiClock` is switched on mid-story. The opening narration is long gone from context by then, and a late answer would re-date every stamp the player has already collected.

**Cydonia arm not yet run** — needs LM Studio with only Cydonia resident.

Phase 1 is independently shippable and needs no new AI call — worth doing first precisely because it isolates "does stamping help?" from "can the model measure time?".

---

## 9. Decisions needed from you

1. **Version / migration** for the two additive fields (§4).
2. **Default-on or opt-in** for the AI clock — it's a per-turn request on every turn.
3. **Calendar authoring** — World Editor panel now, or hardcode Day 1 / 08:00 / 24h for phase 1?
4. **Phase 1 alone first?** Recommended: it answers the cheaper question first and can't regress anything.
