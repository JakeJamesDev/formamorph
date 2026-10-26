# 02: Recommendation Copy

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q8; Implementation Decisions › Image panel, Help page)

## What to build

After this lands, an author can read each slot's recommendation as two numbers before uploading, in the editor and in the help.

- The image panel's budget line reads "Up to 1280 px on the long edge, about 250 KB" with the slot's own values from the slot table, so a later value change needs no copy edit. The Over Budget badge is unchanged.
- The World Editor Media help page gets one table of the four slots, thumbnail, entity, background and map, with the long edge and the byte number for each. The Map Background section points at the table instead of carrying its own numbers. The Optimize Images section says in one sentence what Downscale does to a lossless image.
- A world or import prompt that lists one image reads in the singular ("Downscale shrinks it"), where today it says "them" (ticket 01 landing note).
- Every new line follows the Writing Guide and passes the copy sweep. No changelog fragment: ticket 01's entry covers the change.

## Acceptance criteria

- [x] The image panel shows both numbers for each of the four slots, read from the slot table, with a frame per slot at 1280 wide in both themes: `.scratch/downscale-presets-02/frames/budget-line-<slot>-<theme>.png`. Eight frames; viewport emulated at 1280 wide, the pane's screenshot is 800 px wide. Slots: thumbnail, entity, background (a location), map.
- [x] The help page's table lists the four slots with the values the slot table holds, and no other section states a budget number. Grep of the page for KB, MB and px shows only the table.
- [x] A world prompt for one listed image reads in the singular, shown in the prompt hook suite. Test: "words a world prompt for one listed image in the singular".
- [x] The copy sweep finds nothing on the changed lines. `npm run copy:sweep` notices sit on keyword comments and older text.

## Landed

**Not verified:** nothing left unticked.

**For you:**
- The panel line formats the byte number in decimal units (`formatBytes`), so it reads "about 250 KB", while the size before it uses binary units (79 KB). Look at the framed image line in the image panel.
- The help page's new **Image Sizes** section sits between **Map Background** and **Sizes** in World-Editor-Media.md.
- The world and import prompts now use the singular for one listed image; before, they said "them".
