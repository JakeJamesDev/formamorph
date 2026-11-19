# 09: Play Gates Ignore Own Rows

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Spec Q32: in play, a trait's gate never reads that trait's own stat rows, the same as at setup (Q26b). Today play's gate input reads live stats with the trait's own rows included. So Berserker (needs Strength 7, gives −2) is picked at 7 in setup and then turns off on the first settle in play, at Strength 5.

- **Gate input.** When play checks a held trait's gate, read the live stats with that trait's own contribution taken out: its min, max and regen rows, its toggles, and the value its starting rows moved (its applied-value record). Every other source stays in.
- **Every play reader.** Gate settles after a stat change, Automatic traits, the Traits tab's gate states and stat code's trait gate reads all use the same rule.
- **Docs.** Make sure [World-Editor-Traits.md](docs/World-Editor-Traits.md) says the rule holds in play as well as at setup. Fold into ticket 08's changelog entry if it has not been released.

## Acceptance criteria

- [ ] Berserker picked at Strength 7 stays on through the first turns of play.
- [ ] A trait whose gate fails for a reason other than its own rows still turns off in play.
- [ ] A trait with a max row is judged against the max without that row.
- [ ] The guard goes red with its bug reinstated.
