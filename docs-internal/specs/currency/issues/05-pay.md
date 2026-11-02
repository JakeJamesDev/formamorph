# 05: Pay

Status: ready-for-human
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

- [x] The Payment plan covers exact coins, smallest first, change in the fewest coins, created change, refusal, a stat lock, an untracked payee, a Global Stat wallet, and a name-only Currency that settles nothing. `currencyPayment.test.ts`, `planPayment` blocks.
- [x] A price in one Currency can't draw on another. A test fails when that guard is removed. `readStatedPrice` Q26 test; removing the guard turns it red.
- [x] A pass reply with `pay` commits coins and stats at the turn commit seam. Income and money that leaves the world both settle. `GameViewer.pay.test.tsx`, on a mounted turn, re-roll included.
- [x] A refused `pay` leaves all state unchanged, logs a diagnostic and shows no UI. The narrator is told nothing (Q15). `GameViewer.pay.test.tsx` refusal cases read state, log and toasts; Q56 tests in `pass.test.ts`.
- [x] Coin moves run the ordinary ops, so a coin's item scripts fire. `GameViewer.pay.test.tsx`: a Gold's When Lost script lowers Vigor.
- [x] A stat pass request omits backing stats only while the Inventory pass is due. A test fails when each side of that rule is removed. `turnPasses.test.ts` and the mounted request body; mutating each side turns a test red.
- [x] A world with a Currency and no items runs the Inventory pass. mounted test; a name-only Currency alone runs none (Q55).
- [x] Save shape stays unchanged. A save made before this ticket loads and pays. mounted test: an autosave reloads and pays, with the record's keys unchanged. A stored `inventoryOps` row can now hold `price` and `currency`.
- [x] The default Inventory prompt teaches `pay` with no parrotable example values, and the schema and text formats both carry it. schema and text tests in `pass.test.ts`; probes below.
- [x] Probe numbers with in-batch controls, cloud by default, cover pay, income and refusal, and show no double charge against the stat pass. The numbers are in the landing. below.
- [x] Docs name paying, and a changelog fragment exists. How to Play, World Editor: Items, `currency-05.md`.

For you: play a bribe and a bounty in a stat world and a coin world. Does the money move once, by the right amount?

## Landed

**Probe numbers.** `testing/baseline/harness/pay-probe.cli.ts`, cloud `default` (Gemma-4), 12 runs per arm per case. Control is the prompt and schema with no `pay`, and a stat request that keeps the backing stat. "Right" means the balance moved by exactly the amount the story states, or held still for a refusal or a no-money case. "Double" means it moved further.

| Case | Control right | Control double | Pay right (schema) | Pay right (text) | Pay double |
|---|---|---|---|---|---|
| bribe | 0/12 | 0 | 12/12 | 12/12 | 0 |
| fee (mixed coins) | 0/12 | 12 | 12/12 | 0/12 | 0 |
| bounty | 12/12 | 0 | 12/12 | 12/12 | 0 |
| fine, can't afford | 0/12 | 12 | 12/12 | 12/12 | 0 |
| price only talked about | 12/12 | 0 | 12/12 | 12/12 | 0 |
| gift of an item | 12/12 | 0 | 12/12 | 12/12 | 0 |
| stat fee | 12/12 | 0 | 12/12 | 12/12 | 0 |
| stat wage | 12/12 | 0 | 12/12 | 12/12 | 0 |
| stat fine, can't afford | 0/12 | 12 | 12/12 | 12/12 | 0 |
| stat price only talked about | 7/12 | 5 | 12/12 | 12/12 | 0 |

The stat pass wrote the backing stat in 0 of 120 pay-arm schema runs. In the control arm it wrote it on every stat fee, wage and refused fine. The control's bribe swung 0/12 to 12/12 between batches, so read single cells with that drift in mind.

Items, `inventory-pass-probe.cli.ts`, 6 runs per case, base then this ticket: schema changes 30/42 then 30/42, schema guard 11/12 then 12/12; text changes 29/42 then 36/42, text guard 12/12 then 6/12.

**Rulings from build evidence.** Q50 to Q58 hold the spec session's answers. A settled pay stays out of `stat_changes`, because the replay reads that list as asks. Text lines may label their cells, and the parser now reads that form. Its absence was the cause of a 29/42 to 13/42 drop in text changes.

**Not verified**

- A second played entity's name isn't in `playerNames`, so as `owner` it reads as income (Q51). The spec session left this for the user.
- Local Cydonia: not run. Test targets default to cloud.
- A choices re-roll runs scripts over the pre-turn base with no pay, so a script reading the backing stat sees the unpaid value there. Nothing is charged twice.

**Known limits**

- A coin-named `gain` or `lose` with no pay in the reply runs as an ordinary item op, with no change making. Lose and transfer can't exceed what is held. The bounty case took this path in the schema arm, with the right amount.
- On the text path, the fee case wrote "Silver" for "one silver and five copper", so it charged 1 Silver. The control got it wrong too.
- In the text path, the item probe's `look` case swung 6/6 to 0/6 between batches on a false reveal.
- The stat talk case sometimes returns a `pay` with junk parties, which the plan refuses when neither names anyone.

**For you**

- For you: play a bribe and a bounty in a stat world and a coin world. Does the money move once, by the right amount?
