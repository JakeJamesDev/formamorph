# 17: Help preset file

Status: done
Blocked by: 11, 15
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A power user moves a custom assistant between devices with one file (Q11, Q39).

**The file.** A new export shape, version 1:

- a version field and the app version
- the preset name
- the three prompt texts
- the answer options: temperature, repetition penalty and Max Output (Q58)
- the player's Formaquestion Tools
- the function and Tool switches, and the fixed functions' Max Calls per Request (Q59)

It carries no endpoint, no token and no other device setting. Build the file from an explicit field list, so a later setting cannot ride along.

**Export.** An action on a custom preset on the Prompts tab. The Default preset has no export.

**Import.** An action beside the preset select.

- The preset joins the list under its name, with a suffix on a name conflict, and becomes active.
- The Tools join the Formaquestion list under the Tool import plan: a Tool whose name the list already holds is skipped and named in the message (Q60). The switch of a skipped Tool is not applied; the stored Tool keeps its own.
- The switches apply to the device settings, for the Tools of the file and the fixed functions only.
- A file with an unknown version, a missing field or a wrong type is refused with a message. Nothing is applied in part.
- A chip that this build does not know reads as plain text.

There is no community sharing.

The Prompts docs section gains the two actions. The response that hands this ticket over reminds the user of the new export shape.

Recommended model rationale: a new export shape with a version, and an import that must apply in full or not at all.

## Acceptance criteria

- [ ] Export then import on a clean profile gives the same three texts, the same answer options, the same Tools and the same switches.
- [ ] The file holds no endpoint, token or other setting (a test reads the exported keys against the field list).
- [ ] A name conflict on the preset gets a suffix; a name conflict on a Tool skips that Tool and names it. Nothing already stored changes.
- [ ] A file of an unknown version or a broken shape is refused, and no preset, Tool or switch changes.
- [ ] The Default preset has no export action.
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
