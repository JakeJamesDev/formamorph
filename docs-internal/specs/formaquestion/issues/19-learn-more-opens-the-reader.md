# 19: "Learn more" opens the reader

Status: done
Base: 36faa068
Blocked by: 16
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A player who clicks **Learn more →** in a **?** help topic stays in the app. The link opens Formaquestion at the linked docs section (Q26).

- The help topic closes or stays as the approved design says; the reader shows the section.
- It works offline, and in the desktop and Android builds.
- The Demo AI notice's link to the connect page opens the reader the same way.
- Links that must stay on the web, such as the full changelog link in the update dialog, are unchanged.
- A topic whose section is missing from the index shows no link. The coverage test from ticket 01 keeps that case from shipping.

Recommended model rationale: a small, well-bounded change on top of an existing component.

## Acceptance criteria

- [ ] Clicking Learn more in a help topic opens Formaquestion with the linked section in the reader
- [ ] The same works from a help topic inside a dialog
- [ ] No network request leaves the app for that click
- [ ] The Demo AI notice link opens the reader
- [ ] The help-topic tests cover the new target
- [ ] Changelog: folded into the Formaquestion In Progress entry
- [ ] Four gates green
