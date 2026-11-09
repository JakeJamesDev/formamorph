# 01: Connection Distance

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Owns the Nearby reach helper that tickets 08, 10 and 11 read.

## What to build

An author selects a Connection on the canvas and sets it to Nearby or Far in its inspector. A new or migrated Connection is Nearby. To make an implicit link Far, the author clicks its arrow, which already creates a two-way Connection, then sets Far. Deleting the Connection restores the implicit Nearby link. A Far link still allows travel in every way it does today.

The narrator's nearby list changes with it: the Entities chip's nearby section lists entities in places one Nearby link from the player's place, implicit or Connection, in either direction. Places across a Far link are left out. The Nearby Through Connections checkbox and its field are removed, because Nearby reach already counts Connections.

Only Far is stored on a Connection; absent means Nearby. The value belongs to the pair, both legs.

Spec rulings: Q37–Q39, Q48, Q49, Q61, Q82. Stories 30–34, 58. The spec's "World shape: connections" and "Reach" sections hold the rules.

**Export shape:** the world file gains a Connection distance and loses a location's Nearby Through Connections field. Say so in the landing.

## Acceptance criteria

- [ ] A Connection stores Far and nothing for Nearby. Loading a world with the removed location field drops it, and loading twice changes nothing more.
- [ ] One Nearby reach helper returns the places one Nearby link from a place: implicit pairs, Connections in either direction, never chained, never across Far. Tests cover each case, and a Far Connection that replaces an implicit pair.
- [ ] Travel is unchanged by distance: the existing travel and destination tests pass untouched, and a new test moves the player across a Far link.
- [ ] The canvas inspector shows the Nearby / Far choice for the selected Connection, and the change is one undo step.
- [ ] A Far link draws differently from a Nearby one on the canvas and on the player's Map.
- [ ] The Entities chip's nearby section lists an entity one Nearby link away and omits one across a Far link. The guard is proven by reinstating the old rule.
- [ ] The Nearby Through Connections checkbox is gone from the location editor, with its copy and its help text.
- [ ] A new ADR extends ADR 0002 with distance. `CONTEXT.md` defines Nearby and Far. The world format doc and the locations wiki page describe the field.
- [ ] Copy for the choice is written under the Writing Guide.
- [ ] Frames: `.scratch/frames/far-link-canvas.png` and `.scratch/frames/far-link-map.png`, light and dark, at 1440 px wide.

For you: the Far link's look on the canvas and the Map. It is a new visual pattern and needs your approval before this lands. The prototype drew a dotted line with "· Far" on the label.
