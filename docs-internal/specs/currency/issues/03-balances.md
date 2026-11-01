# 03: Balances

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Stat Link resolution and a prompt-visible chip change that needs probe judgment.

## What to build

The player sees one balance row per Currency in the Inventory tab, stat-backed included and name-only excluded. The narrator reads each listed item's worth and each present owner's balance in the `<INVENTORY>` chip.

This ticket owns Balance in the Currency module. An owner with no authored balance reads as untracked, not as zero. Ticket 05 reads it.

Rulings: Q8, Q12, Q18, Q21.

## Acceptance criteria

- [ ] Balance covers each backing: coins at the owner, a Persona or entity stat through Stat Links, a Global Stat as a shared wallet, and an untracked owner.
- [ ] Hidden and unidentified coins don't count, and a Bound coin does. A test fails when each rule is removed.
- [ ] The Inventory tab shows the rows and updates when coins move.
- [ ] `<INVENTORY>` carries worth and balances in each context format, and an untracked owner shows none.
- [ ] The chip's sample scene and What the AI Reads show the new lines.
- [ ] Probe numbers with in-batch controls, cloud by default, show the narrator's stated prices against a control. The numbers are in the landing.
- [ ] Frames of the Inventory tab with a coin and a stat balance, in both themes at 1366: `.scratch/frames/balances-light.png`, `balances-dark.png`.
- [ ] `CONTEXT.md` gains Balance, docs name balances, and a changelog fragment exists.

For you: play a shop scene. Does the narrator state fair prices and respect what the player can afford?
