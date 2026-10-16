# 05: Help Copy For Code Names

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A copy pass over the surface tables plus two text renderings. Sonnet at medium: mostly writing to the Writing Guide.

## What to build

Every code surface's info lines move to the Writing Guide voice: verb-first, second person, no period on a single sentence. "Writable" and "Read-only" leave the info lines, because the badge carries them. The Variable menu and the Tool editor's reference list show no badge, so both render the access field as text.

Spec: Q16; Implementation Decisions: Access badge, Lists without a badge; Testing Decisions: Copy.

## Acceptance criteria

- [ ] Every surface info line follows the Writing Guide; the `copy-sweep` skill passes
- [ ] No info line carries access words; the Variable menu and Tool reference show access as text
- [ ] The Quick Reference test still covers every row
- [ ] Changelog fragment; four gates green

## Blocked by

- 02
