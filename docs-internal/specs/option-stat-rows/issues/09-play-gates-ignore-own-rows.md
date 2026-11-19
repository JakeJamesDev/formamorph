# 09: Play Gates Ignore Own Rows

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Spec Q32: in play, a trait's gate never reads that trait's own stat rows, the same as at setup (Q26b). Today play's gate input reads live stats with the trait's own rows included. So Berserker (needs Strength 7, gives −2) is picked at 7 in setup and then turns off on the first settle in play, at Strength 5.

- **Gate input.** When play checks a held trait's gate, read the live stats with that trait's own contribution taken out: its min, max and regen rows, its toggles, and the value its starting rows moved (its applied-value record). Every other source stays in.
- **Every play reader.** Gate settles after a stat change, Automatic traits, the Traits tab's gate states and stat code's trait gate reads all use the same rule.
- **Docs.** Make sure [World-Editor-Traits.md](docs/World-Editor-Traits.md) says the rule holds in play as well as at setup. Fold into ticket 08's changelog entry if it has not been released.

## Acceptance criteria

- [x] Berserker picked at Strength 7 stays on through the first turns of play. `traitRuntime.ownRows.test.ts` "keeps Berserker … on through the first turns of play", plus the Traits tab gate read and stat code's `available`.
- [x] A trait whose gate fails for a reason other than its own rows still turns off in play. "turns Berserker off when Strength drops below 7 for another reason".
- [x] A trait with a max row is judged against the max without that row. "judges Giant against the max without its own max row".
- [x] The guard goes red with its bug reinstated. Three mutations: play reader off (all play tests red), commit-snapshot exclusion ignored (code switch + stat code tests red), the old Test Bench filter (three "stays silent" tests red).

## Landed

**Not verified**
- None. Q34 cases also covered: an off trait, owner-only exclusion, mutual propping in play, a code switch mid-commit, and the narrowed Test Bench rule (fires on regen, quiet on value, max and toggle).

**For you**
- Play a world with a Berserker-style trait (needs a stat it lowers) and confirm it stays on, and still drops when something else lowers the stat. Look at the Traits tab's requirement chip too.
- Read the rewritten "When the game checks" section of `docs/World-Editor-Traits.md` and the new Test Bench regen warning text.
