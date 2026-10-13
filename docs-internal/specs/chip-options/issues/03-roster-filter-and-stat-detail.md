# 03: Roster Filter And Stat Detail

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: renderer options on an existing function with exhaustive output tests as prior art.

Parent: [Chip Options spec](../spec.md)

## What to build

The entity roster renderer and the persona renderer honor the new pieces.

- **Only With**: before rendering, drop every entity that owns none of the picked kinds in force. An entity owns stats in force when the scene's owned-stats entry for it is non-empty, and traits when its owned-traits entry is non-empty. Stats and Traits picked together keep an entity that owns either. The filter ignores the Include toggles. In Scene names with no entity record are dropped. The filter applies under Name content too (Q26). On Persona the roster is the played entity; a miss renders what an unset persona renders (Q25).
- **Include**: owned traits render unless the traits piece is off. Owned stats render when the scope's stats piece is on: by default for Here and In Scene, only with the stats-on id for Sub-Locations and Reachable (Q24).
- **Stat Detail**: an owned stat line carries Range, Descriptor and Description only when its piece is on. The Stats chip's own renderer is the pattern to reuse, not copy.
- Name content ignores Include and Stat Detail, as it ignores stats today.

Rulings: Q3, Q4, Q13, Q24, Q25, Q26.

## Acceptance criteria

- [ ] Only With Stats keeps only entities with a stat in force; Only With Traits only those with a trait in force; both keep either.
- [ ] Only With under Name content lists only the entities that pass, and drops In Scene names with no record.
- [ ] A Persona chip with Only With Stats and a stat-less persona renders N/A bare, and nothing with a header.
- [ ] Traits off removes the traits line in full and summary content, every format.
- [ ] Each Stat Detail combination renders the matching pieces, every format.
- [ ] Owned stats render in Sub-Locations and Reachable only with the stats-on id.
- [ ] A bare token renders exactly what it rendered before this ticket.
