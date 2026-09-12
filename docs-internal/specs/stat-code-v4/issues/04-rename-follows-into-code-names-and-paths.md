# 04: Rename Follows Into Code Names And Paths

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Two extensions to the rename offer that v3 built: derived code-name references and path segments. The detector and the rewrite are in place; this widens what they count. Sonnet at medium effort.

## What to build

Renaming a placeholder changes the code name of every stat and trait whose name carries that chip. The rename offer counts those derived references beside the direct `placeholders` references and rewrites both when accepted, so `stats["Beast Power"]` follows `Beast` becoming `Wolf` and `traits["Beast Fury"]` follows too.

The rename offer also rewrites path forms. A rename of an owner or a holder rewrites that segment in every path that passes through it; a rename of a child rewrites the leaf. Dot and bracket forms, both quote styles, at any depth. Everything else about the offer, the detector, the duplicate rule, and the discard path stays as v3 ticket 10 built it.

## Acceptance criteria

- [ ] Renaming placeholder `Beast` to `Wolf` prompts with a count that includes `stats["Beast Power"]` and `traits["Beast Fury"]`; Yes rewrites them to the new code names
- [ ] Renaming entity `Molly` rewrites `placeholders.Molly.Hair` and `placeholders["Molly"]["Hair"]` to the new owner segment
- [ ] Renaming the child `Hair` under Molly rewrites the leaf and leaves a world-level `placeholders.Hair` alone
- [ ] Renaming to a duplicate at the same level prompts nothing
- [ ] Discard restores the name and the rewritten code together
- [ ] Unit tests on the rewrite for each case; a live check renames an owner in the editor and reads the rewritten path
- [ ] Four gates green; graph updated

## Blocked by

- 02 — Paths In The Placeholders Map
- 03 — Trait Code Names
