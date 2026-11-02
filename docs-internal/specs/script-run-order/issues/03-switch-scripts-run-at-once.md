# 03: Switch Scripts Run At Once

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

This ticket owns firing events between scripts in the chain. Ticket 04 uses the same path for item events.

## What to build

When a script switches a trait, its When a Trait Switches scripts run at once, nested, before the next script in the list. The next script reads their full result. The existing switch depth cap stays.

Ruling: Q5.

## Acceptance criteria

- [ ] A test through `runStatCodeTurn` proves the next script reads what a switch script wrote.
- [ ] A test proves a chain past the depth cap stops firing and reports as it does today.
- [ ] A test proves a trait that two scripts switch on and off in one timing fires what each switch fires, in order.
- [ ] A test proves a re-roll fires the switches again from its clean start, with nothing counted twice.
- [ ] Each new guard fails when switch runs move back to the end of the batch.
- [ ] Scripts Reference's Order of Effects and When a Trait Switches sections describe this, and the changelog entry from ticket 02 covers it.
