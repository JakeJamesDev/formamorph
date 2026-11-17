# 02: Trait Rows

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A Preset value can turn root and entity-owned traits on or off. Apply then settles the full target draft once, so click order never blocks a valid start. The spec covers this in Q5, Q7, Q8, Q18 and Q19.

- **Apply.** Extend ticket 01's apply function for trait rows. For a snapshot, reset the traits to the world's defaults. Overlay the trait rows; a row in a max-1 group swaps the pick. Then settle once through the existing fixpoint, with the Preset's picks ordered as the latest picks, and run the short-group fill. Unlisted picks that fail go to cascade-off. A trait row that does not hold after the settle is reported as skipped.
- **Match.** Extend match to compare traits. A snapshot compares every trait. An overlay compares its listed rows only.
- **Notice.** Extend the cascade notice. After a Preset applies, the notice names the Preset value, the traits it turned on or off in other categories, the picks it turned off, and any skipped rows.
- **Editor.** The row editor offers root traits and entity-owned traits as targets, each with an on/off value.
- **Docs.** Update [World-Editor-Options.md](docs/World-Editor-Options.md) for trait rows. Write a changelog fragment.

## Acceptance criteria

- [ ] The Elf/Orc/Evil case: with Elf picked and Elf blocking Evil, a Preset that lists Orc and Evil applies both.
- [ ] A Preset pick wins a Not conflict against an unlisted pick, and that pick moves to cascade-off.
- [ ] A trait-off row removes a pick. A row in a max-1 group swaps the pick. A group left short is filled.
- [ ] A snapshot resets unlisted traits to the defaults. An overlay keeps them.
- [ ] A row for an owned trait applies to that entity's picks.
- [ ] A row that fails after the settle is named as skipped in the notice, and the other rows still apply.
- [ ] Match clears when the player changes a trait that a Preset value set.
- [ ] Setup render test: a click changes picks in another category, and the notice names them.
- [ ] Frame: `.scratch/frames/preset-notice-light.png` at desktop width, with the notice showing.

For you: Apply a Preset that changes traits in several categories, and judge whether the notice says enough without being too long.
