# 06: Dev Reload Banner on a Themed Tip

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Rationale: a small dev-only component moved from imperative DOM into React.

Parent: [Tooltip Dismissal spec](../spec.md)

## What to build

The dev reload banner moves from imperative DOM building into a React component, so its file list shows in a themed tip instead of a native title (Q5). It keeps its own root outside the App tree, so it survives a crash, and it builds its tip from the hand-built parts on the wrapped `Tooltip` root (Q8). It mounts only under the dev-only gate and never ships.

## Acceptance criteria

- [ ] The banner renders from React under the dev-only gate.
- [ ] The full file list shows in a themed tip on the summary line, at the app's tip delay.
- [ ] The banner and its **Reload** button still show when the app shows its crash screen.
- [ ] No native `title` is left in the banner.
- [ ] The **Reload** and **Apply** buttons behave as before.
- [ ] Checked once in the dev preview.
