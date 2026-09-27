# 07: Sweep: menu components

Status: ready-for-agent
Blocked by: 01 — Details field and headline
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Every error toast in the menu components gets the same treatment. Each of the 55 sites is classified: a toast raised in a catch, or from a failed result that carries an error, moves to the shared helper with its current message as the headline; a form validation, refusal or other toast with no error behind it stays plain. No toast wording changes.

Recommended model rationale: a mechanical sweep with a clear classification rule over one directory; judgment per site, no new design.

## Acceptance criteria

- [ ] Every caught-error toast in the menu components goes through the shared helper and offers **View Details →**
- [ ] Every validation or refusal toast in the menu components stays plain with no link
- [ ] No toast's visible words changed; existing tests that assert toast text still pass unmodified
- [ ] The sweep touches no file outside the menu components
- [ ] Four gates green
