# 11: Transitions

Status: ready-for-human
Blocked by: 08, 10
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A face change plays a motion the player can tune.

- One pure timing function: elapsed time and tuning in, scale and opacity out. Modes: None (a step), Dissolve (cross-fade over a duration), Jelly (the prototype's shape and defaults). The prototype, the tab preview and the window share it.
- The rig gains the transition (mode and tuning), parsed with the rig; a rig without one reads as the default's.
- The tab gets the mode select, its tuning controls within the prototype's ranges, and a Play button that runs it on the preview.
- Ticket 07 landed the mascot piece holding every image the rig uses, so a face change never re-reads the store. The transition reads from that held set; no load waits inside it.
- The window plays it on every composition change; a change mid-transition restarts from the current frame. The system's reduced-motion preference forces None, and the tab says so when it applies.

Spec: Q31; Implementation → Transition.

Recommended model rationale: animation with a pure core and a compositing check that jsdom cannot make.

## Acceptance criteria

- [ ] Pure samples: None is a step; Dissolve ends at full opacity; Jelly starts and ends at scale one, dips below one, passes above one and settles within its duration, at the defaults and the range ends.
- [ ] The tab's Play runs the chosen mode on the preview; the controls stay within the ranges.
- [ ] Playwright per-frame sampling of the painted scale shows the dip and the overshoot on a face change; reduced motion under emulation swaps at once.
- [ ] A rig stored before this ticket reads as the default transition.
- [ ] The four gates are green.
