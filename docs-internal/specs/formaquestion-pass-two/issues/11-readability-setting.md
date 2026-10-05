# 11: Readability setting

Status: done
Blocked by: 01, 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The treatment the user picked in ticket 01 becomes a setting.

- A help settings field beside Chat Style, with the name, range and default from the spec's ruling. A row on the General tab.
- It applies whenever the minimal chrome renders, under Auto or Minimal. Full ignores it.

Spec: Q8 and its ruling; Implementation → Help settings, Window.

Recommended model rationale: one field, one row and one style hook, after the decision is made.

## Acceptance criteria

- [ ] Codec tests: round trip and default.
- [ ] Component tests: the treatment renders in minimal under both styles that reach it and not under Full.
- [ ] The four gates are green.
