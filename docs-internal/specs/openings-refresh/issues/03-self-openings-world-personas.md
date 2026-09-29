# 03: Self Openings for World Personas

Status: done
Base: 0601e20b
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [Openings Refresh](../spec.md) (stories 1–14, 21, 22, 39, 57, 58; Q2, Q3, Q8, Q9, Q11, Q16, Q19, Q23)

## What to build

An author marks an opening as **Self** on a world entity with the Persona mark. A player who plays that entity starts on one of its Self openings.

- An **Opening** gains an optional Self flag; absent means Others. No migration.
- An **Others | Self** switch sits beside Player Action | Narration, on expanded and collapsed cards. It shows only on world entities with the Persona mark. Flipping it changes only that field.
- An entity without the Persona mark keeps its Self rows in the file, but the editor hides them and they never draw.
- The pool rule gains its Self step for world personas: the played persona's drawable Self rows replace the pool. A persona with none falls through to today's pool. The played persona's Others rows still never draw. The world Openings switch turns Self rows off too. The page-one redraw reads the same pool.
- A persona-only entity's Self rows draw when it is picked; its Others rows never draw. Amend trait-links Q80 and its story in that spec to say so.
- Self rows show in the owner's group in the world panel with a Self badge.
- Add **Self Opening** and **Others Opening** to the Opening entry in the domain glossary.

⚠️ Export-shape change: the Self flag reaches world exports, entity cards and listings.

## Acceptance criteria

- [ ] The new-game draw suite covers: Self replaces the pool; no Self falls through; the played persona's Others excluded; persona-only Self draws and Others don't; an unmarked entity's Self never draws; switch off gives the default.
- [ ] Letting Self rows join the location pool fails a test (guard proven by reinstating the bug).
- [ ] The entity editor suite covers the switch's visibility and a flip keeping text, kind and weight.
- [ ] The card importer suite pins SillyTavern greetings as Narration openings with no Self flag.
- [ ] A world with openings and no Self flag draws exactly as before.
- [ ] Trait-links spec Q80 amended; glossary updated.
- [ ] Four gates green; changelog In Progress entry; export-shape reminder in the handover.
