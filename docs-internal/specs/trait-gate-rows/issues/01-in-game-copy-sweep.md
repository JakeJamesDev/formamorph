# 01: In Game copy sweep

Status: ready-for-agent
Blocked by: none
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Rationale: a mechanical copy pass across labels, hints, docs and glossary entries; no logic.

Parent: [Trait Gate Rows spec](../spec.md)

## What to build

One term for "after the game has started": **In Game** (Q24). Today the app says In Play, In-Game, In Game and during play for the same moment. Sweep every user-facing string and the wiki so the label form is **In Game**, the adjective form is **in-game** (hyphen only before a noun: "in-game date"), and prose uses "in game" or "during the game". The Authoring Tour pane and the Entities wiki page are renamed too: "In Game" pane, "Entities in Game".

Independent of the other tickets. The editor's new rows take their labels from the spec.

## Acceptance criteria

- [ ] Trait panel: **Player Can Toggle In Game** and its hint read with the new term (the hint says "during the game", not "during play").
- [ ] Authoring Tour pane title and its tour step copy read **In Game**. Its dev route and `aria` ids may keep their names.
- [ ] Wiki: the Entities page title reads "Entities in Game"; the Personas headings "How to Change Persona During Play" and "Change It in Game" agree on the term; every "in play", "during play" and "in-game" in prose follows the hyphen rule. The surface map anchors follow any heading change, and the surface tests pass.
- [ ] Glossary and `CONTEXT.md`: the **In Play** term becomes **In Game**, with "In Play", "in-play" and "during play" under Avoid.
- [ ] Settings copy, the AI setup gate and the reveal demo use the term where they name the moment.
- [ ] Released changelog entries keep their text. Code identifiers are not renamed.
- [ ] The ticket's comments list every file changed, grouped by surface.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
