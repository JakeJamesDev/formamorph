# 01: Rename the Generic Body to Generic Entity Instance

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Starts after: NPC Schedules tickets 29, 30 and 31 land (Q4).

## What to build

One standing body of a Generic entity is called a "presence" in code, comments and specs. The glossary now uses Presence for every place an entity can be, and Generic Entity Instance for the body (Q15). Rename the body everywhere so the word has one meaning before the Entity Places module is written.

- Rename types, functions, variables, comments and TSDoc that use "presence" for the body of a Generic entity. In code the form is `genericEntityInstance`.
- Leave every use of "presence" that means "who can be at a place" or the Presence tab. Read each hit; this is not a blind replace.
- Do not rename any key that is written to a save file or a world file. The save shape and the world shape do not change. If a type name and a stored key share a word, rename the type and keep the key.
- Internal docs and human docs that name the body follow. Closed specs keep their text.
- User-facing copy does not change.

Spec rulings: Q15, Q12.

## Acceptance criteria

- [ ] No type, function, variable or comment in the app source uses "presence" for one standing body of a Generic entity. The landing lists the renamed identifiers.
- [ ] Every remaining "presence" in the app source means the places an entity can be, the Presence tab, or the turn's "who is here" computation. The landing lists the kept uses by area.
- [ ] A save written before the change loads with every Generic Entity Instance at its place. A test loads a stored save fixture and compares the position book.
- [ ] The stored keys of the save envelope and the world file are byte-equal before and after for one fixture. A test asserts it.
- [ ] No user-facing string changes. The landing states the check used.
