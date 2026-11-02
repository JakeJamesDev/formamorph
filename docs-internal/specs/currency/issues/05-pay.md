# 05: Pay

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: xhigh

The core money rules plus changes to two passes, where a mistake double-charges players and only probes show it.

## What to build

The story has the player pay a bribe. The Inventory pass returns `pay` and code settles it: coins leave smallest first, change returns in the fewest coins, and a stat moves if the Currency is stat-backed. A bounty arrives as `pay` with no payer. A payment the player can't afford changes nothing and shows nothing.

The stat pass can no longer charge the same money twice. It omits backing stats while the Inventory pass is due, and keeps them when it isn't. The Inventory pass is also due in a world with Currencies and no items.

This ticket owns the Payment plan in the Currency module. Tickets 06 and 07 call it.

Rulings: Q7, Q8, Q9, Q11, Q15, Q18, Q21, Q26, Q27, Q28, Q29, Q43, Q44, Q45, Q48.

## Acceptance criteria

- [ ] The Payment plan covers exact coins, smallest first, change in the fewest coins, created change, refusal, a stat lock, an untracked payee, a Global Stat wallet, and a name-only Currency that settles nothing.
- [ ] A price in one Currency can't draw on another. A test fails when that guard is removed.
- [ ] A pass reply with `pay` commits coins and stats at the turn commit seam. Income and money that leaves the world both settle.
- [ ] A refused `pay` leaves all state unchanged, logs a diagnostic and shows no UI. The narrator is told nothing (Q15).
- [ ] Coin moves run the ordinary ops, so a coin's item scripts fire.
- [ ] A stat pass request omits backing stats only while the Inventory pass is due. A test fails when each side of that rule is removed.
- [ ] A world with a Currency and no items runs the Inventory pass.
- [ ] Save shape stays unchanged. A save made before this ticket loads and pays.
- [ ] The default Inventory prompt teaches `pay` with no parrotable example values, and the schema and text formats both carry it.
- [ ] Probe numbers with in-batch controls, cloud by default, cover pay, income and refusal, and show no double charge against the stat pass. The numbers are in the landing.
- [ ] Docs name paying, and a changelog fragment exists.

For you: play a bribe and a bounty in a stat world and a coin world. Does the money move once, by the right amount?
