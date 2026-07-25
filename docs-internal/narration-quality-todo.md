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
No arm harmed callbacks. **▶ Next: one large paired batch on Cydonia — 4 cells × 8+ runs × 7 turns,
serial (~225 local calls).** Do not read the n=2 table as a result in either direction.

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
