# 03: Narrated Move Prompt Split

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: one prompt edit judged by a probe A/B, with no code path change.

## What to build

The Narrated Move user prompt states each answer rule in its own short line (R1).

- The last sentence of the Narrated Move user prompt holds three conditions: the current location when the body is still there, a listed place whose description fits, and Elsewhere when no listed place fits. It becomes three short lines, written by the prompt-writing guide.
- The location-narrated probe runs the current text as an in-batch arm beside the new text.
- The new text ships only if no bar is worse than the current text in the same batches. If it is worse, the ticket lands the probe numbers only and keeps the current text.
- Docs that quote the prompt match what ships.

## Acceptance criteria

- [x] The probe on the cloud default model, 10 runs per scene, reports far, unlisted (scored by the ticket 02 ruling), carried, stay and router controls for both arms, plus first-token and total time. The numbers go in the ticket's `## Landed` section. `location-narrated-probe.cli.ts --arms current,narrated --runs 10`, table below.
- [x] The shipped text is no worse than the current text on any set in the same batches. The probe's R1 bar: every set MEETS.

## Landed

Probe: `location-narrated-probe.cli.ts --arms current,narrated`, cloud default model, 10 runs per scene, 68 scenes, both arms in the same batches. "current" is the shipped system prompt with the unsplit user prompt, frozen in the probe; "narrated" is the shipped split text. The `--arms` filter keeps the `reused` and `before` arms in the file.

| Set | current | narrated (shipped) |
|---|---|---|
| far, right | 100% (70/70) | **100%** (70/70) |
| unlisted, stop inside a listed place, hit | 100% (30/30) | **100%** (30/30) |
| unlisted, the rest, moved | 0% (0/20) | **0%** (0/20) |
| carried, moves found | 100% (100/100) | **100%** (100/100) |
| stay, false moves | 12.5% (10/80) | **12.5%** (10/80) |
| control scenes (router cases, Narrated Move matcher), right | 60.5% (230/380) | **64.5%** (245/380) |
| median first token / total (ms) | 139 / 195 | 140 / 196 |

- No doc quotes the Narrated Move user prompt, so no doc changed.
- No changelog fragment, by the R1 ruling.

**Not verified**
- Nothing in the criteria.

**For you**
- Nothing: the change is prompt wording with no visible surface.
