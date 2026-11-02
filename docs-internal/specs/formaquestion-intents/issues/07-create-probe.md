# 07: Create Probe

Status: ready-for-human
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: two arms, a parser-scored bar, and a hand-graded sample.

## What to build

Measure creation against its bars, tune the Create pins, and flip the Creation default only if it passes.

- Create cases on the bundled worlds: single entities, several at once, and follow-up redrafts.
- Arms: the fenced block in the streamed reply (shipped), and a strict-schema draft request as the control (Q35).
- Scores: valid blocks per ticket 04's parser (Q61), and a hand-graded sample for fit to the world and its tone (Q62). Cloud default first, with an in-batch control, per the probe skill.
- Bars: at least 90% of blocks valid, at least 80% fitting by hand grade. The create-ask and false-Create rates come from ticket 06's corpus (Q8).
- Set the Create prompt kind's sampler pins from the runs.
- Measure the Creating prompt, the sample format and the off-editor refusal rider, which ticket 05 shipped unprobed. The Mascot Voice chip on the Creating prompt still says to write control names as the guide writes them. That frame is shared by every help prompt, so check whether it hurts drafts before changing it.
- On a pass, flip the Creation switch's default to on. On a fail, leave it off and record the numbers (Q15, Q43).

Spec: Q8, Q15, Q35, Q43, Q61, Q62; Testing Decisions.

## Acceptance criteria

- [x] The probe scores validity with the shared parser for both arms. `scoreCreateReply` calls `readEntityBlock`; the schema arm goes through `schemaAsBlocks` first (`help-create-score.test.ts`).
- [x] The hand-grade sample is written out for the user to grade, with the probe's own grade beside it. 36 drafts in `create-grade.md`, with the judge's grade, a spot check and an empty column for the user.
- [x] The Create pins are set from the runs, with the numbers that chose them. They stay at 0.7 / 1 / 800; see Numbers below.
- [x] The default flips only when every bar passes, and the numbers are recorded in the ticket's Landed section either way. Per the spec session's ruling, the default stays off in this ticket: the fit bar is the user's hand grade.

For you: hand-grade the sample against the 80% fit bar.

## Landed

Cloud default (`api.lyonade.net`, model `default`), 2026-10-31. Every batch has an A/A arm (`aa`). Case kinds: 28 create cases on 7 bundled worlds (single, several, redraft), plus 4 off-editor refusal cases, split 20 dev / 12 blind before any run; 5 runs per arm. The classifier and pick requests are canned, so only the Create request varies. Probe: `testing/baseline/harness/help-create-probe.cli.ts`.

**Two revisions (of three allowed):**

1. The entity rider now says one block holds one entity. The shipped rider let the model stack several entities in one fence, which the parser reads as one description of more than four sentences. Valid blocks went from 92% (A/A 94%) to 98% (A/A 92–93%). Per-run valid scores were 97–100 against the controls' 88–97.
2. The Create prompt's naming line now points at the list of names in use, and the user message labels that list **Names In Use** in place of **Entities**. The prompt also keeps the Mascot's voice out of the AI Description. Before the change, 15–20% of drafts reused a name the world already had (Sora Amagi, Mr. Kuroda, Midnight Shimmer and others), and the judge passed those drafts. Duplicates went from 14–18% to 0%. Judged fit with a new name went from 81–83% to 96%; per run it scored 91–100 against the controls' 77–88.

**Numbers (record batch, final text):**

| Arm | Valid blocks | Right block count | Duplicate names | Judged fit, new name | Refusal |
|---|---|---|---|---|---|
| shipped | **100%** (182/182) | 98% | 0% | **92%** | 100% (20/20) |
| aa | 98% (175/178) | 95% | 1% | 91% | 100% (20/20) |
| schema (Q35 control) | 99% (183/184) | 99% | 0% | 94% | – |
| t0.5 | 98% | 95% | 0% | 93% | – |
| t0.9 | 98% | 94% | 0% | 92% | – |
| novoice | 98% | 94% | 1% | 91% | – |
| full (classifier off, Q64) | 99% (138/139) | 71% | 35% | 38% | – |

- **Bars:** valid blocks ≥ 90% passes on dev (100%) and blind (100%). Fit ≥ 80% passes on the judge and on the spot check (33/36 each), and waits on the user's grade.
- **Pins:** 0.5, 0.7 and 0.9 did not separate beyond the A/A spread in either full batch (valid 94/93/96% and 98/97/96%; fit within 3 points). 800 tokens capped 0 of 140 shipped replies, so the pins stay at temperature 0.7, repetition penalty 1 and 800 tokens.
- **Mascot Voice chip:** an arm without the guide-control-names line scored no better on validity (89% vs 92–94%, then 98% vs 98–100%) or fit. The shared chip stays as it is.
- **Schema control:** it drafts about as well as the streamed fence, so Q35 holds. Its numbers carry one confound: the revised Create prompt says to keep the voice "around the blocks", which the JSON arm has none of.
- **Refusal rider:** 159 of 160 off-editor replies passed over four batches. The one miss was a Gemma reasoning spill.
- **Ticket 06's Create numbers** (create asks given Create ≥ 90%, false Create ≤ 5%, Q8) do not exist yet: ticket 06 had not landed at this landing.

**Not verified:**

- The sample format (two sample entities, Q28) ran only as shipped. No arm varied it.
- Only the cloud default ran; there was no local arm.

**For you:**

- For you: hand-grade the sample against the 80% fit bar. Fill in **Your grade** in [create-grade.md](../create-grade.md); the spec session then flips **Creation** on a pass.
- With the Intent Classifier off, Creation runs on the full request with the entity rider (Q64). There, 22% of replies hold no block, 35% of drafts reuse a world name and judged fit is 38%: that path never sees the Names In Use list or the samples. Decide whether that path needs its own work before **Creation** defaults on while **Sort Questions** may stay off.
- Gemma's reasoning spill ("thought …") shows on 3–8% of Create replies. It can glue the fence to a line's end or eat the 800-token cap. That comes from the model, and these two revisions do not address it.
