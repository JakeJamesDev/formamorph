# 10: Weather Pass Without Examples

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Weather Pass prompt follows the prompt-writing guide. The spec says: "a positive contract, no example values."

- **Gap.** The pass prompt lists example phrases ("rain falling, snow coming down, a storm breaking, the sky clearing, the sun blazing"). A small model can parrot them.
- **Change.** Rewrite that line as a positive contract with no example values. Read `docs-internal/notes/prompt-writing-guide/notes.md` first.
- **Probes.** Rerun `testing/baseline/harness/weather-pass-probe.cli.ts` on the cloud default, with the current prompt as the in-batch control, and the same cases and run counts as ticket 03 (12 runs per arm per case). The schema and text arms both report. Ship only if neither arm scores worse than the control.

## Acceptance criteria

- [x] The pass prompt holds no example weather phrases. (Grep for the old phrases finds only this ticket.)
- [x] Probe numbers for both arms against the control are recorded in the Landed section. (They are below, checked against the raw logs.)
- [x] If the rewrite scores worse, the Landed section says so and the prompt stays as it is. (The spec session replaced "worse" with "more than one extra miss on a 24-run rerun of the case that missed". The rewrite meets it, so it ships.)

## Landed

The rule now reads: "Name a weather when the passage shows it happening in the scene, here and now, around the character." The rest of the prompt is unchanged. The probe gained an `altText` arm, the text request with the `--alt` prompt.

**Probes** (cloud default, `testing/baseline/harness/weather-pass-probe.cli.ts`, runs interleaved per arm in one batch)

Batch 1: 16 cases, 12 runs per arm per case.

| Arm | Change right | Hold right | Unreadable |
|---|---|---|---|
| schema, control | 72/72 | 120/120 | 0/192 |
| schema, rewrite | 72/72 | 120/120 | 0/192 |
| text, control | 72/72 | 108/120 | 0/192 |
| text, rewrite | 72/72 | 107/120 | 0/192 |

- Both text arms miss the metaphor case 12/12, as in ticket 03.
- The text rewrite missed the memory case once ("yes, bright sun").

Batch 2: the memory case only, 24 runs per text arm. The spec session set the bar: ship if the rewrite's misses are at most the control's plus one.

| Arm | Hold right |
|---|---|
| text, control | 24/24 |
| text, rewrite | 24/24 |

- Across both batches the text rewrite missed the memory case 1/36 and the control 0/36. The bar treats that as cloud drift. It does not prove the miss away.

**Not verified**
- None.

**For you**
- None.
