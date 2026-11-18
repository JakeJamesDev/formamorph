# 03: Player Stat Row Lists

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The player sees what each Option value does to stats before picking it. The spec covers this in Q8 and Q11.

- **Setup.** At Enter World, each choice value and boolean state lists its stat rows under it, in the trait-list form ("Gold: +100"). Reuse the trait list's row text.
- **In play.** The in-play Options tab lists the same rows but leaves out starting rows, since a mid-game switch never applies them.
- **Hidden.** Rows on hidden stats are left out, and so are rows whose stat or owner no longer exists (spec Q18). A hidden Option shows nothing, since the Option itself is not shown.
- **Owner form.** A row with an owner reads "Wolf: Health". Ticket 01 defines the owner field, so this works before ticket 02 lands.
- **Docs.** Update [World-Editor-Options.md](docs/World-Editor-Options.md) to say what the player sees. Fold into ticket 01's changelog entry if it has not been released.

## Acceptance criteria

- [ ] Enter World render test: a value's rows list under it in the trait-list form.
- [ ] A row on a hidden stat is left out of the list.
- [ ] In-play Options tab render test: starting rows are left out and regen rows show.
- [ ] A row with an owner reads in the owner form.
- [ ] Frames: `.scratch/frames/option-stat-list-setup-light-1440.png` and `.scratch/frames/option-stat-list-play-dark-1440.png`, at 1440 wide.

For you: Read the setup list for an Easy/Hard switch and judge whether it says enough without crowding the Option.
