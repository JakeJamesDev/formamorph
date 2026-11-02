# 05: Map and Help Window Read Met

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The map shows every **Met** entity where it stands, and an unpositioned entity at each place it lists. Strangers never show. The Help window's Player View holds Met entities plus the aliases of strangers the player has seen, and no unmet discovered character. ADR-0014's Player View definition and the glossary entry are updated to match.

## Acceptance criteria

- [x] The map shows Met entities at their positions, and unpositioned Met entities at each listed place. (`metEntities.test.ts`: positioned, two-mound entity, runtime character)
- [x] The map never shows a stranger. (`metEntities.test.ts`: hidden until named)
- [x] The Player View lists Met entities and seen aliases only. An unmet entity's true name is absent. (`playerView.test.ts`: start rule, relationship either side, unmet name absent, alias rows)
- [x] ADR-0014 and the Player View glossary entry describe the new rule. (edited)

## Landed

**Not verified**
- The map and Help window in the running app: no browser check, only the unit and `GameViewer.helpWorld` tests.

**For you**
- Bundled worlds carry no Stranger Names, so every cast member now shows on the map and in Help from turn one. Check Emberwatch's map at a fresh start.
- The world-question harness (`world-question-cases.ts`) now gives each cast member the save has not met a Stranger Name, to keep its leak keys meaningful.
- `usePresence` gives runtime characters no place of their own (no `locations`, no entry in `entityPositions`), so Look Around may miss them. The map works around it with `runtimePositions`. Ticket 02 owns the hook.
