# 23: Optimize Images Scans Item Images

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: items join the scan, the re-encode write and the apply step, and each has its own shape.

## What to build

**Optimize Images** never scans item images: its image list takes the overview, entities, locations, dictionaries and groups, with no items. Confirmed in source, not run. Ruling Q19: item images join the scan and the apply step, inside the same **Optimize Images** history Step. An item copy's image, if it has its own, follows the same rule.

Spec: Q19.

## Acceptance criteria

- [ ] A World Editor optimize test with an oversized item image fails today (the old image stays), then passes with the re-encoded image
- [ ] One undo reverts the item change with the rest of the run (test)
- [ ] The scan's count includes item images (test)
- [ ] The World-Editor-Media sentence on what Optimize Images changes names item images; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤
