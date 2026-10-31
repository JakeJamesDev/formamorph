# 07: Create Probe

Status: ready-for-agent
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

- [ ] The probe scores validity with the shared parser for both arms
- [ ] The hand-grade sample is written out for the user to grade, with the probe's own grade beside it
- [ ] The Create pins are set from the runs, with the numbers that chose them
- [ ] The default flips only when every bar passes, and the numbers are recorded in the ticket's Landed section either way

For you: hand-grade the sample against the 80% fit bar.
