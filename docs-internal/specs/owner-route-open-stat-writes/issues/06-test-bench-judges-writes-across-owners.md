# 06: Test Bench Judges Writes Across Owners

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Static scan with alias resolution across owners, persona sets, and Blueprint bearers. Opus at high effort.

## What to build

The two-writers rule judges every target per owner and field across all writer boxes in the world. The write scan also roots at `owner.stats`, `entities.<Name>.stats`, `entities["Name"].stats`, and `persona.stats`, by dot or bracket literal. `owner` resolves to the writer's owner. Every route that reaches one stat is one target. `persona.stats.X` resolves to every entity that can be played (Q11). Each bearer of a Blueprint box is a separate writer, so a Blueprint box with two or more bearers that writes a world stat field gets the warning (Q12). Computed names stay out of reach.

The unknown-stat rule scans owned and linked boxes as well as world boxes. It checks `stats.X` against the world stats, `owner.stats.X` against the owner's stats, and `entities[x].stats.Y` and `persona.stats.Y` against that entity's stats.

The Issues run that executes every box also runs owned and Blueprint boxes, each with its `owner`.

## Acceptance criteria

- [ ] A Creature box and a world box that both write `Destruction.value` raise one finding naming both writers
- [ ] `owner.stats.X`, `entities["Name"].stats.X`, and `persona.stats.X` that reach one stat count as one target
- [ ] A Blueprint box with two bearers writing a world stat field raises the finding; with one bearer it does not
- [ ] An unknown name after each route is reported in an owned box and a world box
- [ ] The Issues run reports a failing owned box
- [ ] The rules seam proves each guard by reinstating the per-owner scope once
- [ ] Four gates green

## Blocked by

- 02 (Code Writes Any Stat)
