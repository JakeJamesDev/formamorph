# 04: Test Bench Two-Writers Finding

Status: done
Blocked by: None
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

One static rule beside the existing stat-code rules, with the rules test file as prior art. Sonnet at medium effort.

## What to build

A new Test Bench rule warns when two boxes write the same stat field. It scans every box in the world, per owner, for a write to `self.<field>` or to `stats.<Name>.<field>` by dot or bracket literal, resolves `self` to the owning stat, and reports each owner's stat field with more than one writing box. The finding names the field and each writer with its box label. A Blueprint stat's box counts once per owner it runs for. Computed names are out of reach and the rule says nothing about them. The rule runs in the static pass and spins no VM.

## Acceptance criteria

- [ ] A hub and the target's own box writing one field produce one warning naming both writers and their boxes
- [ ] Two hubs writing one field produce one warning
- [ ] Dot and bracket literal forms both count; a computed name does not
- [ ] One writer produces no finding
- [ ] Two owners each writing their own copy of a Blueprint stat produce no finding; two boxes writing one owner's copy do
- [ ] The rule runs without the VM
- [ ] The rules seam proves the guard by reinstating a silent rule once
- [ ] Changelog fragment written; four gates green

## Blocked by

- None (can start immediately)
