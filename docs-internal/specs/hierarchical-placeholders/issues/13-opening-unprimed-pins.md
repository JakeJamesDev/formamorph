# 13 — Opening instrument draws fresh for a Unique chip inside a pin value

Status: done

Spec: `../spec.md`. Raised by the 2026-09-01 architecture review; reproduced the same day after 228d734.

## Symptom (reproduced)

`buildOpening` resolves pin values and stored rolls through a resolver with no `setRoll`
(`src/lib/testBench/opening.ts:211`). Trait pin values are not in `chipBearingTexts` (`rules.ts`), so a Unique
chip placed only inside a pin value is never primed and draws fresh on every call. The instrument disagrees
with itself across renders, against ADR-0005's first consequence.

World chips inside pin values are safe only when the same placeholder is also placed in world text, which is
what the test added in 228d734 covers. A World chip whose placeholder is placed nowhere else is the same gap.

## Repro (throwaway vitest, 40 calls, one primed rolls object)

- World: `ph-coin` placed in the system prompt; `ph-gift` placed once as Unique in an entity description.
- A default trait pins `ph-coin` to `{{ph:ph-gift:unique:pin-u1}} charm`.
- `primeOpeningRolls(w, {}, pickFirst)` then `buildOpening(w, lens, rolls)` ×40.
- Observed: `traits[0].pins[0].value` ∈ {knife charm, ribbon charm, shell charm}; `rolls.unique` keys = [pl-g1]
  only; rolls not mutated.

## Fix options

- Pin values join the primed field list, so `pin-u1` gets a roll at prime time. Matches how play would treat
  the pin if pins were chip-bearing at Enter World — confirm play primes them first.
- Or the Opening instrument describes pin values instead of resolving them, and the row says so.

## Done

- `opening.test.ts` gains the repro above as a guard: two `buildOpening` calls with the same rolls read alike.
- Prove the guard bites by reverting the fix once.

## Shipped

Play does not prime pin values either: the Enter World pass in `PlaceholderSessionContext.tsx` walks the same field
list as `chipBearingTexts`, and play resolves with no `setRoll`, so a Unique chip inside a pin redrew on every render in
play too. The fix is in the resolver, so both surfaces share it: `primeRolls` takes `pinTexts` (placeholder id → every
text any trait pins it to, from `allPinTexts` in `traitEffects.ts`) and walks each beside the roll it masks, under the
same chain, including a pin that beats an authored drill and a slot that routes through a pinned variant. The Opening reroll
counts a pin's chips as placements, so one masked by a second trait's pin keeps its frozen roll. Enter World and the Opening instrument both pass every
trait's pins. `chipBearingTexts` and the unplaced rules are unchanged: a pin is still intent, not a placement.

Guards: `placeholders.test.ts` (chain-keyed pin, pin over a drill, slot through a pin), `opening.test.ts` (the repro,
prime, reroll, reroll under a second pin), `PlaceholderSessionContext.test.tsx` (play). Every guard was red before its
fix and green after it.
