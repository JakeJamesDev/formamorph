# 01: Relationships Field and Lines

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The foundation: the world field, the editor and the rendered line. It touches types, the entity panel, the roster builders and entity deletion. Opus fits the cross-layer work.

## What to build

An author opens an entity's panel and adds Relationships rows: a target dropdown and a role-noun label. In play, when both ends render in the prompt, the AI reads one sentence: "Kate is Tera's mother". The sentence prints once per prompt. Deleting an entity removes every relationship that targets it.

## Acceptance criteria

- [ ] An optional entity field holds an ordered list of `{ targetId, label }`. Absent or empty is the stored form for no relationships. No migration.
- [ ] The editor lists one row per target. The dropdown hides the holder and targets already used. Rows can be added and removed. Undo covers each change.
- [ ] The help line asks for a role noun. Copy follows the Writing Guide; `copy:sweep` reports 0 notices.
- [ ] The line renders as a field in entity blocks: "<target> is <holder>'s <label>". It prints on the holder's block when the holder renders, else on the target's block. Name-only scopes show no line.
- [ ] A world without relationships renders byte-equal chip values to today.
- [ ] Deleting an entity drops the relationships that target it, in the same pass.
- [ ] Tests at the three seams in the spec: chip values, the editor (RTL), the deletion helper.
- [ ] The new editor surface has a dev route and passes the verify-ui skill, both themes. A new visual pattern needs the user's approval first.
- [ ] Response reminds the user of the export-shape change.
