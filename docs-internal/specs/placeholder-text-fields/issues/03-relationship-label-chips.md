# 03: Relationship Label Chips

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

The editor half is simple. The scope rule is the trap: relationship rows move onto the persona's block, and a wrong scope fails silently because Chip Values re-resolves globally. Opus for that.

## Parent

`docs-internal/specs/placeholder-text-fields/spec.md`

## What to build

Each Relationship label box on an entity becomes a single-line chip field that offers the entity's own placeholders.

- **Scope.** A label resolves in the scope of the entity that holds the row, before the relationship cast moves rows onto the persona or the target (spec Q6b). Relationship lines then print resolved labels.
- A label that resolves to blank prints no line, as a blank label does today.
- **Lists.** Add relationship labels to the entity text list, the entity chip mapper and the entity text resolver, after the pronoun entries ticket 02 adds. Card export carries no relationships, so labels add nothing there.
- World search gets relationship labels as a new chip-capable target.

Ship with it: the supported-fields list in the World Editor Placeholders help page names relationship labels. A changelog fragment.

- [ ] A chip lands in a label by typeahead, palette and drag, and the menu offers the holding entity's owned placeholders.
- [ ] A label chip owned by a played entity resolves in that entity's scope when its line prints on the persona's block.
- [ ] A label that resolves to blank prints no relationship line.
- [ ] Adopting or linking an entity remaps the chips in its labels.
- [ ] World search finds and replaces inside labels without breaking a chip.
- [ ] Removing labels from the entity text list, chip mapper or resolver fails a test.
- [ ] The help page lists relationship labels.

## Comments
