# 06: Template Sweep

Status: ready-for-agent
Blocked by: 01, 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A read-and-fix pass over fourteen templates against two settled rules. Sonnet at medium effort.

## What to build

Every existing built-in template is checked against the ledger rule and the cross-write rule. A template whose comment or structure says a code bound replaces traits, or that code can only write its own stat, is updated. A template that stays correct is left alone. The sweep lists each template and its verdict in the ticket's status note.

## Acceptance criteria

- [ ] Every template is listed with a verdict: unchanged, or changed and why
- [ ] No template comment says a code bound replaces or overrides traits
- [ ] No template comment says code can write only its own stat
- [ ] Every changed template still runs clean under the executor
- [ ] Changelog fragment written when a template changed; four gates green

## Blocked by

- 01 (Code Bounds Become Ledgers)
- 02 (Code Writes Another Stat)
