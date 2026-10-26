# 02: Recommendation Copy

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q8; Implementation Decisions › Image panel, Help page)

## What to build

After this lands, an author can read each slot's recommendation as two numbers before uploading, in the editor and in the help.

- The image panel's budget line reads "Up to 1280 px on the long edge, about 250 KB" with the slot's own values from the slot table, so a later value change needs no copy edit. The Over Budget badge is unchanged.
- The World Editor Media help page gets one table of the four slots, thumbnail, entity, background and map, with the long edge and the byte number for each. The Map Background section points at the table instead of carrying its own numbers. The Optimize Images section says in one sentence what Downscale does to a lossless image.
- Every new line follows the Writing Guide and passes the copy sweep. No changelog fragment: ticket 01's entry covers the change.

## Acceptance criteria

- [ ] The image panel shows both numbers for each of the four slots, read from the slot table, with a frame per slot at 1280 wide in both themes: `.scratch/frames/budget-line-<slot>-<theme>.png`.
- [ ] The help page's table lists the four slots with the values the slot table holds, and no other section states a budget number.
- [ ] The copy sweep finds nothing on the changed lines.
