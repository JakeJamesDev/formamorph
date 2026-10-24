# 06: Avatars Move In

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Moves an existing section's controls into the tab and adds Replace with a hash recompute. The store helpers already exist; the care is in keeping every entity's pick and the legacy fallback intact.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

The world's Avatar store moves from the Overview into the Media tab (Q5, Q25), in both modes (Q26).

- **The Avatars section summary** holds **Upload Avatar…** and **Copy From Library**, with the same behavior they have in the Overview today.
- **An Avatar's panel** shows the preview, size, an editable name (rename on blur, as today), **Used By** (built in ticket 01; reuse it), and the action row from ticket 04: **Replace**, **Download**, and **Delete** in place of Remove.
- **Replace** swaps the file, recomputes its hash, and keeps the Avatar's id, so every entity keeps its pick.
- **Delete** keeps today's confirm, which names the entities that use the Avatar; they fall back to None, and a spent legacy fallback clears, as today.
- Each action is one history step with today's labels.

Keep the Avatar item id form `world:world:avatar:<id>`: ticket 05's image panel links to it (Q43).

The Overview loses its Avatar section. The entity Avatar dropdown stays on the entity panel.

Update the Overview and Avatars wiki pages. Changelog fragment: fold into the entity-avatars entry if it is still unreleased, otherwise into ticket 01's line.

## Acceptance criteria

- [ ] The Overview has no Avatar section in either mode
- [ ] Upload and Copy From Library add an Avatar card from the Avatars section, in Simple and Advanced
- [ ] Rename from the panel shows in the entity Avatar dropdown
- [ ] Replace keeps the Avatar's id; every entity that picked it still does
- [ ] Delete names the users, sets them to None, and clears a legacy fallback that pointed at it
- [ ] Used By lists each entity that picks the Avatar and opens its card
- [ ] Each action undoes in one step
