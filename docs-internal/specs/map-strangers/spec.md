# Spec: Map Strangers

Status: ready-for-agent
Spec session: map-strangers — spec

## Problem Statement

The player's map shows a count badge on each location, and its tooltip names the entities there. The badge lists only the entities whose names the player knows. An unmet stranger with a Stranger Name does not appear at all, so a place full of strangers looks empty. The map gives the player no reason to go somewhere new.

Authors also have no control over what the map shows. The only way to keep an entity off the map is a side effect of the stranger fields.

## Solution

The map shows every unmet entity, and the reach of what the player has heard decides how much it shows:

- In the player's place and every Nearby place, an unmet stranger appears under its stranger label: the latest alias the story gave it, else its Stranger Name.
- In every other place, an unmet stranger appears as an unknown "?" entry.
- An unmet entity with no label appears as "?" everywhere, even nearby.

The badge splits in two: named entries (true names plus stranger labels) and unknown entries. The tooltip lists the names, then the stranger labels, then the unknowns.

A new entity field, **On Map**, lets authors choose how each entity shows: Always, Once Met, When Nearby, or Never.

## User Stories

1. As a player, I want the map to count strangers at each place, so that I know a place has people I have not met.
2. As a player, I want strangers in nearby places to show under the name I have heard, so that the map matches what the story has told me.
3. As a player, I want strangers in far places to show as unknowns, so that I have a reason to go and look.
4. As a player, I want strangers in my own place to show under their stranger label, so that the map matches the scene.
5. As a player, I want a stranger I have never heard named to show as an unknown, so that the map never shows a name I could not know.
6. As a player, I want the badge to show named and unknown entries apart, so that I can see the mystery without a hover.
7. As a player, I want the badge to look as it does today when a place has no unknowns, so that the common case stays simple.
8. As a player, I want a place with only unknowns to show only the unknown part, so that the badge never shows a zero.
9. As a player, I want the tooltip to list names, then stranger labels, then unknowns, so that I can read it in order of what I know.
10. As a player, I want stranger labels to look like real names, so that the map does not tell me which names are only what I have heard.
11. As a player, I want a stranger's true name to never appear on the map before I meet it, so that the reveal stays the story's.
12. As a player, I want a met entity to show under its true name, so that the map reflects what I learned.
13. As a player, I want to see strangers move between places on the map, so that I can follow a routine I am curious about.
14. As a player, I want the labels to change as I move, so that the map always reflects what I can hear from where I stand.
15. As a world author, I want an On Map setting on every entity, so that I control how the map shows it.
16. As a world author, I want Always as the default, so that my existing worlds show every entity without any edits.
17. As a world author, I want Once Met to keep an entity off the map until the player meets it, so that I can keep a surprise.
18. As a world author, I want When Nearby to show an entity only in the player's place and Nearby places, met or not, so that the player cannot track a wanderer from afar.
19. As a world author, I want Never to keep an entity off the map always, met or not, so that secret or system entities stay hidden.
20. As a world author, I want On Map below Placement in Routines, so that it sits with the other settings about where an entity is.
21. As a world author, I want Once Met on an entity that starts met to act as Always, so that the setting is harmless when it does not apply.
22. As a world author, I want help text for each On Map value, so that I know what the player will see.
23. As a world author, I want On Map to work for Generic entities at every place an instance stands, so that crowds follow the same rule.
24. As a player of a bundled world, I want its authors' On Map choices to fit the world, so that bundled worlds use the feature well.
25. As a Help window user, I want the Help window to keep listing only what I know, so that the map change does not leak into Help answers.

## Implementation Decisions

Rulings from the grill of 2026-11-12.

- **Q1.** The reach that shows stranger labels is the player's place plus the glossary's Nearby places: implicit links plus Connections with no distance, one link, never chained. Far Connections are outside it. The map uses the existing Nearby helper, not the presence `connectedPlaces` helper, which does not exclude Far.
- **Q2.** An unmet entity outside that reach is counted and shows as an unknown entry.
- **Q3.** An unmet entity with no label (a blank Stranger Name and no alias) shows as an unknown everywhere, Nearby included. This amends the glossary's Stranger entry: such an entity has no label and no player surface shows it, **except the map**, where it is an unknown.
- **Q4.** The Help window (Formaquestion's player view) does not change.
- **Q5.** The badge splits into named and unknown parts.
- **Q6.** Stranger labels look the same as true names, in the badge tooltip and everywhere else.
- **Q7.** New optional entity field **On Map**. **This changes the export shape** of world files and entity card files. An absent field means Always. No migration runs, and no entity is hidden on the map after load.
- **Q8.** The map shows an unmet entity at its current Position, so a player can follow its routine. No extra rule applies.
- **Q9.** The field's label is "On Map". Its values are Always / Once Met / When Nearby / Never. Glossary term: **On Map**.
- **Q10.** Never keeps the entity off the map whether it is met or not.
- **Q11.** When Nearby shows the entity only in the player's place and Nearby places, whether it is met or not. Met changes the label, not the reach.
- **Q12.** The named part counts true names and stranger labels. The unknown part counts only unknown entries. The tooltip orders the entries as names, then stranger labels, then unknowns.
- **Q13.** The editor control sits below Placement in Routines, on every entity.
- **Q14.** A zero part of the badge is dropped: "3" with no unknowns, the unknown part alone with no named entries.
- **Q15.** Once Met on an entity that starts met acts as Always. The editor shows no warning. The value's help text says it applies only to strangers.
- **Q16.** Bundled-world sweep: the agent proposes an On Map value for each bundled entity that should differ from Always, one table per world. The user approves before any world changes.
- **Q17.** Duplicate named entries at one place are numbered the way the scene roster numbers them ("a gate guard", "a gate guard (2)"). Each still counts once in the named part. Spec-session ruling of 2026-11-12, on an intent question of ticket 01.
- **Q18.** With no current place, the reach is empty: every unmet entity is an unknown, and met entities show their true names. Spec-session ruling of 2026-11-12, on an intent question of ticket 01.
- **Q19.** No entity-field validator exists. One pure On Map reader returns the four known values and Always for anything else. Import and the roster both read through it, so an unknown value never hides an entity. Spec-session ruling of 2026-11-12, on an intent question of ticket 02.
- **Q20.** The entity card carries On Map alone, written only when it is not Always and read through the same reader. The card's other fields do not change, so Once Met on a received card acts as Always. Spec-session ruling of 2026-11-12, on an intent question of ticket 02.
- **Q21.** "Below Placement in Routines" means directly under the Placement control inside the Routines tab body, hidden for a custom persona. Spec-session ruling of 2026-11-12, on an intent question of ticket 02.

Module decisions:

- **Map roster.** One pure module replaces the met roster builder. Input: the presence of every cast entity, the player's place, the locations, and the Connections. Output: for each location id, the named entries in order (true names, then stranger labels) and an unknown count. It owns the On Map rule, the Nearby reach, and the unknown rule. Rule per entity at each place it stands:
  - Never → nothing.
  - When Nearby and the place is outside the reach → nothing.
  - Once Met and unmet → nothing.
  - Met, or unmet with no Stranger Name → its true name.
  - Unmet with a label, inside the reach → its stranger label.
  - Otherwise → one unknown.
- **Presence.** The roster needs every cast entity, not only the known set, so it reads the full presence record. Presence itself does not change.
- **Map badge.** The location map renders the split badge from the roster output. The tooltip copy for the unknown line comes from the Writing Guide.
- **Entity editor.** A four-value control for On Map, below Placement in Routines. Copy follows the Writing Guide.
- **World and card import.** The field passes through import, export, the library carry and the entity card unchanged. An unknown value reads as Always (Q19).

## Testing Decisions

- Good tests drive public behavior: give the roster a world and a presence, read the per-place output. They never assert on internals.
- **Seam 1: the map roster.** It covers every On Map value against met, unmet with a label, and unmet with no label. It covers the player's place, a Nearby place by implicit link, a Nearby place by Connection, and a Far Connection place. It covers a Generic entity standing at two places and the ordering of named entries. Prior art: the presence and met roster tests in `src/lib`.
- **Seam 2: the map badge render.** It covers the split badge, a dropped zero part, the tooltip order, and that a stranger's true name never renders. Prior art: the existing badge tests in the location map test file, including "never draws a stranger", which this effort rewrites to the new rule.
- **Seam 3: the entity editor.** It covers the On Map control's four values, the absent-field default, and that it writes the field. Prior art: the entity editor modal tab tests.
- Each guard must fail when its bug returns (test-bar skill).

## Out of Scope

- The Help window and Formaquestion's player view (Q4).
- The narrator's context, presence sets, In Scene, and the Met rule.
- The editor Locations Canvas, which is the author's view and shows every entity.
- A visual style for stranger labels (Q6).
- Any rule that freezes a moving stranger on the map (Q8).

## Further Notes

- ⚠️ Export shape: On Map is a new optional field on world and entity card files (Q7). A released build without it ignores the field and shows every entity.
- The glossary has **On Map**, and its **Stranger** and **Met** entries reflect Q3.
- The bundled-world sweep (Q16) runs after the field ships, through the bundled-worlds skill.
