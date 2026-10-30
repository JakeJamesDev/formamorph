# 05: Map and Help Window Read Met

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The map shows every **Met** entity where it stands, and an unpositioned entity at each place it lists. Strangers never show. The Help window's Player View holds Met entities plus the aliases of strangers the player has seen, and no unmet discovered character. ADR-0014's Player View definition and the glossary entry are updated to match.

## Acceptance criteria

- [ ] The map shows Met entities at their positions, and unpositioned Met entities at each listed place.
- [ ] The map never shows a stranger.
- [ ] The Player View lists Met entities and seen aliases only. An unmet entity's true name is absent.
- [ ] ADR-0014 and the Player View glossary entry describe the new rule.
