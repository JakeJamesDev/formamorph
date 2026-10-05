# 04: Help Code Probe

Status: ready-for-agent
Blocked by: 01 — Close the Guide Fence and Check Every Fence; 03 — Code Rider on the Help Preset
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [spec.md](../spec.md), rulings Q7, Q8, Q13.

## What to build

A help-code probe in the baseline harness. Its case set holds stat-code questions against a fixture stat (a number stat with a range and a few neighbor stats, placeholders and traits) plus prose-only how-to controls. Two arms run the same questions in one batch: `rider` and `control` (no rider). Scoring is a pure function over an answer: fence present, fence closed, slot tag present per fence, and runs. A snippet runs when the stat-code executor evaluates it against the fixture stat without throwing and returns a number or nothing, inside the sandbox's own interrupt timeout.

The probe runs on the cloud default model, 5 to 12 runs per arm, and the ticket records the numbers against the bar: fence present at 90% or more and runs at 80% or more on the rider arm, with tag presence and truncated fences reported. Controls must stay prose. If the bar is not met, the rider text is tuned in this ticket and the batch rerun; the final numbers go in the changelog body and the spec's Further Notes.

Workload: harness design, sandbox fixture, and reading model output honestly. A top model at high effort. Cloud only; no local model.

## Acceptance criteria

- [ ] A case file of stat-code questions and prose controls, with a fixture stat
- [ ] A CLI with `rider` and `control` arms that share a batch, following the existing help probe's shape
- [ ] A pure scorer: fence present, closed, tagged per fence, runs; a throwing snippet scores not run; a scorer test covers each case from fixture answers
- [ ] The scorer runs snippets through the real stat-code executor, never a parse
- [ ] A results block in this ticket: model `root` name, runs per arm, every metric per arm, and the truncation rate
- [ ] Rider arm meets Q7 or the ticket says it does not and why
- [ ] Controls stay prose on both arms
- [ ] Changelog line under In Progress, Added, ⚙️
