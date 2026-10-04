# 20: Mascot tab full screen

Status: ready-for-agent
Blocked by: 19
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Mascot tab fills the screen on request, like Prompts and Tools in Settings.

- A "View full screen" icon button at the end of the preset row, the same button Tools uses. It morphs the whole tab (preset row, switch row, both columns, and the Save and Cancel footer) into the full-screen shell; Exit morphs it back in place and returns focus to the button.
- Reuse the Settings modal's morph shell and hook. The Formaquestion Settings dialog's own tabs and footer stay behind. The dirty-draft prompt still guards close while full screen is up.
- Full screen lays the two columns out at lg and wider with the same split; under lg it stacks as the tab does.

Spec: Q62; Implementation → Mascot tab.

Recommended model rationale: a morph reuse across two dialog systems with focus return and the draft guard.

## Acceptance criteria

- [ ] Component tests: the button mounts the shell with the whole tab inside; Exit unmounts it and focus returns to the button; the footer's Save works inside full screen; close with a dirty draft prompts.
- [ ] Playwright: the morph lands on the full viewport at 1600×900 and returns under the still-fading shell, as the Prompts test does.
- [ ] The four gates are green.
