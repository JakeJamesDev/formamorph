# 10: Weather Pass Without Examples

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Weather Pass prompt follows the prompt-writing guide. The spec says: "a positive contract, no example values."

- **Gap.** The pass prompt lists example phrases ("rain falling, snow coming down, a storm breaking, the sky clearing, the sun blazing"). A small model can parrot them.
- **Change.** Rewrite that line as a positive contract with no example values. Read `docs-internal/notes/prompt-writing-guide/notes.md` first.
- **Probes.** Rerun `testing/baseline/harness/weather-pass-probe.cli.ts` on the cloud default, with the current prompt as the in-batch control, and the same cases and run counts as ticket 03 (12 runs per arm per case). The schema and text arms both report. Ship only if neither arm scores worse than the control.

## Acceptance criteria

- [ ] The pass prompt holds no example weather phrases.
- [ ] Probe numbers for both arms against the control are recorded in the Landed section.
- [ ] If the rewrite scores worse, the Landed section says so and the prompt stays as it is.
