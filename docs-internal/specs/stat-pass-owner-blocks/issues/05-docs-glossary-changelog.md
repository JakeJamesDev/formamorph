# 05: Docs, Glossary And Changelog

Status: done
Blocked by: 02, 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: human-facing copy against the Writing Guide and the changelog lead rules, with the landed behavior as the source.

Parent: [Stat Pass Owner Blocks spec](../spec.md)

## What to build

The docs say how the stat tracker sees owners.

- **Guide.** The stat tracker page describes the three blocks and the three reply keys. The prompt chips page tells a custom-prompt author how to add the In Scene Entities chip with Only With Stats to get entity stats back.
- **CONTEXT.md.** The stat request entry names the three owner kinds.
- **Changelog.** (Overruled by spec Q34: two entries under 👤.) One fragment under Minor, Added, 🛠️, with the lead stating subject, surface and outcome, and the save note folded in: a save of a bundled world from an older version shows the old loose stats beside the persona's until a new game.
- The Open Chat bundled world's prompts follow the defaults; check nothing there names the old heading.

Rulings: Q10, Q11, Q20.

## Acceptance criteria

- [ ] The Guide names `Player Character`, Other Stats and the per-entity keys, and shows the chip to add to a custom stat prompt.
- [ ] CONTEXT.md's stat request entry names the three owner kinds.
- [ ] The changelog fragment passes the lead guard and carries the save note.
- [ ] No doc or bundled prompt calls a loose world stat the player's.
