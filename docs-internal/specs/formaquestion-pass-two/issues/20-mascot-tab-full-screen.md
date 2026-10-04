# 20: Mascot tab full screen

Status: ready-for-human
Blocked by: 19
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Mascot tab fills the screen on request, like Prompts and Tools in Settings, built on the shared pieces the preset-header effort extracted.

- The tab's hand-rolled preset row becomes the shared preset header, as the Formaquestion Prompts tab and the endpoint editors already use: label, select, and the actions on the active mascot, icon buttons at `md` and up with destructive actions left of the select and file actions right, one ⋯ menu below `md`. Delete keeps its confirm through the header's own confirm; Reset has none (Q57). The Q58 tooltips become the actions' labels.
- "View full screen" is one more header action on the right. It morphs the whole tab (header, switch row, both columns, Save and Cancel) through the shared panel shell the Formaquestion Prompts tab hosts (preset-header ticket 09): the tab owns the morph, hands its root as the source, and the shell returns focus to the toggle. Rename the shell if its prompts-specific name reads wrong once two tabs use it.
- The Formaquestion Settings dialog's own tabs and footer stay behind. The dirty-draft prompt still guards close while full screen is up. At `lg` and wider the overlay keeps the two-column split; under it the tab stacks.

Spec: Q62, Q64; Implementation → Mascot tab.

Recommended model rationale: a preset-row swap onto the shared header plus the panel morph, with focus return and the draft guard.

## Acceptance criteria

- [ ] The preset row renders through the shared header: icon actions at `md`, the ⋯ menu below, Delete's confirm through the header, Reset without one.
- [ ] Component tests: the toggle mounts the shell with the whole tab inside; Exit unmounts it and focus returns to the toggle; Save works inside full screen; close with a dirty draft prompts.
- [ ] Playwright: the fullscreen morph e2e spec samples the Mascot trip per frame, as it does the Formaquestion Prompts trip.
- [ ] The four gates are green.
