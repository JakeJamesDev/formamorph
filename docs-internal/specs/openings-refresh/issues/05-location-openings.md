# 05: Location Openings

Status: done
Base: 826df3ed
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [Openings Refresh](../spec.md) (stories 23–30, 37, 38, 46; Q4, Q12, Q13, Q14)

## What to build

An author writes openings on a location. They draw when the game starts at that exact location.

- A location gains `openings` and `openingWeights`, with the same semantics as the world's and an entity's. Location openings get no Others | Self switch.
- The location editor gets an **Openings** tab as its last tab, in the same editor mode as the entity Openings tab.
- The location pool adds the start location's own openings (exact id; a parent's openings never reach a child). Self rows still replace everything. The world switch turns location openings off too.
- Location owners get their own owner-key kind, so an entity and a location with the same id never collide in weights or the no-repeat list.
- The world Openings panel shows a group per location with openings, with a link to its editor, in the order World, Locations, Entities. A location that isn't a starting location gets the No Starting Location badge. Search covers location groups.

⚠️ Export-shape change: locations gain `openings` and `openingWeights`.

## Acceptance criteria

- [ ] The new-game draw suite covers: location rows join at the exact start; a child start doesn't draw a parent's rows; Self excludes location rows; switch off excludes them; entity and location owners with one id don't collide.
- [ ] The location manager suite covers the tab's position and editing.
- [ ] The World Details suite covers group order, the location link, the badge and search.
- [ ] Four gates green; changelog In Progress entry; export-shape reminder in the handover.
