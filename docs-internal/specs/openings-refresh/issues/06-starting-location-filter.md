# 06: Starting Location Filter

Status: done
Base: 20fae434
Blocked by: 04; 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [Openings Refresh](../spec.md) (stories 31–36, 40–44; Q5, Q10, Q17, Q20)

## What to build

The world Openings panel's **Chances At** picker becomes a **Starting Location** filter:

- Options: **All Locations**, then each starting location by name. The default is All Locations. The control shows only with more than one starting location; with one, the panel behaves as if that start is picked.
- Under All Locations every group shows, and no row shows a chance except Self rows.
- Picking a start shows the World group, that location's group, the present entities' groups, and any group holding Self rows (only its Self rows when the owner is absent there). Chances show. The "Not at X" hint is gone.
- A Self row's chance is its share of its owner's drawable Self rows, under every filter value.
- The default opening card shows at a picked start only when that start's location pool is empty. Under All Locations it shows with the names of the starts whose pool is empty. No empty start means no card.

## Acceptance criteria

- [x] The World Details suite covers the default and options, chances hidden under All, filtering at a start, Self rows under every filter with their own chances, and every default-card case.
- [x] Verified in the live preview on a world with 2+ starts and entity, location and Self openings.
- [x] Four gates green; changelog In Progress entry.
