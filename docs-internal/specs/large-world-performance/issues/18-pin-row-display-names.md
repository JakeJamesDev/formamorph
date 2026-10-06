# 18: Pin Row Display Names

Status: ready-for-human
Blocked by: 17
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: memoization in the shared pin-row list; contained, with an existing render seam.

## What to build

A trait or location that pins hundreds of placeholders opens its **Pins** tab quickly (Q25). On the pin world, opening "Pin Heavy Trait"'s Pins tab (200 pins) spent about 1.5 s at 1x building placeholder display names, one lookup over all placeholders per row. The pin rows read display names from one map built per render of the list, keyed by placeholder id, rebuilt only when placeholders change. Typing on a heavily pinning source stays responsive once ticket 17 has removed the rules-pass cost. No visible change. Report `npm run profile:editor-speed` pin steps before and after at 6x (Q7).

## Acceptance criteria

- [ ] Harness `pinSourceTrait` and `pinSourceLocation` at 6x: the Pins tab opens with no block over 1 s, and typing into Name meets Q1. **Location met (864 ms). Trait missed (1,306 ms); see Results.**
- [x] Pin rows show the same names, letters and labels as before (existing pin-row tests pass unchanged).
- [x] Editing one pin's value re-renders that row only (render-count test).
- [x] Guard bites: building names per row again brings the Pins-tab cost back (numbers recorded).
- [x] Four gates green. **One load flake in `WorldEditor.appBar.test.tsx`; it passes alone.**

## Results

Measured 2026-10-06 on a machine other sessions were loading, so harness numbers move by 30–50% between runs. Base is `f4bec318`. The "before" run used the base versions of the four product files and the same harness.

| Harness at 6x, longest block while the Pins tab opens | Before | After |
|---|---|---|
| `pinSourceTrait` ("Pin Heavy Trait", 200 pins) | 2,013 ms | 1,306 ms (first sample disturbed by load) |
| `pinSourceLocation` ("The Hub", 201 pins) | 1,655 ms | 864 ms (first sample 830 ms) |
| Typing into Name, input latency p50 / max (trait, location) | 448 / 696 and 600 / 880 ms | 264 / 488 and 352 / 592 ms |

- **The cost was not display names.** After ticket 17, `placeholderDisplayName` was about 10 ms of a 310–410 ms jsdom mount of 200 rows on the real pin world. Each closed picker built a React element for every placeholder row (262 rows × 200 pickers) and decoded each row's token twice.
- **Where the time went (jsdom, 200 rows on the pin world, mount):** pickers 270–350 ms, value boxes 55 ms, conflict notes 35 ms, remove buttons 6 ms. After the fix the pickers take 60 ms, and the whole mount 190–280 ms (was 310–410 ms).
- **What changed:**
  - `PlaceholderSectionList` renders its open list in a child component, so a closed picker builds no row elements. It finds its pick through one index per rows list.
  - `PlaceholderPinRows` draws each pin through a memoized row with stable callbacks. All pins that need no extra row share one rows list, and the value boxes share one vocabulary.
  - The pin index names each placeholder once per placeholder list instead of once per value row.
- **Guards, each proven to bite:**
  - 400 placeholders × 40 values (16,000 value rows) named in 13 ms. The per-row build takes 226 ms, and the test fails over its 100 ms bound.
  - 200 closed pickers over 1,000 rows mount in 190–250 ms. Eager row elements take 1,127 ms, and the test fails over its 500 ms bound.
  - An edit draws the changed row's value box once more and no other row. The test's world changes identity on every edit, as the editors' does, because the pins live in it. The first version of the rows keyed their lists on `world`, so every edit redrew every row; the review found it and the test now fails on that. An unstable `setPin` fails the test too.
  - The name cache drops its names when the owners or the letters change under one placeholder list. Without the check, the test fails.
  - The 16,000-row guard covers the pin index's naming cost only. Names were about 10 ms of the Pins tab, so the tab's own guard is the closed-picker mount bound above.
- **Harness fixes:** the pin steps' typing check read `inputValue` on a contenteditable, so `pinSourceTrait` and `pinSourceLocation` always errored. The Pins-tab wait used a role query, which computes every button's accessible name (1.7 s of the step on a loaded machine); it is now a CSS locator. The steps report `pinsTabMaxBlockMs` from a long-task observer.
- **Trait miss (to the spec session):** the rest of the cost is 200 live rows. Each row mounts a `TokenAutocomplete` with its own drag-and-drop context, and Radix `Presence` reads each mounted element's computed style, which forces style recalculation (812 ms of self time in one profile at 6x). Cutting more means mounting fewer rows at once (windowing, or time-sliced mounting), which changes how the tab fills in and needs a ruling.
