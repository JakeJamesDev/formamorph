# 06: Template Sweep

Status: done
Status note: Swept 2026-10-11, all 15 templates unchanged; no template text needed an edit, so no changelog fragment. Verdicts in `## Sweep verdicts`.
Blocked by: 01, 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A read-and-fix pass over fourteen templates against two settled rules. Sonnet at medium effort.

## What to build

Every existing built-in template is checked against the ledger rule and the cross-write rule. A template whose comment or structure says a code bound replaces traits, or that code can only write its own stat, is updated. A template that stays correct is left alone. The sweep lists each template and its verdict in the ticket's status note.

## Acceptance criteria

- [x] Every template is listed with a verdict: unchanged, or changed and why
- [x] No template comment says a code bound replaces or overrides traits
- [x] No template comment says code can write only its own stat
- [x] Every changed template still runs clean under the executor (none changed; all 15 run clean)
- [x] Changelog fragment written when a template changed (none changed); four gates green

## Sweep verdicts

Checked `src/lib/statCodeTemplates.ts` for text or structure that says a code bound replaces traits, or that code writes only its own stat. The ticket counted fourteen; Dice Roll With Consequences (ticket 05) makes fifteen, and it was written against both rules. All 15 ran clean under the executor (`statCodeTemplates.test.ts`, 61 tests).

| Template | Box | Verdict |
|---|---|---|
| Weighted Blend | after | Unchanged. Reads other stats only. |
| Inverse of Another Stat | after | Unchanged. Reads `source.max`, the effective max. |
| Threshold Flag | after | Unchanged. Reads other stats and `self` bounds. |
| Hourly Change | after | Unchanged. Self value write. |
| Timer | after | Unchanged. Self value write. |
| Daypart Modifier | after | Unchanged. Reads other stats only. |
| Random Per-Turn Roll | after | Unchanged. Self value write. |
| Regen Toward Target | after | Unchanged. Self value write. |
| Bound From Another Stat | after | Unchanged. The one template that writes a bound. Its text says it sets the bound from another stat and keeps the value's normal changes. It never says the write hides traits. Under ledgers the written number is the effective bound after the run. |
| Bonus From Persona Trait | after | Unchanged. Reads a persona trait. |
| Penalty From Entity Trait | after | Unchanged. Reads an entity trait. |
| Dice Roll With Consequences | after | Unchanged. Already writes two other stats and names the stat-order rule. |
| Placeholder by Range | before | Unchanged. Placeholder pin. |
| Trait by Threshold | before | Unchanged. Trait switch. |
| Opening Turn Value | before | Unchanged. Opening value write. |

## Blocked by

- 01 (Code Bounds Become Ledgers)
- 02 (Code Writes Another Stat)
