# ADR-0013 — World Tools ship in worlds, follow the global switch, and skip preset switches

**Status:** Accepted · **Date:** 2026-10-17 · **Supersedes:** the "A world author cannot ship a Tool" line of [ADR-0008](0008-tools-are-preset-scoped-and-capability-gated.md)

## Context

ADR-0008 kept every Tool in settings, switched per prompt preset, so the world export shape stayed untouched. Authors now need the AI to call world-specific functions in every playthrough of their world, without each player building the Tool by hand. The World Tools spec settles how.

## Decision

- **A world can hold Tools** (`World.tools`). They use the existing `Tool` shape, export and import with the world, and are edited in the World Editor's advanced-only **Tools** tab.
- **The offer list** for a request is the catalog and user Tools as today, then the world's Tools.
- **A World Tool replaces a same-name catalog or user Tool** in its world, for every prompt, whatever the World Tool's **Offered To** says. One name is one Tool per world. The Tools tab warns on the clash.
- **World Tools follow the global Tools switch and the endpoint capability gate.** Prompt presets do not list or switch them. There is no per-world player switch.
- The rest of ADR-0008 stands: capability gating, and no runtime fallback.

## Consequences

- **World export shape change.** `World.tools` is new. An older build loads such a world without its Tools.
- A world plays on an endpoint without Tool support, with its Tools left out. Authors should not make a world depend on a Tool.
- A player who turns off the global Tools switch turns off World Tools too. This is the one way to refuse a world's Tools.
- An import drops a malformed World Tool and a second Tool that repeats an earlier one's name or id, and keeps the rest.

## Alternatives rejected

**Let presets switch World Tools:** gives the player per-Tool control, but a preset would need entries for Tools of worlds it has never seen, and a world would play differently per preset.

**Replace only for the prompts the World Tool names:** keeps the catalog Tool on other prompts, but then one name means two Tools in one world, and the AI can't tell them apart across a turn.
