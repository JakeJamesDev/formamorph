# 09: Docs and changelog

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Rationale: writing against a built feature; voice rules apply, no logic.

Parent: [Editor Undo, Redo and History spec](../spec.md)

## What to build

The wiki and the changelog describe undo, redo and History in the player-facing voice.

- A wiki section under the World Editor page: the chords, the pill, the History list, what merges into one Step, the Saved marker, what is not undoable (editor preferences, library editors), and that the stack clears on close. Route lines for Take Me There where the page names a control.
- Glossary and `CONTEXT.md` gain Step and the History popover under the editor's terms.
- Changelog fragment in the 🚧 In Progress Added bucket, with a lead that states subject, surface and outcome on its own.
- Help lines on the pill and popover follow the Writing Guide.

## Acceptance criteria

- [ ] Wiki section exists, follows the Writing Guide, and the surface map anchors resolve.
- [ ] Glossary and `CONTEXT.md` entries added.
- [ ] Changelog fragment written in the fragment format; the lead passes the lead guard.
- [ ] `copy-sweep` run over the new strings.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.
