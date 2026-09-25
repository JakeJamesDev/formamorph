# 03: Built-in Section in the Palette and Typeahead

Status: ready-for-agent
Blocked by: 02 — Character Name Resolves Live
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Built-in Placeholders](../spec.md)

**What to build:** The palette strip and the `{` typeahead show a **Built-in** section first, under a heading, before the loose author placeholders. Built-in chips look different from author placeholders: a distinct accent or icon, the same chip shape. They have no World/Unique pop-out. Their hint says what the chip becomes: for Player Name, the persona's name, or "you"/"the player" with none; for Character Name, the owning entity's name.

Visibility: Player Name shows where it shows today and stays hidden in prompt fields. Character Name shows only when the field's owner is an entity. A dictionary book is also an owner and never shows Character Name. The vocabulary reads the owner's kind from the placeholder owners list.

Typeahead: a chip row can carry extra search terms, and the row filter matches the query against the label and those terms. Player Name lists `user`; Character Name lists `char`. So `{player`, `{user`, `{character` and `{char` all find their chip.

Preview: the Preview tab shows the label for both Built-ins, as it does for Player Name today.

Built-ins stay out of the Placeholders tab tree.

Workload: contained UI and vocabulary work on existing components, with the rules already fixed by the spec.

- [ ] Palette returns Built-in rows first under a Built-in heading, drawn once
- [ ] A Built-in chip renders with a distinct accent or icon and opens no World/Unique pop-out
- [ ] Each Built-in chip's hint comes from the registry
- [ ] Character Name appears in an entity's fields, in the World Editor and in the library entity editor, and not in world, location or dictionary fields
- [ ] Prompt fields show no Built-in rows
- [ ] The typeahead row filter matches `Player`, `user`, `Character` and `char`
- [ ] Preview shows the label for both Built-ins
- [ ] The Placeholders tab tree lists no Built-in row
- [ ] Vocabulary tests cover the section, the visibility rule and the filter terms, mutation-proven
- [ ] Verified in the preview at a realistic viewport, both themes, with static evidence
- [ ] Copy follows the help-copy pattern; changelog In-Progress entry appended (🛠️)
- [ ] Four gates green; `graphify update .` run
