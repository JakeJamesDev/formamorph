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

**▶ Resume here:** next up is item 4 (OOC / register channel). Item 3 is largely absorbed by
item 2's now-line (notes now ride the recap's end) — revisit only if frame-fact failures persist.

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

### 4. OOC / register channel
T27/28: in-character hesitation read as a real brake; Sarah dismounted twice; user had to script
the NPC (T29) to proceed. The model's read was coherent — the missing signal is authorial register.
Feature: documented OOC convention — bracketed/parenthetical text in the action treated as
authorial direction, defined in the narration prompt. Small feature, clear scope.

### 5. Repetition / stalling in sustained scenes
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
