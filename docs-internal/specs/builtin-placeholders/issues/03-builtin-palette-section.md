# 03: Built-in Section in the Palette and Typeahead

Status: ready-for-human
Base: 1794c589
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

- [x] Palette returns Built-in rows first under a Built-in heading, drawn once
- [x] A Built-in chip renders with a distinct accent or icon and opens no World/Unique pop-out
- [x] Each Built-in chip's hint comes from the registry
- [x] Character Name appears in an entity's fields, in the World Editor and in the library entity editor, and not in world, location or dictionary fields
- [x] Prompt fields show no Built-in rows
- [x] The typeahead row filter matches `Player`, `user`, `Character` and `char`
- [x] Preview shows the label for both Built-ins
- [x] The Placeholders tab tree lists no Built-in row
- [x] Vocabulary tests cover the section, the visibility rule and the filter terms, mutation-proven
- [x] Verified in the preview at a realistic viewport, both themes, with static evidence
- [x] Copy follows the help-copy pattern; changelog In-Progress entry appended (🛠️)
- [x] Four gates green; `graphify update .` run

## Comments

**2026-09-25, implementation (b8291aba, review folded in):**

- The palette strip had no Built-ins before, so it now always shows Player Name. The strip serves a whole panel, so the claimed field says what it takes: a refused chip dims in place, and the field's own insert refuses it too.
- The Built-in mark is a leading `Sparkles` icon, approved in chat, and recorded in `docs/Design-System.md`.
- The library entity editor's store names its entity (`owner`), so its fields offer Character Name with no world lists.
- Entity openings now pass the entity as owner. Side effect: a placeholder made inline from an entity opening joins the entity's list, like its other fields. It is noted in the changelog.
- The changelog entry went in 👤 under a **Built-in Placeholders** group with ticket 02's entry, not 🛠️: the change is user-facing.
- Open: World Details → Openings lists every entity's openings under one strip with no entity scope. Those fields offer Character Name in their `{` menu, but the strip above them does not.
