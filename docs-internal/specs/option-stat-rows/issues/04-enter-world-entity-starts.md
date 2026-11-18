# 04: Enter World Entity Starts

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The close review found that the Enter World preview seeds entity stats without the picked values' Option starting rows or toggles (spec Q15, Q19). Global stats already include them. Entity stat-band Pins in the preview therefore read the wrong band. The editor's authored scene has the same gap. Entity trait starts are missing in both places too; decide whether to fix that here or name it.

## Acceptance criteria

- [ ] With Easy giving the Dragon "Health starting +20", the Enter World preview's Dragon Health reads the raised value, and a stat-band Pin on the Dragon resolves from it.
- [ ] An Option toggle on an entity stat shows in the preview.
- [ ] The guard goes red with its bug reinstated.
