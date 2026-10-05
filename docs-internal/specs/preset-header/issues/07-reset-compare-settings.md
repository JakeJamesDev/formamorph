# 07: Reset and Compare in Settings

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Every editable prompt in Settings has a Reset and a Compare, placed by one rule.

- The compare dialog lifts out of Formaquestion into a shared component fed the default text by the caller.
- Short labels with icons. Reset confirms with a dialog that names the prompt. Both disable when the text equals the default and hide on a built-in preset.
- One prompt on screen: the pair sits in the modal footer, right-aligned, Reset left of Compare. The Options view and the hub show neither.
- Messages view: the pair sits at the right of each label row where Reset sits today.

Spec: Q13, Q15; Implementation → Reset and Compare.

Recommended model rationale: a new shared dialog, default-text plumbing for every prompt and message, and placement across two views.

## Acceptance criteria

- [ ] Each single-prompt tab shows Reset then Compare in the footer, right-aligned.
- [ ] Each Messages field shows the pair at the right of its label row.
- [ ] Compare opens a diff against the default; both disable when equal and hide on a built-in.
- [ ] Rendered tests cover placement, order, disabled state and the confirm.
- [ ] Changelog line under In Progress.
