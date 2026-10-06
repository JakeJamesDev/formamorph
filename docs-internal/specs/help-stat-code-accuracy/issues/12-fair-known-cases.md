# 12: Fair Known Cases

Status: done
Blocked by: 08 — Code Test Probe Arm
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: two case edits with an existing alternate form, plus an offline re-score of saved answers; no model run.

## What to build

A known case accepts every answer that is right under the context the model was given. The help request names the open tab but not the open stat, so on `brave-at-courage` ("my Courage") and `quotes-pin` ("my Int") a `self.value` read is as right as `stats.Courage.value` or `stats.Int.value`. Both cases list `self.value` as an alternate. The saved answers from ticket 08's baseline batch (1621 s) and its stopped re-run are re-scored offline with the corrected cases, and the corrected known-case rates are recorded in ticket 08's Results and in the spec, beside the original ones. No GPU run.

An audit note lists each known case and the context it depends on, so a later case is written fair from the start. When ticket 13 lands and the request names the open stat, these two cases may pass the stat in the surface and require the named stat again; that is 13's work, not this ticket's.

## Acceptance criteria

- [ ] `brave-at-courage` and `quotes-pin` accept `self.value` beside the named stat
- [ ] The harness unit tests cover the alternate on both cases
- [ ] The 1621 s baseline and the stopped re-run are re-scored offline; the corrected rider and test known-case rates are recorded in 08's Results and in the spec
- [ ] An audit note in the cases file states, per known case, what context the answer depends on
- [ ] No changelog fragment: harness only
