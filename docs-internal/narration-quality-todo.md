# Narration quality — findings & todo

Working list for the raw-narration quality push (non-thinking modes first). Sources: the Profile Q
harness runs (`testing/baseline/runs/Q-*`), the digest-framing/summary probes, and the real
45-turn play session (2026-07-22, mothers-struggles world, Sarah-as-Alice roleplay; copy at
`testing/baseline/runs/close-session.json`, gitignored).

**Release validation 2026-07-23** (pre-release sweep, all PASS): `gateAmem` (new digests-ON
full-pipeline profile in profiles.json — router 10/10 with recap in context, choices clean,
stat restraint 2/3 no-ops); Q on Cydonia (first tier-2 run: C2 PASS, C1 PARTIAL); dialoguehold
best run on record (first-ever 50/50 turns with dialogue, mid-band length collapse gone, best
late-band hold). Q-run recall status: C2 now PASSES on both tiers end-to-end.

**▶ Resume here:** item 5 — harness and reproduction are solved (Cydonia + `--prefill 38`); what remains
is one large paired batch to settle the arms. Item 4b is closed as *not a prompt problem* (cloud writes
no unprompted dialogue regardless of wording; remaining levers are sampler or the planning modes).
Item 3 is largely absorbed by item 2's now-line — revisit only if frame-fact failures persist.

## Shipped so far (context)

- ✅ **Recap exchange** — digests ride narration history as one "Recap the story so far." exchange
  (editable: Settings → Prompts → Narration → Recap Message). Fixed the length collapse
  (~40w → ~125w on cloud) and the ask-then-silence turns. `digest-framing-probe.mjs`.
- ✅ **Digest fact retention** — summary prompt rewritten (specifics stay specific; speech upshot
  carries what was named; second sentence is for fact-dense turns). Cloud 8/21 → 18/21 planted
  facts; Cydonia multiline 15 → 5. `summary-probe.mjs` + fact cases in `summary-cases.json`.
  **2026-07-23: cases de-correlated** (fact cases restructured away from Q-world templates) and the
  A/B re-run against the true pre-fix prompt via the probe's new `--source` flag: cloud 12–14/24 →
  18–21/24, Cydonia 21/24 → 24/24 on templates the prompt was never iterated against — not overfit.
  Residual: the trailing self-given name is the weakest fact on cloud regardless of template.
- ✅ **Profile Q** — 25-turn quality script (planted facts, question turns, agency trap) +
  `qualityScore.mjs` objective scoring. Judged bars graded in-session.

## Todo (ranked value-per-risk)

### 1. ✅ Milestone selector keeps events, drops state — SHIPPED 2026-07-22 (revised 07-23: `genericex` is what ships)
First shipped as the `stateful7` prompt arm (state-shaped keeps + merged worked example — wording alone
went null, met/unmet words poisoned closure keeps, split examples destabilized supersession; see
`milestone-select-probe.mjs` arm comments) + code-side opening-anchor keep in `resolveMilestoneKeep`
(drop-pin still wins). Cloud must-recall 0.90→0.92 with the goal/pretense fixed; Cydonia 0.90→**1.00**.
Known trade-off: cloud shifted its residual misses to some closure entries (repay/handoff) and
drop-keep rose 0.16→0.22 (cloud) / 0.17→0.29 (Cydonia) — more history retained. Watch in real runs.
**2026-07-23 revision (user catch):** the concrete example shared a sentence template with the
fixture's goal entry — probe validity compromised. Fixture de-correlated (restructured goal entry,
no kinship terms), example rewritten PLACEHOLDER-FORM (`genericex` arm): cloud 0.97 / Cydonia 0.95
on the honest fixture. Residual trade-off: Cydonia keeps the standing-pretense entry only under the
concrete arm (1.00); a third example lesson (`genericex2`) broke the cloud gate — the example holds
~two lessons max. Rule now in memory: prompt examples are format-only placeholders, never story
values, and fixtures must never share templates with examples.
Original finding follows for context.
The selector's keep-criteria (promises, debts, wounds, things gained) are event-shaped. It dropped:
- the **roleplay agreement** digest (T6 "pretend to be Alice") → the T35/36 identity inversions —
  the recap actively implied Alice was a separate third person;
- the **opening scene** digest by turn 7 → the T7 full scene reset (model wrote an arrival scene);
- the **Harrowgate goal** digest on exactly the turn it was needed (Q run C2, selection is per-turn).

Fix: add state-shaped keeps to `defaultMilestonePrompt` — "standing arrangements still in effect:
a game being played, a role assumed, a bargain governing the scene; the player's own stated goal" —
and consider code-side always-keeping the opening turn's digest. Probe against milestone fixtures
(`milestone-fixture*.json`) + an open-goal survival case; end-to-end = Q run C2 flips.

### 2. ✅ Recap is a chronicle with no "now" — SHIPPED 2026-07-23
Code-built now-line (no AI call) appended to the recap reply: `Now you are at <location> with
<recent participants> present; the scene is already underway.` + Player Notes verbatim when set.
Probed via `now-line-probe.mjs` replaying close-session.json: T35 arm A had a hard identity
inversion + distress misread (0/4 clean); arm B 6/6 free of inversions/bewilderment (residual:
prose sometimes attributes "Alice" as the player's name while the dialogue behaves correctly —
model-capability, not context). T7 reset didn't reproduce on the current cloud batch (rare roll).
Composition in GameViewer's getTrimmedMessageHistory; assembly + cost in turnBanding (`nowLine`).
Original finding follows for context.
T7 and T35 both trace to the recap describing what happened without what currently holds
(where we are, who is present, what pretense is in effect). Design decision, not just prompt text:
options are (a) recap block ends with a present-state sentence derived from notes + kept milestones,
(b) a tiny dedicated silent request maintaining standing state. Decide shape before building.

### 3. ✅ Notes ride the wrong slot for frame-critical facts — ABSORBED by item 2 (2026-07-23)
Notes now ride the recap's closing now-line ("the player's own notes hold true: …"), which is what
this item wanted. The separate user-slot experiment stays unrun — revisit only if frame-fact
failures persist in real sessions. Original finding follows for context.
"Sarah is pretending to be Alice" sat one line deep in the system prompt and lost to a 300-word
recap. Precedent: the user-slot beside the action is the highest-leverage position (voice clause,
~3× dialogue). Experiment: ride Player Notes (or a frame-note subset) in the narration user
message. Cheap; probe for side effects on dialogue metrics.

### 4. ✅ OOC / register channel — SHIPPED 2026-07-24
Square brackets in the action are now the authorial channel: a Guidelines line in
`defaultSystemPrompt` defines the convention, and bracket turns get `OOC_DIRECTIVE` appended in the
high-recency user slot (thinking-off lane; composed in GameViewer, history stores the bare action).
The summary pass never sees the direction at all — `stripOocDirectives` removes brackets code-side
before the digest request, after a probe showed a prompt rule alone let Cydonia lift the bracket's
wording into the digest ("He softens toward you"). Action-box placeholder hints at the feature.
Evidence (`ooc-probe.mjs`, 4 cases from the T27/28 shape + 2 bracket-free controls, 4 runs/case):
both models largely obey brackets even unprompted (base comply cloud 13/16, Cydonia 15/16); shipped
arm (line + rider) cloud 14/16 comply / 0 defy, Cydonia 15–16/16, leak 0 everywhere, controls clean.
Regression: dialogue-unbaited A/B on cloud identical across arms (0/20 both — probe still uses the
stale `Player action:` wrapper, separate fix); Cydonia controls held dialogue 8/8 on all arms.
Honest caveat: the probe is single-prior-turn; the real T27/28 failure lived in a 27-turn context
where instruction-following is weaker — the convention's long-session value rests on the documented
channel + rider recency, not on these near-saturated single-turn numbers.
Original finding follows for context.
T27/28: in-character hesitation read as a real brake; Sarah dismounted twice; user had to script
the NPC (T29) to proceed. The model's read was coherent — the missing signal is authorial register.
Feature: documented OOC convention — bracketed/parenthetical text in the action treated as
authorial direction, defined in the narration prompt. Small feature, clear scope.

### 4b. Un-baited dialogue is at ZERO on cloud (found 2026-07-24, not yet worked)
Probe hygiene fix turned up a live pathology. `dialogue-unbaited-probe.mjs` (NPC present but passive,
player's action ambient — set down a pack, stand near, keep walking) on the current shipped prompt:

| tier | NPC spoke | note |
|---|---|---|
| cloud default | **0/20** | identical bare-action vs rendered-user-template (0/20 both) |
| Cydonia 24B | **10/15** | same cases, same prompt |

Not a metric artifact — read the raw output: barkeeps *nod, slide a mug, acknowledge without ceremony*,
never a quoted line. Not an assembly artifact either: both probes were fixed this session to send the
real rendered `defaultNarrationUserPrompt` (they sent the bare action; `--bare` keeps the ablation) and
the arms measured identical, because **the voice clause is conditional** — "When the player's action
*speaks to a character*…" — so it does not fire on exactly the ambient turns where the silence lives.
The dialogue-collapse work (shipped, [[dialogue-collapse-investigation]]) fixed baited scenes and the
long-session hold; this class was never covered.

**VERDICT 2026-07-24: not a prompt problem. Do not iterate wording further.**

Probe hardened first: cases tagged by how the prior narration frames the NPC (`framing:`
withdrawn/neutral/engaged/expectant), three new **expectant** cases added (NPC oriented at the player
and socially due to speak — paid ferryman casting off, stranger sharing your table, stablehand awaiting
instruction — while the player's action still says nothing), plus two in-batch negative controls
(`guard: true`: empty room, mute animal) so the false-positive axis rides every run.

Cloud, 4 runs/case (32 positive runs per arm):

| arm | NPC spoke | expectant | guard |
|---|---|---|---|
| control (shipped) | **0/32** | 0/12 | 0 quotes / 8 |
| `initiative` — line-10 tail gains unprompted speech | **0/32** | 0/12 | 0 / 8 |
| `userinit` — voice clause unconditional (both locations) | **0/32** | 0/12 | 0 / 8 |

Cydonia, same cases, shipped prompt: **15/24** (expectant 7/9, engaged 5/6).

Exact wordings tested (recorded here so they are not re-tried — the scratchpad copies are gone):
- `initiative` replaced line 10's tail with: *"Their words respond to what the player just said or did -
  and when the player says nothing to them, whoever is present still speaks first: a greeting, a
  question, a demand, something they have been waiting to say."*
- `userinit` replaced the voice clause (both locations) with: *"The reply on the page carries the voice of
  whoever is present: their quoted sentences - answering the player if they were spoken to, and otherwise
  speaking up on their own about what they want or notice."*

Three phrasings × 96 cloud runs → exactly zero. An earlier small batch showed 2/15 and 1/15; that was
noise, confirmed by the larger paired run. The disengagement confound is **disproven** — expectant
cases scored the same hard zero as withdrawn ones, and only `dock-worker` was ever truly withdrawn.
Cloud isn't omitting speech by accident: it actively narrates *around* it ("the silence stretches
taut", "her unspoken offer", "waiting"), silence-motif ~0.7-0.8/turn.

So per the guide's prompt-vs-model rule this is model interpretation, not contract wording — and
tightening the contract twice bought nothing, so the remaining levers are **not prompt text**:
- sampler (untested on this axis; narration is deliberately unpinned),
- the planning modes, which already force spoken beats (`defaultThinkingPrompt` Beats: "in quotation
  marks, the words the present characters actually speak aloud") — likely the real mitigation for
  cloud users, and cheap to test with the same cases.

**Cydonia over-fire, worth its own line:** its guard hit 6 quotes / 6 runs, but the empty room was
clean 3/3 and the mare never speaks — Cydonia **invents an unrequested human** (a ferrywoman walking
in) who then talks. Different failure from voicing a non-speaker, and arguably worse (invented cast).
Not yet investigated.

### 5. Repetition / stalling in sustained scenes — IN PROGRESS (harness solved, arms unresolved)

**2026-07-24. The blocker was reproducing the bug, and that is now solved.** Three harness additions to
`format-arms-probe.mjs`:
- **`--prefill N`** — seed history with the recorded run's OWN narrations for turns < N, then generate
  from N on (only generated turns scored). Repetition collapse is an *in-context feedback loop*, not a
  property of the action script, so it must be entered, not replayed into.
- **callback guard** — `callback x/n (names/turn)`: does the turn still name people/places established
  earlier in the chain. Read WITH echo5: echo down + callback flat = win; both down = the clause is
  eating deliberate callbacks. This is the axis that makes an anti-echo arm judgeable at all.
- **sampler variants** (`freq03`/`freq06`/`pres03`) + `--freqpen`/`--prespen`. Modelled as *variants* so
  a sampler arm rides the same batch as the prompt arms — cloud drifts up to 3x between batches.

**Reproduction, measured (echo5 per 100w):**

| corpus | echo5 |
|---|---|
| real session T40-44 (the pathology) | 63 · 35 · 41 · 60 · 56 |
| clean 45-turn replay, cloud | ~1 |
| prefill 38, **cloud** | 0.5 |
| prefill 38, **Cydonia** | **24.7** |

So **item 5 is a local-tier failure**: cloud does not repeat (it fails the *other* way — see 4b), Cydonia
does, at ~50x cloud on identical prefilled context. Cydonia + `--prefill 38` is the corpus; any arm
judged on a clean replay is measuring a bug that isn't there (a full cloud arm batch was run before this
was understood — discarded).

**Arms so far — all unresolved, nothing shipped.** Cydonia, prefill 38, n=2:

| arm | echo5 (run1 / run2) | callback |
|---|---|---|
| control | 25.8 / 26.8 | 7/7 |
| `antiecho` | 29.6 / 18.5 | 7/7 |
| `payoff` | 22.0 / 31.8 | 7/7 |
| `freq03` (frequency_penalty 0.3) | 21.5 / 30.4 | 7/7 |

Within-arm spread (σ≈5-6) exceeds every between-arm difference, so nothing is distinguishable at n=2.

**Large paired batch run 2026-07-24 (32 chains, 8/cell, Cydonia + prefill 38, 22 min).** Aggregated by
the new `arms-aggregate.mjs` (mean±sd + Welch t vs control; validated by reproducing the n=2 means):

| arm | echo5 mean±sd (n8) | vs control | callback | names/turn | dialogue |
|---|---|---|---|---|---|
| control | 26.2 ± 6.2 | — | 100% | 3.98 | 24.5% |
| `antiecho` | 28.0 ± 10.3 | +1.8 (t=0.42) | 100% | 4.04 | 25.6% |
| `payoff` | 25.3 ± 4.2 | -0.9 (t=-0.35) | 98% | 4.14 | 24.0% |
| `freq03` | 24.4 ± 6.5 | -1.8 (t=-0.57) | 100% | 3.86 | 24.3% |

**Verdict: none of the three levers moves repetition.** Every |t| < 0.6. Callbacks and dialogue are flat
across all arms, so nothing regressed either — the arms simply do nothing. With σ≈6.2 at n=8 this batch
rules out any effect larger than ~6 echo points (~24% relative); anything smaller isn't worth a prompt
change. Every earlier hint (freq03 looking clean, antiecho looking harmful) was noise from n=2 and from
the invalid clean-replay corpus — both are now explicitly disconfirmed.

**`freq06` batch, paired fresh control (16 chains, 12 min):** `freq06` 24.6 ± 4.7 vs control 24.2 ± 6.6,
**t=0.14** — null. Doubling the penalty changes nothing. Callback 100% both.

**The parameter is genuinely honored — verified, not assumed.** Same seed/temp, `frequency_penalty` 0 vs
2.0 on a deliberate repeat-this-sentence prompt: 0 repeats verbatim 5x; 2.0 swaps "red"→"crimson" and
visibly breaks down ("cr Crimson Door Stood Out Against The..."). So the nulls are real. That test also
shows **why**: even at 2.0 the model still repeats the sentence verbatim ~3x *before* degrading — token
frequency penalties damage fluency before they touch phrase-level echo. Wrong instrument, not too small
a dose. Consider the `frequency_penalty` family closed for this pathology.

Control was 26.2 ± 6.2 and 24.2 ± 6.6 across two independent batches — the corpus is stable and Cydonia
does not batch-drift the way cloud does, so pooled control ≈ 25.2 (n=16) is a usable reference.

**Where that leaves item 5.** Adjacent-turn echo is what the real session showed (T44/T45 shared 50
8-grams) and adjacent turns both sit *inside* the verbatim floor, so the digest band cannot reach them —
not fixable by the memory layer either. Six cells now null (2 prompt arms, 2 sampler strengths, plus the
earlier discarded cloud work). Remaining, all **non-prompt**:
- app-side anti-echo over the *context*: condense or strip the immediately-prior narration's distinctive
  phrases before resend — attacks the actual mechanism (the model imitating text in front of it);
- app-side post-generation retry when a turn's n-gram overlap with the previous turn exceeds a threshold
  (the metric already exists in the harness);
- a `repetition_penalty` / top-p sweep — different mechanism from frequency/presence, untested.
▶ Item 5 should not get more prompt-wording work; the evidence is now strongly against it.

**`repeat_penalty` sweep, 2026-07-28 — the first arm to move the needle, not yet conclusive.**

First, a naming finding that invalidates any earlier assumption about this lever: **LM Studio honors
`repeat_penalty` and silently ignores `repetition_penalty`** — and `repetition_penalty` is the name the app
was sending ([GameViewer.tsx](../src/views/GameViewer.tsx) narration body), so the Repetition Penalty setting
was a no-op on every LM Studio endpoint. Verified live (temp 0, seed 42, loaded Cydonia): `repeat_penalty` 2.0
visibly destroys output, `repetition_penalty` 2.0 is byte-identical to a bogus-field control. Fixed by sending
both spellings. **DRY is not reachable from LM Studio at all** — `dry_multiplier` up to 10 with
`allowed_length` 1, in flat/camelCase/nested forms, on both `/v1` and `/api/v0`, all byte-identical to
baseline; LM Studio's own `LLMPredictionConfigInput` lists no `dry*` field. Testing DRY means running the
GGUF under `llama-server` instead.

Batch: `--arms B --edit none,rep11,rep12,rep13 --runs 8 --turns 45 --prefill 38 --serial`, cydonia-lmstudio.
`--serial` is now mandatory on this corpus — two concurrent chains split LM Studio's loaded context and every
call 400s with "Context size has been exceeded".

| arm | echo5 mean±sd (clean chains) | vs control | words/turn | callback | dialogue | failed turns |
|---|---|---|---|---|---|---|
| control | 27.8 ± 4.8 (n=8) | — | 140 | 7/7 every run | 20-27% | 0/56 |
| `rep11` (1.1) | **22.7 ± 6.8 (n=8)** | **-5.1, t=-1.74** | 152 | 7/7 every run | 19-32% | 0/56 |
| `rep12` (1.2) | 18.8 ± 5.7 (n=4) | -9.0, t=-2.70 | 190 | 6-7/7 | 8-26% | **13/56** |
| `rep13` (1.3) | — (n=1 clean) | unusable | 238 | 1-7/7 | 0-14% | **28/56** |

**rep11 is the only clean, undamaging arm, and it's the largest effect any lever has produced** (-18%
relative, vs |t| < 0.6 for all four earlier arms). It is *not* significant at n=8 — one outlier run (37.2)
carries most of its variance — but it sits right at the edge of the ~6-point resolution this corpus has at
n=8. Callback holds 7/7 on every run and names/turn is flat (3.9 → 3.9), so nothing regressed.

**Why 1.2 and 1.3 are invalid, and it's a finding rather than a harness bug:** the penalty inflates output
length (140 → 152 → 190 → 238 words/turn), the longer history overruns the 12288-token loaded context, and
turns start returning empty. The surviving chains are the ones that happened to write short — survivorship
bias, so their echo numbers can't be read. The collateral damage is visible anyway and matches what
`frequency_penalty` did: at 1.3 dialogue collapses (0-14% vs 20-27%), quoted turns drop to 0/7-3/7, and
names/turn falls to 0.9-2.7. **Fluency breaks before echo does, again — the dose window is narrow and 1.1 is
inside it.**

**CONFIRMED at n=16 (2026-07-28, fresh paired batch, zero failed turns):**

| arm | echo5 mean±sd | delta | t | words | names/turn | dialogue | callback |
|---|---|---|---|---|---|---|---|
| control | 28.8 ± 7.3 (n=16) | — | — | 149 | 3.88 | 23.4% | 100% |
| `rep11` | **22.5 ± 4.8 (n=16)** | **-6.3 (-22%)** | **-2.88** | 153 | 4.01 | 23.1% | 100% |

Pooled with the n=8 batch (control 28.5 ± 6.5, rep11 22.6 ± 5.4, n=24 each): **-5.9, t=-3.43**. Both batches'
controls agree (27.8 / 28.8), confirming again that Cydonia doesn't batch-drift.

**Every guard axis is flat.** Callback fires on 100% of turns in both arms (zero variance, so no t), names/turn
3.88 → 4.01 (t=0.86), dialogue 23.4% → 23.1% (t=-0.23), words +7 (t=1.90, ns). So this is echo suppression
without the callback/fluency cost that killed `frequency_penalty` and `rep13` — the first lever in this item
that does anything, after six null cells.

▶ **Item 5 has a local-tier answer: `repeat_penalty` 1.1 on Cydonia.** Ships as a documented local-model
setting, NOT a default — cloud sits at echo5 ~0.5 and needs none of this. Still open: (1) reload Cydonia at
≥24576 context so 1.2 is testable at all (12288 makes it blow up on output length alone); (2) the app-side
levers stay unexplored and are the only route for models where the sampler isn't reachable.

### 5. Repetition / stalling in sustained scenes (original finding)
close.json T38–45: "some part of you that no one else ever has" ×6, T44~T45 share 50 8-grams;
scene stopped advancing (six turns of announced-but-never-arriving climax). Mechanism:
4 near-identical verbatim turns + similar actions + unpinned narration sampler → in-context
frequency self-reinforces. Two levers, probe both directions (anti-echo must not kill callbacks):
- prompt: anti-echo clause ("language already on the page is spent");
- sampler: test presence/frequency penalty pinned for narration on the cloud arm
  (narration currently inherits endpoint defaults by design).
Deeper stalling fix is the planner (thinking modes) — out of scope for the raw-narration lane.

## Parked / smaller

- **OOC-only actions feed an empty `<PLAYER ACTION>` to the digest + time-passed writers** (found
  2026-08-04, shipping the Continue button). `stripOocDirectives('[Continue the Story]')` → `""`,
  so `defaultSummaryUserPrompt` renders `The player's action this turn:` with nothing after the
  colon. Pre-existed for any bracket-only action, but the Continue pseudo-choice makes it the
  common case. Candidate fix: code-side substitution when the strip empties the action — e.g.
  "(the player let the scene continue)" — but the wording is a prompt surface, so A/B probe the
  digest quality on Continue turns (both tiers) before shipping any phrasing.
- **Cloud never says "nothing notable"** on idle turns (summary probe missedIdle=3 before AND
  after the fact fix). Digest noise reduction candidate.
- **Q-run C1 reader-side**: T21 had compass in context and narrated a vague inventory —
  narration-prompt question (deploying available recap facts), judge-bar call.
- **T5 `*thwuck*` markdown tic** — recurring on markdown-off runs (2 of 3 Q runs).
- **Markdown-off heading sanitizer** — Cydonia Q run: a one-off `# Sedge Landing` heading at T22
  self-perpetuated through the verbatim floor (T23–25 all copied it); replaying the same context
  8× produced zero headings, so it's rare-roll + imitation, same amplification dynamic as the
  length collapse. Cheap structural fix: strip heading/list markdown from narration app-side when
  markdownOutput is off, breaking the feedback loop. Also covers the `*thwuck*` tic.
- **Possessions established in passing** — Q-run C1's residual class: the compass digest survives
  the writer but reads as a completed event, so the selector defensibly drops it; "a thing gained
  and kept" doesn't cover things already owned. Candidates: a possessions clause in the now-line,
  or a selector keep-category — but the example holds ~two lessons max, so probe carefully.
- **Wine→beer drift** (close.json T1→T11) — minor world-fact continuity, single instance.
- **Structural rut**: most turns end with a question/demand from the NPC; reads engaged early,
  mechanical by T30. Needs a measurement before any prompt work.
- **Judge rubric formalization**: subjective bars (agency, outcome narration, ack quality) are
  currently graded ad hoc in-session; write the rubric down if grading drifts.
