# 03: Child Pull with the Movement Rule

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a small rule change in the scene pull, but it moves authored characters, so each Movement case needs a guard that bites.

## What to build

A character the story brings into the scene joins it, whether she stood in a sibling place or a direct child of the player's place. Her Movement decides whether she may come (Q2, Q3).

- The pull takes a character named in prose who stands in a **direct child** of the player's place, as well as a sibling, as today. Deeper places are not pulled.
- Full-name hits only, as today: a name, a full alias, or (after ticket 02) a full Stranger Name. A name inside dialogue never pulls.
- One Movement rule for siblings and children:
  - **Stays Put:** never pulled.
  - **Moves Between Its Locations:** pulled only when the player's place is one of her locations.
  - **Free** and **Can Follow the Player:** always pulled.
- The pulled character is recorded through the discovered-entity path, as today, so the move persists, rolls back with its turn and survives reload.

This ticket owns the pull's selection rule. Ticket 04 changes only which place the pull is judged at, not the rule.

## Acceptance criteria

- [ ] A test shows a character named in prose in a direct child place is pulled into the player's place, and fails when the child case is removed.
- [ ] A test shows a character two levels down is not pulled.
- [ ] Tests show each Movement case for both a sibling and a child: Stays Put never, Moves Between only into one of her own locations, Free and Follow always. Each test fails when its case is reverted.
- [ ] A test shows a name inside quoted speech pulls no one.
- [ ] No save-shape change, or the landing names the change and carries the export-shape reminder.
- [ ] The Locations docs describe the pull: who joins the scene, from where, and how Movement limits it.
- [ ] A changelog fragment states the outcome for players and authors.
