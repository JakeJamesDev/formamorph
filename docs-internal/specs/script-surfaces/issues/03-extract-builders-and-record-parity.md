# 03: Extract the Builders and Record Parity

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: three derivations inside components become pure functions with no behavior change, and the fixture world has to cover every home kind so the parity record is worth trusting.

## What to build

The prefactor for the one context hook (spec: One context hook; Q3, Q7). The stat panel's, the trait tab's and the Scripts tab entry's box-context derivations are each extracted as-is into a pure function over the same inputs they read today, with the components calling the extracted function. Nothing a surface shows or runs changes.

A parity fixture world holds one of each home: a global stat, an entity's own stat, a root-linked Blueprint stat on an entity, a Blueprint stat, a global trait, an entity's own trait, a Blueprint trait and a world script, each with a script. The parity tests record, per home and per surface that shows it, the Owner, the self name, the owner stats, the owner stat names, and the card lookup's answer for a sample Timing. Where the surfaces disagree today, the test records the disagreement by name instead of forcing one side. The known one is the linked stat's self id: the stat panel's carries the link id, the Scripts tab's the original id.

## Acceptance criteria

- [ ] Each of the three derivations is a pure function the component calls; the existing panel, trait and Scripts tab tests pass unchanged.
- [ ] The parity fixture world covers the eight homes above, each with a script and, for the linked stat, an override.
- [ ] Parity tests record Owner, self name, owner stats, owner stat names and the lookup answer per home per surface, and name every recorded disagreement, the linked stat's self id included.
- [ ] A parity test fails when one extracted builder's Owner derivation is changed, proven once by hand.
- [ ] No changelog fragment: a prefactor with no player-visible change.
