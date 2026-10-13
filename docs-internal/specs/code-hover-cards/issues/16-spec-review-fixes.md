# 16: Spec Review Fixes

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Fixes the spec review's findings after tickets 01–15 landed. Opus at high: the persona stat fix touches the box-bound lookup's identity rules.

## What to build

1. **`persona.stats.X` with one playable entity.** The card follows T15-1 and Q28: a route that reaches one entity shows that entity's stat as a plain card. A Link shows its Overrides (effective values); an entity's own stat shows its own rows. Both carry Open and Find All Uses. Today the persona branch always swaps in the Blueprint stat, so a Link shows Blueprint values and an own stat shows only an Owner row. The test that expects Blueprint values for a single playable entity changes to expect the effective values. Q34 still applies when two or more playable entities are reached.
2. **Guide link in the completion pane.** The pane keeps Read in the Guide. T08-1 lets it drop only links it can't act on (Go to Line, Open, Find All Uses).
3. **One build of a box's analysis options.** The Find All Uses scan, the stat editor and the Test Code run each build a box's analysis options, and the card world is assembled twice. One shared builder serves all of them, so Find All Uses can't drift from the editor.
4. **`owner` card description.** The `owner` card in an entity's box opens with the entity's description, as the entity card does (T07-7).
5. **Design System wording.** The Design System page says the card pattern was approved (Q19), not that production uses it before approval.

Naming fixes from the same review (`holder`, `CodeStatUse`, the "No Bearers" casing) belong to the owner term rename effort, not here.

Spec: Q4, Q19, Q28, Q34, T07-7, T08-1, T15-1.

## Acceptance criteria

- [ ] `persona.stats.X` with one playable entity shows a Link's Overrides, or the entity's own stat rows, with Open and Find All Uses
- [ ] Two or more playable entities still follow Q34
- [ ] The completion pane shows Read in the Guide on a global's card
- [ ] Analysis options and the card world each have one builder; Find All Uses, the stat editor and Test Code use it
- [ ] The `owner` card shows the entity's description
- [ ] Guard bites: reinstating the Blueprint swap fails the single-playable test
- [ ] Changelog fragment under the existing code hover cards entry; four gates green

## Blocked by

- None (can start immediately)
