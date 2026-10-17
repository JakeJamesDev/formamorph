# 01: World Probe

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q8; Implementation Decisions › World probe)

## What to build

One probe that judges any bundled world against an older revision of itself on the cloud model. Every world ticket uses it for its Q8 evidence.

Extend the existing world-narration probe:

- Accept every bundled world by id.
- Accept arms: the working-tree world, or the world at a git revision. Default arms are the working tree and the revision before the refresh.
- Interleave arms within one batch, so each batch carries its own control. Default 5 runs per arm.
- Default to the cloud endpoint. Replicate the sampler pins and send `reasoning_effort: "none"`.
- Report structural metrics per arm: stat pass validity, token and reasoning leaks, choices parse, unresolved placeholder tokens.
- Write transcripts per arm in a form the baseline rubric can score, plus a summary table.

## Acceptance criteria

- [x] The probe runs on all eight current worlds with two arms (working tree vs `HEAD`) and prints the summary table.
- [x] Structural metric functions have unit tests, and each test is shown to fail when its metric is broken.
- [x] A smoke run on the cloud endpoint for one world finishes, with its numbers in this ticket's comments.
- [x] The harness README documents the arm syntax and the Q8 pass bar.

## Comments

**Approach (spec session, 2026-10-16).** The probe drives the real dev build through the baseline harness (`appDriver.mjs`), so every script runs at its real timing and prompts and sampler pins are the app's own. It adds `reasoning_effort: "none"` at the network route and flags a run where no request reached the route. It replaces `world-narration-probe.mjs`. The dev-server port comes from `--port` or `WORLD_PROBE_PORT`, a used port stops the run, and 5180 is refused.

**Metric tests.** `world-probe-score.test.ts`: 11 tests, 0.9 s. A mutation script broke each metric in turn (15 mutants: narration, template tokens, reasoning tag and opener, chips, sent-side scan, choices bounds and voice, stat faults, empty stat reply, flags source, summary rate, and the two common red flags). All 15 failed the suite.

**Review fold-ins.** A pinned port in use is refused on both 127.0.0.1 and ::1 (checked against a live foreign server). The old probe's `NO-2ND-PERSON` and `OFFERS-CHOICES` flags apply to every world. An Opening Action starts at once (pre-filled input); an Opening Narration gets 20 s to start. A world missing at an arm's revision skips that world, not the batch. Re-smoke after the fixes (Drone, Emberwatch, worktree vs `HEAD`, 1 run): all metrics clean, 0 errors.

**Smoke run, Drone, cloud `default`, worktree vs `HEAD`, 1 run per arm:**

| Arm | Turns | Empty | Token leaks | Reasoning leaks | Placeholders | Choices ok | Stat ok | Flagged | Errors |
|---|---|---|---|---|---|---|---|---|---|
| worktree | 3 | 0 | 0 | 0 | 0 | 3/3 | 3/3 | 0 | 0 |
| HEAD | 3 | 0 | 0 | 0 | 0 | 3/3 | 3/3 | 0 | 0 |

**All eight worlds, cloud `default`, worktree vs `HEAD`, 1 run per arm** (16 runs, 4 min): every world played 3 turns per arm with 0 empty narrations, 0 token, reasoning or placeholder leaks, choices 3/3, stat 3/3 (Open Chat has no stats, so none was sent), 0 flags, 0 errors. Both arms are the same file today, so this proves the harness, not a world.
