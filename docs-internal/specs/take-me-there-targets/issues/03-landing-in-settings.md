# 03: Landing in Settings

Status: ready-for-human
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [spec.md](../spec.md), rulings Q3, Q4, Q5, Q7.

## What to build

Take Me There on an answer about a Settings control opens Settings on the right tab, then scrolls the control's row into view, focuses the control when it takes focus, and pulses the ring once. One landing hook does this for every host; Settings is the first. The hook waits for the tab panel's mount, scrolls the nearest scroll viewport, lands silently when the target is absent, and lands again on a repeat request. The Settings modal's existing jump to a Messages field moves onto the same hook. Every Settings how-to section whose last step names a control gets its target and registry entry; sections that end at a tab keep the bare route.

## Acceptance criteria

- [ ] Opening Settings with a target scrolls the row into view and focuses its first focusable control
- [ ] The pulse class is present once and gone after the animation end; reduced motion draws the ring without it
- [ ] A registered target absent from the DOM leaves the tab open with no error and no toast
- [ ] A repeat request for the same target scrolls and pulses again
- [ ] The Messages-field jump uses the same hook and its existing tests stay green
- [ ] Every Settings how-to section that ends at a control carries a target; the report-only check lists none for Settings
- [ ] Guard bites: drop the mount wait and the landing test goes red
- [ ] Changelog line under In Progress
