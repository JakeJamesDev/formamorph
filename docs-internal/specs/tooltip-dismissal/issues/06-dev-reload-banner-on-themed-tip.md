# 06: Dev Reload Banner on a Themed Tip

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Rationale: a small dev-only component moved from imperative DOM into React.

Parent: [Tooltip Dismissal spec](../spec.md)

## What to build

The dev reload banner moves from imperative DOM building into a React component, so its file list shows in a `Tip` instead of a native title (Q5). It mounts only under the dev-only gate and never ships.

## Acceptance criteria

- [ ] The banner renders from React under the dev-only gate.
- [ ] The full file list shows in a `Tip` on the summary line.
- [ ] No native `title` is left in the banner.
- [ ] The **Reload** and **Apply** buttons behave as before.
- [ ] Checked once in the dev preview.
