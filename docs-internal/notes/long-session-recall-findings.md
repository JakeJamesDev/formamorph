# Long-session recall — findings & todo

Why a ~90-turn session forgets its own milestones. Everything below is measured from two AI-context
exports of the **same** session at different points (`aftermath.json`, 8 MB, and
`did something happen.json`, 5 MB — user's Downloads, not tracked). Each holds the last 50 turns ×
5 AI calls (`locationChange`, `narration`, `choices`, `summary`, `milestoneSelect`). Numbers cited
are from `aftermath.json` (the later export) unless stated.

Session: "Praetoria Academy" world, 2026-07-25. Arc = heat → pregnancy → confirmation → birth →
post-partum. Player used `[bracketed]` time-skips of weeks/months several times.

**Verdict: system problem, not a model problem.** Every failure below is in our code or prompts.

**▶ Resume here:** item 1 is shipped (both halves — stickiness and importance ranking); item 2 is
resolved by it. Next by impact: **item 4** (location/presence drift, three separable sub-bugs) or
**item 7** (the cloud tier failing its own recall gate, newly surfaced). Item 3 is the deeper fix
— the system has no representation of elapsed time — and would take pressure off 4 and 5 both.

Item 1's remaining loose end: `STICKY_BONUS = 1.25` and `IMPORTANCE_SPREAD = 1.6` are reasoned
starting values, never measured against a real session. Re-export a long session and re-run the
churn measurement in item 1a to tune them.

## How many probe runs the cloud tier needs

Measured directly: 14 independent single-run `milestone-select-probe` invocations of the **same**
prompt against the cloud endpoint. The probe sends `temperature: 0`, so all of this spread is
**endpoint nondeterminism** (batching, server-side drift) — not sampling. Re-derive if the endpoint
changes; Cydonia at temp 0 was reproducible across runs and stays cheap at 2–3.

| metric | mean | sd | min | max |
|---|---|---|---|---|
| must recall | 0.864 | 0.031 | 0.85 | 0.95 |
| drop keep | 0.450 | 0.053 | 0.37 | 0.56 |
| separation | 0.773 | 0.078 | 0.63 | 0.92 |
| coverage | 0.549 | 0.054 | 0.46 | 0.63 |

Runs for a 95% CI half-width, `n = (1.96·sd/margin)²`:

| metric | ±0.05 | ±0.03 | ±0.02 |
|---|---|---|---|
| must recall | 2 | **4** | 9 |
| drop keep | 5 | **12** | 27 |
| separation | 10 | **26** | 59 |
| coverage | 5 | 13 | 29 |

**Standing guidance**
- **5 runs** default for a cloud sanity check (±0.027 recall, ±0.046 drop-keep).
- **12 runs per arm** for any A/B whose expected effect is under 0.10, which is most of them.
- **Separation is directional only** unless you want to spend ~26 runs — report sign and rough
  magnitude, not a precise value.
- **Never draw a conclusion from a 2-run cloud delta.** The recall metric has only 20 must-keeps
  per run, so it moves in steps of 0.05 — a one-step "improvement" is a single entry changing its
  mind. Two separate claims in this document's history were killed by this.

## Session configuration (derived, not assumed)

Not recorded in the export, so reconstructed from observable structure:

| setting | value | how it was determined |
|---|---|---|
| `semanticMemory` | **on** | Band membership is non-contiguous. Only `dropLowestEligible` produces that, and it requires `scored` mode, which requires complete relevance scores. Budget trimming can only drop oldest-first (contiguous). |
| `semanticRehydration` | **on** | The "Recall in full the earlier moment my next action returns to" exchange fires on 35/50 turns. |
| `semanticBandCap` | **12** (the default) | See the band-size proof below. |
| verbatim floor | **4** turns | Every narration history has exactly 4 user/assistant pairs after the recap (and rehydration) exchanges, plus the unpaired current action. |
| milestone `Forget` | never fired | `Forget: none` on 50/50 turns. |

An earlier draft of this doc claimed semantic memory was off. That was wrong — the grep that
produced it searched for the wrong prompt strings.

---

## 1. The recap is hard-capped at 12 memories, chosen by topical similarity, re-drawn every turn

### The cap

Measured by exact full-text containment of each held milestone in the recap body:

| held milestones | band size |
|---|---|
| 50 → 97 (grows every turn) | **always 10, 11, or 12 — never more, never fewer** |

Band size correlates **perfectly** with the rehydration exchange, 50/50 turns, no exceptions:

| rehydration exchange | band size | turns |
|---|---|---|
| absent | 12 | 15 |
| present | 10 or 11 | 35 |

That is `semanticBandCap = 12` ([SettingsContext.tsx:333](src/contexts/SettingsContext.tsx:333))
minus the 1–2 turns rehydration pulls out of the band
([turnBanding.ts:352](src/lib/turnBanding.ts:352)). By turn 97 the narrator sees **12 of 97**
remembered moments.

### The slot structure

The band decomposes exactly as `buildBandedHistory` specifies:

- **1 slot** — entry 1, the opening anchor. Present in **50/50** turns.
- **2 slots** — the newest two eligible band entries (`RANKED_RECENT_IMMUNE = 2`,
  [turnBanding.ts:70](src/lib/turnBanding.ts:70)). Present in **47/50** turns.
- **~8 slots** — everything else, decided purely by relevance rank.

### The ranking

Those ~8 slots are filled by `dropLowestEligible` using
([memoryRelevance.ts](src/lib/memoryRelevance.ts)):

```
score = cosine(currentActionVector, digestVector) × 0.5^(age / 40)
```

Three properties, each independently a problem:

**a. Recomputed from scratch every turn.** A new action means a new query vector means a new
ranking. Nothing is sticky by construction. Measured churn:

| metric | value |
|---|---|
| memories replaced per turn (whole band) | **5.02 average**, range 2–9 |
| memories replaced per turn (free slots only, ~8) | **4.55 average — 57%** |

Over half the narrator's long-term memory is swapped out every single turn.

**b. No importance term.** The score is topical similarity to the player's most recent sentence.
Nothing distinguishes a pivotal event from a passing one.

The clearest instance is turn 96. The scene: Dean Wolfram — confirmed father of the newborn — is
in Porsia's apartment offering overnight help. The player's action is about kindness, tears, and
sleep. The band chose:

> `1, 62, 63, 64, 65, 66, 67, 68, 90, 91`

Seven of the eight free slots went to entries 62–68, a single contiguous "Sarah makes tea and
offers support" comfort scene from ~30 turns earlier — a strong topical match for kindness and
comfort. Entries **84–89** — Dean Wolfram learning of the pregnancy, asserting parental rights,
and the paternity discussion, i.e. the direct setup for the scene being played — were all eligible
and all dropped.

**c. A 40-turn half-life makes the mid-game the battleground.** An age-30 memory decays only to
~0.6×, so it competes on near-even terms with recent ones. In a 90-turn session that is a large
undifferentiated pool fighting over 8 slots.

### What is *not* established

Entries 93 (the birth, Dean Wolfram confirmed as father) and 94 appear in no recap in the export.
**This is not evidence of rank-dropping** — both were still inside the 4-turn verbatim floor for
every exported turn after they occurred, so they were present in full narration and never needed
the band. Whether they survive ranking once they age out is untested; the export ends at turn 97.
Do not cite the birth as a ranking failure. Turn 96's choice of the tea scene over entries 84–89
is the sound evidence.

### Directions

1. ✅ **Give the selector's importance judgment a path into the ranking** — SHIPPED. The selector
   now rates each kept moment 1-3 on a third `Weight:` line; the rating persists as
   `AITurnResult.importance` and ranks the band via `importanceFactors`
   ([turnBanding.ts](src/lib/turnBanding.ts)).

   **The rating is used as a within-band RANK, never as its raw value** — this is the load-bearing
   design decision.

   #### Did it change selection quality? (the powered measurement)

   `preweight` — a probe arm verified **byte-identical** to the prompt at the pre-change commit —
   at n=12, vs the shipped prompt at n=14, one probe invocation per sample:

   | metric | pre-weight | shipped | diff | 95% CI | verdict |
   |---|---|---|---|---|---|
   | must recall | 0.879 ± 0.033 | 0.864 ± 0.031 | −0.015 | [−0.040, +0.010] | not significant |
   | drop keep | 0.428 ± 0.015 | 0.450 ± 0.053 | +0.023 | [−0.006, +0.051] | not significant |
   | must-forgets | 2.42 ± 0.67 | 1.93 ± 0.27 | **−0.49** | [−0.891, −0.085] | **significant** |

   **Recall unchanged, drop-keep unchanged, must-forgets genuinely improved** — about half a
   wrongly-forgotten must-keep less per run. The importance signal is the feature here; the
   selection side is neutral with one real win, not the broad improvement first claimed.

   Cydonia (reproducible at temp 0, 3 runs): recall 1.00, drop keep 0.34, must-forgets 0,
   malformed 0/198 — unchanged from its 1.00 / 0.39 / 0 baseline.

   **Cloud sits below the 0.90 recall gate on both arms** (0.879 and 0.864). That predates this
   change and is not caused by it, but it is the real state of the cloud tier — see item 7.

   #### Which arm to ship (the underpowered exploration)

   These are 2 runs/story and were used **only to choose between candidate wordings**, which is
   what they can support: separation differences here are 3–5× the metric's noise sd (0.078), and
   `mark`'s Cydonia sign flip is unambiguous. **The recall and drop-keep columns are inside the
   noise band** (±0.06 and ±0.10 at n=2) and must not be read as effects — every apparent
   difference in them later failed to replicate.

   | arm | cloud separation | Cydonia separation | verdict |
   |---|---|---|---|
   | `weight` (1-3 scale) | **0.64** | 0.26 | shipped |
   | `weightex` (+ examples) | 0.66 | 0.26 | no gain over `weight` |
   | `weight2` (states base rate) | 0.25 | **0.57** | inverts the tier split |
   | `mark` (binary, no scale) | 0.39 | **−0.32** | disqualified |

   "Separation" = mean rating of must-keeps minus mean of kept drops. Malformed 0/132 on every arm.
   Shipped-prompt separation settles at cloud 0.773 ± 0.078 (n=14) and Cydonia 0.36.
   Weight coverage: cloud 0.549 ± 0.054, Cydonia 0.80 — cloud omits the rating about half the time,
   which the neutral-midpoint fallback absorbs.

   Two findings drove the design:
   - **No scale wording ports across tiers.** `weight` separates on cloud and barely on Cydonia;
     `weight2` inverts that; `mark` is disqualified outright — Cydonia marks nearly everything, so
     kept drops out-rate must-keeps. Naming the base rate only moved the anchor.
   - **The ordering was right on both tiers even where the magnitude was compressed.** Hence
     rank-normalization: keep the ordering, discard the scale. `IMPORTANCE_SPREAD = 1.6`, set above
     `STICKY_BONUS` so a pivotal memory can still displace a topical incumbent. Unrated memories
     (~1 in 5) sit at the rank midpoint, never the bottom.

   #### Claims made and retracted here — read before citing any number above

   Both died to the same mistake, reading a 2-run cloud delta as an effect:
   - *"Cloud must-recall improved 0.85 → 0.95."* The point estimate is **−0.015**, CI spanning
     zero. The same prompt spans 0.85–0.95 across repeated single runs.
   - *"Cloud drop-keep regressed 0.46 → 0.54."* Actually **+0.023**, CI spanning zero.

   **Two probe-mirror bugs were fixed along the way** and both invalidated earlier numbers:
   `PAIRED` was keyed off the arm name, so the `shipped` arm honored uncited forgets the app always
   voids; and the `shipped` arm didn't emit the `Weight:` line its own system prompt now asks for.
   The mirror in `milestone-select-probe.mjs` must be re-checked against `lib/milestoneMemory`
   whenever either changes.

   **Watch for endpoint drift when reading these numbers.** Cloud baseline measured 0.82 then 0.85
   on the same prompt in one session, and one Cydonia run reported 126/132 malformed that turned
   out to be LM Studio JIT-unloading the model mid-run (`fetch failed`), not a prompt failure.
   Always confirm the endpoint is serving before believing a collapse.
2. ✅ **Make selection sticky** — SHIPPED. `STICKY_BONUS = 1.25` in
   [turnBanding.ts](src/lib/turnBanding.ts): a memory in last turn's band ranks as if scored 1.25×,
   so eviction needs a real margin rather than a fresh action vector's noise.
   `BandResult.bandTurnIds` reports the surviving band; `GameViewer` feeds it back via
   `lastBandIdsRef`, advanced **only** on the live narration call so the planner and context meter
   rank against the same incumbents rather than chasing their own intermediate bands. Fails open:
   no sticky set, or unscored mode, is the exact pre-feature path, and the protected ends still
   win outright. At the 40-turn half-life, 1.25× is worth ~13 turns of age advantage.
   **The value is a reasoned starting point, not a measured optimum** — it wants real-session churn
   numbers (re-export a long session and re-run the churn measurement in this doc's item 1a).
   Addresses (a) only; it does nothing for importance-blindness, and by design makes a wrong band
   persist longer, so (1) matters more now, not less.
3. **Widen `RANKED_RECENT_IMMUNE`** — 2 is thin at 90 turns. One-constant follow-up, measure after
   1 and 2.

### Where importance lives, and why

`AITurnResult.importance?: number` — in the save envelope, next to `summary` / `entities` /
`diaries`. A side cache keyed by digest hash (as embeddings use, `FORMAMORPH_EMBEDDINGS_DB`) would
have avoided the shape change, but unlike an embedding an importance rating **cannot be recomputed
locally** — it takes an AI call. Clearing site data or moving a save would silently lose it and
degrade recall with no signal.

The whole path fails open: an absent or unparseable rating is neutral, never zero. Pre-weight
saves, a model that ignores the line, and a band where every rating agrees all rank exactly as
they did before the feature.

This session is a good probe fixture: it has a known-correct answer (turn 96 should surface the
Dean/paternity arc, not the tea scene).

---

## 2. The milestone selector's verdict never reaches the prompt

`Keep: <n>` every turn and `Forget: none` on 50/50 turns means the stored `selected` set holds
everything — 97 entries by the end. So `resolveMilestoneDrop` returns an effectively empty set and
`milestoneDrop` filters nothing in `buildBandedHistory`.

The selector runs, reasons explicitly about significance ("this is a pivotal moment that changes
the story's trajectory"), stores its verdict, and displays it in the Memory panel — and then
**assembly ignores it entirely** and hands all 12 slots to cosine similarity, which has no
knowledge that the selector ever ran.

So the one component in the system that reasons about importance is disconnected from the one
decision that needs importance. This is the same root cause as item 1b, seen from the other side,
and is why the "compaction never fires" symptom matters: it is not a prompt-size problem (the cap
bounds that anyway) — it is that the selector's signal is thrown away.

Note the interaction with [narration-quality-todo](narration-quality-todo.md) item 1: drop-keep
rose after the `genericex` fix, i.e. *more* history is retained now. Loosening keeps without
giving `Forget` a real trigger makes item 1's slot pressure worse.

---

## 3. The recap surface carries no time or weight markers

3,181 chars of same-weight sentences, with entry 1 butted straight against entry 63 and no gap
signal:

> "You arrived at Dean Wolfram's office for a mysterious summons… You sit on your bed without
> answering Sarah's questions…"

Those are months apart in-story. Nothing marks elapsed time, ordering gaps, or which lines are
load-bearing.

Underlying this: the system has **no representation of elapsed time**. `[Skip to when I'm ~6
months pregnant]` is indistinguishable from walking down a hall. That gap also drives item 4.

---

## 4. Location and presence drift, then poison the system prompt

The location router returned `NONE` on **48 of 50** turns. It fires only on explicit movement in
the player's action, so bracketed time-skips left the location pinned to a room the character had
long since left.

Final exported turn — the scene is Porsia's apartment, weeks post-birth:

| field | value in prompt | actual |
|---|---|---|
| Current Location | Dean Wolfram's office | Porsia's apartment |
| Present | `Dean Wolfram, Sarah, Dean Wolfram, Sarah, Dean Wolfram, Sarah` | Porsia, Sarah, Dean Wolfram, baby |
| Doctor Chen | absent from the prompt entirely | speaks in transcript prose on 23 turns |

Because the `## Characters and things that may appear in this location` block derives from the
stale location, the whole cast description is for the wrong room.

### 4a ✅ The router had no destinations to offer — the world's locations are unlinked

The original reading ("the router never fires across time-skips") was wrong. The prompt's
`## Where The Player Can Go` block rendered **`N/A` on all 50 turns**. `buildDestinationsContext`
and the consumer's match list both come from `navigableDestinations`, so with it empty
`matchLocationResponse` can never match: **every one of the 50 requests was structurally incapable
of producing a move**, whatever the model replied.

The world has four top-level locations and no `connections` or `parentId` between any of them, so
every location is a dead end. The two non-`NONE` replies (turns 12 and 36) were correctly
discarded; those moves came from elsewhere (manual navigation), not the router.

**Fixed:** the gate was `locations.length > 1` — whether the WORLD has more than one location,
which is a different question from whether *this* location leads anywhere. It now gates on
`navigableDestinations(...).length > 0`, removing a wasted AI request per turn in affected worlds
and changing nothing where locations are linked.

**Not fixed, and not a code bug:** the stale location during time-skips. With no location graph
there is nowhere to move to. That is an authoring gap in the test world, though it is worth asking
whether the app should surface "this location is a dead end" to the author.

### 4b ✅ Duplicate presence list

`recentParticipants` concatenated each turn's participants across a 3-turn window with no dedup.
Two of its three callers wrapped it in `new Set` already; the now-line — which renders the list
verbatim into the prompt — did not. Now deduped inside the helper, most-recent turn first. Moved
from `GameViewer` into `lib/turnDigest` so it is unit-testable.

### 4c ✅ Narrator-invented characters can never be discovered — FIXED

Shipped via a pure, no-AI-call name extractor plus a settings split and a delete flow. Design,
measurements and every decision: [narrator-character-discovery-spec](narrator-character-discovery-spec.md).
Validated at recall 1.00 / precision 1.00 on both real sessions.

Root cause, for the record:

`turnParticipants` is `findEntityNames(narration, allEntities)` ∪ `matchNamesLoose(narration,
directorCandidates)` ∪ `matchNames(narration, adHocCandidates)`
([GameViewer.tsx](src/views/GameViewer.tsx)). The first only matches **already-known** entities;
the other two are populated **only by staged planning** (the code says so at the `discoverNames`
line). That session ran no staged planning, so both were empty.

So a character the *narrator* invents matches nothing → never a participant → never reaches
`selectDueDiscovery` → never promoted to a discovered entity → never known. Discovery requires
already having been discovered. Doctor Chen speaks on 23 turns and is invisible to the system on
all of them; Professor Krafft appears only because she is an authored entity.

Also note the whole discovery path is gated on `characterDiaries` being on.

The fix needs unknown proper-noun extraction from narration, which is a real choice:
an extra AI call per turn (cost, latency) versus a capitalization heuristic (false positives —
place names, objects, sentence starts). Worth deciding deliberately rather than defaulting.

---

## 5. Stale rehydration contradicts the current scene

The rehydration exchange fires on **35 of 50** turns. On the final turn it injected the
Dean's-office pregnancy confrontation — weeks earlier, different room — into an apartment scene
set weeks after the birth. Selection does not account for whether the scene has moved past the
recalled moment.

---

## 6. `milestoneSelect` two-line contract is not holding

Only **18 of 50** replies obeyed "Reply with two lines"; the rest appended paragraphs of reasoning.
`parseIncrementalMilestoneReply` tolerates it, so this is cost and latency rather than
correctness — fold it into the next milestone-prompt probe pass.

---

## 7. The cloud tier fails its own milestone recall gate

Surfaced while powering the item-1 A/B, unrelated to it. Cloud must-recall on the milestone
selector measures **0.879 ± 0.033 before the weight change and 0.864 ± 0.031 after** (n=12 / n=14)
— both below the **0.90 gate**. Cydonia passes at 1.00.

This is not a regression from any recent work: it is what the cloud tier has been doing all along,
hidden by 2-run measurements whose noise band (±0.06) straddled the gate. Roughly one must-keep
moment in seven is being dropped on the tier most players actually hit.

Worth its own workstream rather than a footnote — and note the gate itself was set when the
measurements informing it were underpowered, so "raise recall" and "the gate is miscalibrated" are
both live hypotheses. `docs-internal/notes/prompt-writing-guide.md` has the current done-bar.

---

## What is working

- The opening anchor holds: entry 1 surfaced on 50/50 turns, exactly as
  `resolveMilestoneKeep` and the ranked-drop guard intend.
- `RANKED_RECENT_IMMUNE` holds: the newest two eligible entries surfaced on 47/50 turns.
- Digest write quality is fine — entries are specific and readable. The write side is healthy;
  recall dies on the read side.
- Nothing here argues for a better model.
