# 21: Mascot full-screen split and no title row

Status: ready-for-human
Blocked by: 20
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Mascot tab's full screen gives the preview a third of the width, and the full-screen window stops spending a row on its name.

- In the overlay the Mascot tab's grid is one third preview, two thirds controls. Docked it keeps the 22rem preview column. The Prompts tab's full screen is unchanged.
- The shared panel shell hides its title row on both tabs. The title stays the window's accessible name; the preset header's toggle, reading "Exit full screen" in the overlay, is the visible way out.
- The fullscreen morph e2e spec re-samples the Mascot trip, since the columns reflow during the morph.

Spec: Q67; Implementation → Mascot tab.

Recommended model rationale: a grid change behind the morph flag, a shell prop, and one e2e re-sample.

## Acceptance criteria

- [ ] Component tests: the overlay grid is 1fr / 2fr on the Mascot tab and unchanged on Prompts; the shell renders no visible title on either, and the dialog is still named.
- [ ] Playwright: the Mascot full-screen preview column is one third of the viewport at 1600×900, and the morph samples per frame without a jump.
- [ ] The four gates are green.
