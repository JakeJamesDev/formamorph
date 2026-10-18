# 03: Stat Templates For Start, Output And Switch

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: seven built-ins on a settled shape, guarded by the runs-clean test from 02.

## What to build

The built-in stat set gains the seven new templates in the spec: Random Starting Value and Start From Persona Trait for At Game Start; Change When a Trait Switches and Mirror a Trait for When a Trait Switches; Replace a Word, Count a Word and Bold a Word Past a Threshold for During AI Output. Each follows the built-in house style: it reads its bounds from its own stat, and its description holds no example values a small model can copy.

Spec: Q12; stories 11–13.

## Acceptance criteria

- [ ] Each new template shows only in its listed timings' menus
- [ ] Each passes the runs-clean test at each listed timing
- [ ] An Output template inserted with defaults rewrites a sample sentence in Test Code
- [ ] Copy follows `copy-sweep`; changelog fragment written; four gates green
