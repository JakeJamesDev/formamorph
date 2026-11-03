# 13: Currency Refactor

Status: done
Blocked by: 10, 11, 12
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A behavior-preserving restructure of money code other tickets touch, so it needs care about seams.

## What to build

No behavior changes. The close review's structure findings get fixed:

- Split `currency.ts` by reason to change: parsing, editor row operations, picker groups, price reading, and payment planning.
- Use one refusal shape in place of today's five.
- Share the duplicated checks: visible and identified copies, the whole-number check, and the stat helpers in the pass and in script money.
- Give `repeatsBuy` a name that says it records state, and move `quoteBuy`'s pricing into the Currency modules.
- Reduce the nested closures `applyInventoryPass` gained.

Also add the missing test: a script pay followed by a pass pay in one turn.

**Start this only after Script Run Order ticket 04 lands.** That ticket rewrites how money chains between scripts, and this one would collide with it. It may also remove the need for some of these shapes, so re-read the code first.

Rulings: Q83, Q84.

## Acceptance criteria

- [x] Every existing Currency test passes unchanged, except for import paths. (720 money and inventory tests green. Q88 adds one exception: 13 assertions, listed below)
- [x] A test proves a script pay then a pass pay in one turn settles both, and it fails when the pass reads stale state. (`GameViewer.pay.test.tsx`, "a script pay then a pass pay in one turn". With the pass reading render-time stats and copies, all three failed: 20 not 10, 5 not 40, 70 copper not 60)
- [x] The pay and buy probes, cloud default, show no case falling against an in-batch run of the code before this ticket. The numbers are in the landing. (Below)
- [x] Bundled-world fingerprints and export shape are unchanged. No changelog fragment. (`bundledFingerprint.test.ts` and `shippedWorld.test.ts` green in the gates. The diff touches no type in `src/types`, no world file and no save code)

## Landed

**Changed assertions (Q88).** All are in `src/lib/currencyPayment.test.ts`, in `readStatedPrice`. Each `toHaveProperty('refused')` became `toHaveProperty('settled', false)`:

- `read('Silver')`
- `readStatedPrice('Gold, Silver', '', currencies, items, 3)`
- `read('1 Gold, 1 Shell')`, `read('1 Gold', 'Credits')`, `read('1 Shell', 'Coin')`
- `read('5', 'Marks')`, `read('5 Marks')`
- `read('')`, `read('some coins')`, `read('5', '', [])`, `read('1 Gold, 5')`, `read('0 Gold')`, `read('0.5 Copper')`

**Probes.** Model `default` at `api.lyonade.net`, 6 runs per case, 0 failed runs. Old code (`ea181671b`, from the main checkout) and new code ran at the same time. `right` is the probe's main check.

| Pay case | right old → new | pay-op old → new | double |
|---|---|---|---|
| bribe, fee, fine-broke | 6/6 → 6/6 | 6 → 6 | 0 |
| bounty | 5/6 → 6/6 | 3 → 1 | 0 |
| talk-price, gift-item | 6/6 → 6/6 | 0 → 0 | 0 |
| stat-fee, stat-wage, stat-broke, stat-talk | 6/6 → 6/6 | 6 → 6 | 0 |

| Buy case, `buy` arm | right old → new | buy-op old → new | double old → new |
|---|---|---|---|
| buy-value, haggle, sell, gift, stat-buy, stat-haggle, stat-sell, stat-broke, buy-broke | 6/6 → 6/6 | same | 0 → 0 |
| sell-haggle | 6/6 → 6/6 | 4 → 4 | 0 → 0 |
| talk-price | 5/6 → 6/6 | 3 → 2 | 1 → 0 |

All 8 canned buy cases read `ok` on both sides. The probes ran before the review's fold-ins, which rename, move and comment code and change no logic. Bounty's `pay-op` fall has no code cause: the prompts and schema are unchanged, and `right` rose.

**Left as is**
- `traitGates.ts` keeps its own visible-and-identified check, because it is no money check and `isSpendable` would misname it.
- `isWholeValue` stays apart from `isWholeWorth`, because it allows zero.

**Not verified**
- Nothing.

**For you**
- Nothing. No player-facing behavior changed.
