# 06: Landing in Game Screen Dialogs

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Spec: [spec.md](../spec.md), rulings Q4, Q5.

## What to build

Dialogs and tabs hosted by the game screen land targets with the shared hook: the game panels and tabs, the entity and memory dialogs, Image Generation, Persona, Export and AI Context. Every how-to section on How to Play, Memory, Image Generation, Prompts, Entities, Tools and Linked Content that ends at a control gets its target and registry entry.

## Acceptance criteria

- [ ] Each listed host lands a target: scroll, focus, pulse once; a missing target lands silently
- [ ] Every how-to section on the listed pages that ends at a control present when its surface opens carries a target (Q11). The report lists only sections that end at a menu item, a turn's action row, or a dialog the request cannot open, and the notes below name them
- [ ] Docs checks and existing surface tests stay green

## Bare routes

Sections on the listed pages that keep a route with no fragment (Q10, Q11):

- Turn action row or its menu: Re-generate a Turn, Edit Your Action, Rewind to an Earlier Turn, Make an Image of One Turn
- A dialog the request cannot open: Edit Narration, Read a Turn Aloud, Report an Error, Add an Image Preset, Make a Tool, Try a Tool, and every Memory, Prompts, Entities and Linked Content section that ends in a dialog or a list item
- A control on another tab than its route names: Turn On Tools (ends on the Tools tab)
- A tab, a list item or an action in the preset header: Edit a Prompt (ends on the Preview tab), Publish a Prompt Preset (Publish is an icon in the preset header, a menu item when narrow), Change Location, See What the AI Read
