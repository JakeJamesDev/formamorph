# 02: Add On Map

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

Authors choose how the map shows each entity with the new **On Map** field: Always, Once Met, When Nearby, or Never.

- Optional entity field. An absent field means Always. No migration. **This changes the export shape** of world files and entity card files.
- The field survives world import and export, entity card import and export, and the library carry. The world validator accepts the four values.
- The map roster from ticket 01 obeys the field, with the rule order the spec states:
  - Never → nothing, met or not.
  - When Nearby → nothing outside the player's place and Nearby places, met or not.
  - Once Met → nothing while unmet. On an entity that starts met it acts as Always.
- A four-value control in the entity editor, below Placement in Routines, on every entity. Each value has help text written from the Writing Guide. Once Met's text says it applies only to strangers. No warning for an entity that starts met.
- Help topics and `docs/` pages for the entity editor follow.
- Changelog fragment. Fold it into ticket 01's entry if that one has not been released.

Spec rulings: Q7, Q9, Q10, Q11, Q13, Q15.

## Acceptance criteria

- [x] An entity with no On Map field behaves as Always in the roster. A roster test. (`mapRoster.test.ts` "reads an absent field as Always")
- [x] Never removes a met entity and an unmet entity from every place. A roster test. ("Never removes a met entity and an unmet one")
- [x] When Nearby removes the entity from a Far place and keeps it in Nearby places, both met and unmet. A roster test. ("When Nearby keeps the entity in the player’s place…", plus a no-place case)
- [x] Once Met removes an unmet stranger everywhere and shows it by true name once met. On an entity with no stranger fields it shows as Always. A roster test. (two Once Met tests)
- [x] The field round-trips through world export and import, and through entity card export and import. A test per path. (`onMap.test.ts` world file; `entityFile.test.ts` card, bytes included)
- [x] The validator accepts each of the four values and rejects an unknown value. A test. Per Q19 there is no validator: an unknown value falls back to Always. (`onMap.test.ts`, `mapRoster.test.ts`, `entityFile.test.ts`)
- [x] The editor control sits below Placement in Routines, shows Always for an entity with no field, and writes the field on change. An entity editor test. (`RoutineTab.test.tsx` "On Map")
- [x] Each roster guard fails when its rule is reverted (test-bar). The landing names the reverts tried. (see Landed)
- [x] Frames of the control: `.scratch/frames/on-map-control-light.png` and `.scratch/frames/on-map-control-dark.png`, desktop width.

For you: the On Map control's placement and help text in the entity editor.

## Landed

Reverts tried on `mapRoster.ts` and `onMap.ts`, each reverted and checked by grep:
- Dropped the `never` clause: "Never removes a met entity and an unmet one" failed.
- Dropped the `onceMet && !known` clause: "Once Met removes an unmet stranger everywhere" failed.
- Dropped the `whenNearby` reach line: "When Nearby keeps the entity…" failed.
- Made `onMapOf` default to Never: the Always cases failed across `mapRoster.test.ts`.

Frames: `.scratch/map-strangers-02/frames/on-map-control-light.png`, `.scratch/map-strangers-02/frames/on-map-control-dark.png` (the Warden in the `entityPresence` fixture, 1280 wide).

**Not verified**
- Library carry: no dedicated test. The library stores the whole entity record and the card path is tested. I did not trace the library store.
- Help window topic: no new Formaquestion topic. The entity editor docs page and `docs/WorldFormat.md` carry the field.
- The Once Met line needs a Stranger Name to matter. The control shows no warning for an entity that starts met (Q15).

**For you**
- On Map control placement and the four help lines, in the World Editor, Entities, Presence tab, under Placement.
- Bundled-world sweep (Q16) is a later step.
