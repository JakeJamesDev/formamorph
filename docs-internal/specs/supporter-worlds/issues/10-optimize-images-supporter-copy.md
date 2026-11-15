# 10: Client: Optimize Images on a Supporter Copy

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one more action in ticket 04's rule, read by one control.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

Found in the close review. The World Editor's Optimize Images re-encodes a Supporter Copy's images, which removes the watermark that R5 relies on. R29 skips the downscale offer for the same reason. Optimize Images is disabled with a tooltip on a Supporter Copy.

## Acceptance criteria

- [x] On a Supporter Copy, Optimize Images is disabled with a tooltip and runs no encode. (`WorldEditor.supporterCopy.test.tsx`: "disables Optimize Images in the Media tab and runs no encode")
- [x] On a plain world, it runs as before. (same file, plain-world test; `WorldEditor.optimize.test.tsx` unchanged in behavior)
- [x] Each guard is shown to bite by reinstating the bug. (rule set to `null` for a world: the rule test and the editor test both failed)

## Landed

**Not verified**
- Component and DOM tests only. No browser-pane check of the disabled button.

**For you**
- Open a Supporter world, go to the Media tab and point at Optimize Images. It should be dim and show the reason.
