# 19: Mark a Persona-Only Entity's Others Openings

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: extends the rule ticket 11 built to a second entity kind, whose rows draw once a player picks it.

## What to build

An unpicked Persona-Only entity's Others openings never draw, but the world panel shows a draw chance and no mark. Ruling Q15: they get what ticket 11 gave the Custom Persona. Each such row shows **Never Draws** and a dash, and leaves the view's pool, so it stops diluting other rows' chances. Check first how a pick changes this: if the entity is played, its Others rows may still never draw, and the mark must be true in every case it shows.

This ticket owns the "can this row draw" rule. Ticket 20 reads it.

Spec: Q15. Evidence: ticket 11, Landed.

## Acceptance criteria

- [ ] An Openings panel test with an Others row on a Persona-Only entity fails today (no mark), then passes
- [ ] The world openings view shows no chance for those rows and other rows' chances no longer count them (pure test)
- [ ] Rows on Playable and Cast entities are unchanged (test)
- [ ] World-Editor-Openings describes the mark; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤
