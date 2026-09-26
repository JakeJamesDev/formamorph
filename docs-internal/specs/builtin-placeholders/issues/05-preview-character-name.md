# 05: Preview Shows the Owner's Name for Character Name

Status: ready-for-agent
Blocked by: 03 — Built-in Section in the Palette and Typeahead
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Built-in Placeholders](../spec.md)

**What to build:** In an entity's fields, the Preview tab shows a Character Name chip as the entity's current name, not as the label "Character Name". The entity editor already knows the name, in the World Editor and in the library entity editor. The field takes the owner's authored name beside the owner id. The Preview value map resolves that name through the same preview draw as the rest of the text, so a name that holds a placeholder chip previews as its drawn value, and the draw agrees with the chips in the text. An empty name previews as the label, so the author still sees where the chip sits. Player Name keeps the label: the editor has no persona.

Demo: open an entity named "YoRHa 2B", place a Character Name chip in its player description, open Preview. The chip reads "YoRHa 2B". Rename the entity in the Profile tab and return: Preview reads the new name.

Workload: one prop through two entity editors and one branch in the Preview value map, with an existing preview test file to extend.

- [ ] The Preview value map takes an optional owner name and maps the Character Name token to it, resolved through the same draw as the text
- [ ] An empty or absent owner name previews as the label
- [ ] Both entity editors pass the owner's authored name to each entity field that offers Character Name
- [ ] A Character Name chip in a dictionary entry or world text still previews as the label
- [ ] Player Name still previews as the label
- [ ] Preview value tests cover the name, the chip-bearing name, and the empty name, mutation-proven
- [ ] Verified in the preview at a realistic viewport with static evidence
- [ ] Changelog In-Progress entry appended (🛠️)
- [ ] Four gates green; `graphify update .` run
