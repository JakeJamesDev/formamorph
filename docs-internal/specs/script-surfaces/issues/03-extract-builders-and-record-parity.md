# 03: Extract the Builders and Record Parity

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: three derivations inside components become pure functions with no behavior change, and the fixture world has to cover every home kind so the parity record is worth trusting.

## What to build

The prefactor for the one context hook (spec: One context hook; Q3, Q7). The stat panel's, the trait tab's and the Scripts tab entry's box-context derivations are each extracted as-is into a pure function over the same inputs they read today, with the components calling the extracted function. Nothing a surface shows or runs changes.

A parity fixture world holds one of each home: a global stat, an entity's own stat, a root-linked Blueprint stat on an entity, a Blueprint stat, a global trait, an entity's own trait, a Blueprint trait and a world script, each with a script. The parity tests record, per home and per surface that shows it, the Owner, the self name, the owner stats, the owner stat names, and the card lookup's answer for a sample Timing. Where the surfaces disagree today, the test records the disagreement by name instead of forcing one side. The known one is the linked stat's self id: the stat panel's carries the link id, the Scripts tab's the original id.

## Acceptance criteria

- [x] Each of the three derivations is a pure function the component calls; the existing panel, trait and Scripts tab tests pass unchanged. `statPanelBoxContext`, `traitTabBoxContext`, `scriptEntryBoxContext` in `src/managers/scriptBoxBuilders.ts`; 97 related test files (1115 tests) green with no test file changed.
- [x] The parity fixture world covers the eight homes above, each with a script and, for the linked stat, an override. Fixture in `scriptBoxBuilders.parity.test.tsx`; a second entity links both Blueprints unoverridden so their lookups have an owner.
- [x] Parity tests record Owner, self name, owner stats, owner stat names and the lookup answer per home per surface, and name every recorded disagreement, the linked stat's self id included. `RECORD` plus `DISAGREEMENTS` (T03-1, T03-2, T03-3); the Scripts tab runs through `useScriptEntryContext` itself.
- [x] A parity test fails when one extracted builder's Owner derivation is changed, proven once by hand. Trait tab Blueprint owner set to null: `blueprintTrait on the traitTab` went red; Scripts tab Blueprint owner dropped: two Scripts tab cases went red. Both reverted.
- [x] No changelog fragment: a prefactor with no player-visible change.

## Landed

**Not verified**
- None.

**For you**
- Nothing to judge in play: no surface changes what it shows or runs.

Seen in passing, for ticket 04: a Blueprint trait box's lookup lists no owners on either surface (`owner().owners` and `ownerEntityIds()` empty), because the lookup finds a Blueprint box's runs by its self stat id, which a trait box has none of. Recorded as today's value in `RECORD.blueprintTrait`.
