# 22: Mascot switch to General

Status: done
Blocked by: 21
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Mascot switch is a window setting on the General tab, and the Mascot tab says so when it is off.

- The Mascot switch moves to the General tab's Window section, first: Mascot, Chat Style, Backdrop. The switch row on the Mascot tab comes out (Q68). The ⋮ menu gets no entry (Q70).
- With the Mascot off, the Mascot tab shows one line above the preset row, in the help voice: "The Mascot is off. Turn it on in General", with "General" a link to that tab. Everything else on the tab is disabled: the preset select and header actions, the preview's Mask handles, sliders and Play, the editor, and the footer (Q69, Q72).
- The link is a tab change, so a dirty draft runs the unsaved prompt first (Q71).

Spec: Q68–Q72; Implementation → Help settings, Mascot tab.

Recommended model rationale: a row move between tabs and one disabled state over an existing tab.

## Acceptance criteria

- [ ] Component tests: the Window section lists Mascot, Chat Style, Backdrop in that order; the Mascot tab has no switch; with the Mascot off the line renders, its link opens General, every control on the tab is disabled, and a dirty draft prompts before the link changes tabs.
- [ ] The copy sweep passes on the new line.
- [ ] The four gates are green.
