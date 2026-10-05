# 16: Lookup Mode off again

Status: done
Blocked by: 13
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

## What to build

Lookup Mode starts off, as the re-probe ruled, and the record says why.

- The default flips back to off. The capability gate and the row are unchanged; the row's hint keeps saying when it runs and what it costs, so a player on a local model knows what the switch buys.
- ADR 0009's decision line is amended, not rewritten: a dated note that the default went on in ticket 10 from ticket 22's numbers and back off after ticket 13's probe, with the probe's numbers and the ceiling caveat.
- The Formaquestion guide and the changelog entry say Lookup Mode is off by default. Fold into the existing changelog entry; no new line.

Spec: Q52; Implementation → Help settings.

Recommended model rationale: a default flip, an ADR note and two doc lines, all guarded by existing tests.

## Acceptance criteria

- [ ] Settings test: the default is off; the session test offers the function only with the switch on.
- [ ] ADR 0009 carries the dated amendment with ticket 13's numbers.
- [ ] The guide and the changelog entry match; one Formaquestion entry remains in In Progress.
- [ ] The four gates are green.
