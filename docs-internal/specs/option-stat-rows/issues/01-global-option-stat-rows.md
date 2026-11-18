# 01: Global Option Stat Rows

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An author can give each choice value and each boolean state stat rows that move global stats. The rows act on stats like a trait's rows do, and never go into the prompt. The spec covers this in Q1–Q5 and Q7.

- **World shape.** Add stat-change and stat-toggle row lists to a choice value, and one pair each for On and Off on a boolean Option. The rows use the trait's row shapes, plus an optional owner field naming an entity. This ticket defines the owner field as a type only; ticket 02 makes it work. Number and Preset Options get no rows.
- **Runtime.** Option rows become one more source of stat contributions, read live from the world and the current Option values. They are never copied into the save.
  - Starting rows apply once at game start, after authored starting values and before starting traits. The Test Bench opening does the same.
  - Min, max and regen rows stack with trait rows under the existing floors.
  - Option toggles apply before trait toggles, so a trait wins on the same stat.
- **Mid-game.** Every path that changes Option values in play re-derives stats: the in-play Options tab, stat code and script writes to `options`, and the gate settle after a change. A change never moves a value, except where a new bound clamps it. A stat at its cap does not follow a raised cap.
- **Editor.** The Options panel shows the trait stat-row editor under each choice value and each boolean state. The stat picker offers global stats.
- **Deleted targets.** A row whose stat no longer exists stays in the file and is ignored at runtime, as trait rows are. Nothing prunes it (spec Q18).
- **Docs.** Update [World-Editor-Options.md](docs/World-Editor-Options.md) for stat rows. Write a changelog fragment.

## Acceptance criteria

- [ ] A new game with Easy picked starts Gold at its authored starting value plus Easy's starting row.
- [ ] The Test Bench opening applies the picked values' starting rows.
- [ ] An Option's regen row and a trait's regen row on the same stat sum.
- [ ] A mid-game switch from Easy to Hard moves max and regen at once and leaves the value alone. A value above the new max is clamped.
- [ ] A stat code write to `options` re-derives stats the same way the Options tab does.
- [ ] An Option toggle turns a stat on. A trait toggle on the same stat wins.
- [ ] A hidden Option's rows still apply.
- [ ] Each runtime guard above goes red with its bug reinstated.
- [ ] Editor render test: add a stat row to a choice value and to a boolean's Off state.
- [ ] Frame: `.scratch/frames/option-stat-rows-editor-dark-1440.png`, the Options panel with rows on a choice value, dark theme at 1440 wide.

For you: Set up an Easy/Hard switch in a world, start a game on each, and switch mid-game to judge whether the effect reads right in play.
