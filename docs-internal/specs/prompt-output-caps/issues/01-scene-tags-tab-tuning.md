# 01: Scene Tags Tab Tunes Its Own Prompt

Status: ready-for-human
Base: 7dbf23ca
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Spec: [Prompt Output Caps](../spec.md)

## What to build

A player who opens Settings → Prompts → Scene Tags → Options and changes a sampler, the reasoning switch, or the reasoning budget changes Scene Tags, not Narration. Today the tab is missing from the tab-to-request map, so its Options fall back to narration's tuning and the Scene Tags temperature pin is unreachable.

Add the map entry. Add a drift guard that asserts every grouped rail tab has a tab-to-request entry, so a future tab cannot land without one.

## Acceptance criteria

- [ ] On the Scene Tags tab, the Temperature row reads the `sceneTags` pin when no custom value is set, and a custom value written there does not change the Narration tab's row.
- [ ] The Native Reasoning switch and budget on the Scene Tags tab read and write the `sceneTags` entries.
- [ ] A drift guard fails when any grouped rail tab has no tab-to-request entry. Proven by removing an entry and watching it fail, then restoring it.
- [ ] Four gates green: typecheck, lint, test, build.
- [ ] `graphify update .` run.

## Notes

Workload rationale: a one-line map fix plus one guard test. Mechanical, no design decisions.
