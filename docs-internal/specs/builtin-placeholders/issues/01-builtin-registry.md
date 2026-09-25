# 01: Built-in Registry Replaces the User-Macro Special Cases

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

**Parent:** [Built-in Placeholders](../spec.md)

**What to build:** A pure Built-in registry module that lists every Built-in Placeholder as one row: id, label, canonical token, a pattern for every accepted spelling, extra typeahead search terms, accent, visibility rule, hint, and resolver. Player Name is the first row. The user-macro render rule becomes its resolver. Every place that checks for the user macro by hand now reads the registry instead: the placeholder chip pattern and its has-placeholders guard, the chip vocabulary (label, hint, color, known token, fixed, accept from palette, palette row), editor search, placement letters, stat-code names, the world prompt chip walk, and the Preview value map. Nothing changes for the author. Every current Player Name behavior stays the same.

This is the prefactor. It has a wide blast radius, so it lands alone with the codebase green.

Also check story 8 live: type `{{user}}` by hand in a chip field and see if it becomes a chip. Record the answer in the spec's Further Notes and drop the story if it does not.

Workload: about 28 call sites across a dozen modules, with a render rule that must keep every capital-letter and possessive case. A high-effort, high-capability model reduces regressions.

- [ ] A registry module exports the Built-in rows and one helper each for: matching a token, canonicalizing text, the label for a token, and rendering a text with a render context
- [ ] The user-macro module's exports either move into the registry or delegate to it, with no second copy of the render rule
- [ ] The chip pattern and the has-placeholders guard are built from the registry
- [ ] The chip vocabulary has no direct user-macro check left; it reads Built-in rows from the registry
- [ ] Editor search, placement letters, stat-code names, the world prompt chip walk, and the Preview value map read the label from the registry helper
- [ ] Every existing user-macro, vocabulary, resolve, search, placement-letter, stat-code and world-prompt test passes with no case removed
- [ ] The user-macro render tests move with the render rule and keep every case
- [ ] Story 8 checked live and the result recorded in the spec
- [ ] Four gates green; `graphify update .` run
