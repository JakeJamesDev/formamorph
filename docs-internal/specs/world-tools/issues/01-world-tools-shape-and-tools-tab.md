# 01: World Tools Shape And Tools Tab

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a world export-shape change, a new offer rule against ADR-0008, and a new editor tab.

## What to build

A world can hold Tools (`World.tools`), which export and import with the world. During play, the offer list adds the world's Tools after catalog and user Tools. A World Tool replaces any Tool of the same name in that world (Q7). World Tools follow the global Tools switch and the endpoint capability gate, but not preset switches (Q6). The World Editor gets an advanced-only **Tools** tab in the Logic group beside **Scripts** (R5, Q10). It lists the world's Tools with drag to reorder, edits each one in the existing Tool editor, and warns on a name clash. Handlers behave as today: Lookup, Template and Script are read-only. A new ADR supersedes ADR-0008's "A world author cannot ship a Tool", and the glossary updates **Tool** and adds **World Tool**.

Spec: R5, Q5, Q6, Q7, Q10, Q17; stories 1–5, 27–29, 33–35, 40.

## Acceptance criteria

- [ ] `World.tools` round-trips through export and import; a world without it loads unchanged
- [ ] A World Tool reaches the request with the preset's switch off and the global switch on; the global switch off removes it
- [ ] A World Tool named like a catalog Tool replaces it in that world only; another world still gets the catalog Tool
- [ ] The Tools tab shows in the advanced editor only, has a dev-route entry, reorders by drag, and warns on a name clash
- [ ] The game's Tool-call indicator names a World Tool when the AI calls it
- [ ] ADR and CONTEXT.md entries written; changelog fragment written
- [ ] Four gates green

## Blocked by

- None (can start immediately)
