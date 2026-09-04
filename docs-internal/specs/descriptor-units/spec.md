# Spec: Descriptor Units — Raw-Value Thresholds + the Variant D Editor Section

Status: done
Status note: verified shipped in the 2026-08 status sweep (changelog/code evidence)

## Problem Statement

Stat descriptor thresholds are silently interpreted as **percentages of the stat's min→max range** — semantics inherited verbatim from the upstream JavaScript app. Nothing in the editor says so except a placeholder (`Threshold %`) that vanishes the moment a value is typed. Authors of non-0-100 stats naturally write thresholds in the stat's own units, and the result is invisibly broken banding: a 0–10 "rockets" stat with bands at 3/6/10 reads as bands at 3%/6%/10%, so 0 rockets shows "low", 1 rocket shows "high", and 2–10 rockets show no status at all. The Test Bench's start-no-descriptor warning fires on these stats with a message ("starts at 3, above every descriptor threshold") that reads as nonsense because it compares a raw value against percent thresholds without saying which is which.

An audit of every bundled world found **all** descriptor-carrying stats are 0–100, where raw and percent readings coincide — so the percent semantics were never exercised as percents, and no author is known to have relied on them.

At the same time, pure raw thresholds have a real weakness the percent reading solved: raising or lowering a stat's max leaves raw bands stale (a 0–10 stat re-ranged to 0–20 keeps its bands at 3/6/10 and strands the top half uncovered). Some stats genuinely want proportional bands.

## Solution

Descriptor thresholds become **raw stat values by default**, with a **per-stat unit toggle** letting any stat opt into proportional (percent-of-range) thresholds instead. The Stat Descriptors editor section is rebuilt as the prototyped **variant D**: a coverage bar showing every band's real extent (plus the uncovered "no status" zone and a start-value marker), captioned rows ("covers 0 – 3") with permanent unit tags on every threshold input, and a segmented **Raw Unit | % of Max** control that converts existing thresholds in place when switched — so switching units never moves a band, it only changes what happens when the range later changes.

No stored data is rewritten. Because every known world is 0–100, reading stored thresholds as raw values changes nothing for them; non-0-100 stats (the broken ones) start behaving as their authors intended.

## User Stories

1. As a world author, I want thresholds I type to mean the stat's own units, so that "3" on a 0–10 stat means 3 rockets and not 0.3.
2. As a world author, I want each threshold input to permanently show its unit ("of 10" or "%"), so that I never have to guess what the number means after the placeholder disappears.
3. As a world author, I want a caption under each descriptor row stating the exact range it covers, so that I can read my banding without doing arithmetic.
4. As a world author, I want a coverage bar drawing every band's true extent across min→max, so that gaps and misproportions are visible at a glance.
5. As a world author, I want the uncovered zone above my top band drawn in the bar and called out in a warning line, so that a range where the AI gets no status is impossible to miss.
6. As a world author, I want the stat's starting value marked on the coverage bar, so that I can see immediately which band (or gap) a new game opens in.
7. As a world author, I want a per-stat **Raw Unit | % of Max** segmented control, so that I can choose whether bands stay put or rescale when I change the stat's range.
8. As a world author, I want switching units to convert my existing thresholds in place, so that the toggle never changes what my bands currently cover.
9. As a world author with a proportional stat, I want percent-mode bands to rescale automatically when I raise max, so that "the bottom 30% is low" survives a range edit without re-authoring.
10. As a world author with a counter stat, I want raw-mode bands to stay put when I raise max, so that "3 rockets is low" stays true in a bigger hangar.
11. As a world author, I want captions in percent mode to still state raw coverage ("covers 0 – 3 of 10"), so that I always see what values the band actually covers.
12. As a world author with long descriptor text, I want bar labels to wrap to two lines and shrink to fit (with the full text on hover), so that the bar stays readable without dictating my prose.
13. As a world author of a Percentage-type stat, I want thresholds to just be percents with a `%` tag and no toggle, so that the one type where the readings coincide stays simple.
14. As an author of an existing 0–100 world, I want my worlds to behave identically after the update, so that the semantics fix costs me nothing.
15. As an author of a broken non-0-100 world (like rockets 3/6/10), I want my bands to start meaning what I wrote, so that the fix repairs my world without my touching it.
16. As a player, I want the AI told the status band the author intended, so that narration reflects "3 of 10 rockets is low" rather than silence.
17. As a Test Bench user, I want the start-no-descriptor finding to name both the value and where coverage begins in matching units, so that the message is actionable instead of baffling.
18. As a Test Bench user, I want a finding when a threshold sits outside the stat's min→max under its own unit mode, so that leftover percent-intent values (or typos) are caught.
19. As a world author, I want the Bench's Opening tab and AI Context to band values exactly as play will, so that design-time surfaces never disagree with the game.
20. As a mobile author, I want the section to lay out correctly at small widths, so that the bar, toggle, and rows stay usable on a phone.
21. As a world sharer, I want the stat's unit choice carried in the exported world, so that a downloaded world bands identically on the recipient's machine.

## Implementation Decisions

- **Default semantics: raw.** A stat with no unit field reads thresholds as raw values. This is a read-side reinterpretation — stored numbers are untouched, no migration runs. Evidence basis: bundled-world audit found only 0–100 ranges, where the readings are numerically identical.
- **New optional field on the stat** records the unit mode (raw vs percent-of-range). Absent = raw. Percent mode reproduces today's engine behavior. This is an **additive export-shape change** to world JSON (and flows into gameplay stats in the save envelope) — release requires the user's shape-change sign-off and rides their versioning call.
- **One banding lookup stays authoritative.** The single band-lookup function the prompts, Bench rules, and Opening instrument already share becomes unit-aware. No surface computes banding on its own.
- **A new pure module owns descriptor geometry**: band spans (from/to per descriptor), the uncovered gap, and raw↔percent conversion. The editor section and Bench rules both render from it.
- **Percent-mode math is percent of the min→max range**, `(value − min) / (max − min)`, even though the control is labeled "% of Max" — exact for the universal min-0 case, and the label is the user's call.
- **Percentage-type stats** (pinned 0–100) show a `%` unit tag and no toggle — raw and percent coincide by construction.
- **Unit switch converts in one whole-list write.** Prototype finding: converting via per-row writes in a loop loses all but the last row to stale render state; the toggle must replace the descriptor list in a single write. From the prototype, the conversion per descriptor:

  ```ts
  // to percent: round2(((raw - min) / range) * 100)
  // to raw:     round2(min + (pct / 100) * range)
  ```

- **The unit mode lives on the stat, not in component state.** Prototype finding: the section remounts on draft write-through, so component-local state forgets the mode; persisting it on the stat is both the fix and the feature.
- **Variant D layout specifics** (all verified in the prototype): bar tall enough for two-line labels; bar labels wrap to two centered lines and step font size down (12px → 8px floor) until they fit, ellipsizing past the floor with the full text as a tooltip; threshold inputs carry a permanent unit tag inside their right edge with enough right padding that values never collide, native number spinners hidden; the start marker hangs directly below the bar with its horizontal position clamped off both edges; bottom clearance under the bar is **padding, not margin** — inside a `space-y-*` container, child `mb-*` silently computes to 0 (higher-specificity space-y rule); the unit control is the app's own segmented ToggleGroup, options **Raw Unit** and **% of Max**; the add row's threshold placeholder is "Up to".
- **Bench follow-ups ship with this feature**: the start-no-descriptor message names value, units, and where coverage begins; a new rule flags thresholds outside min→max under the stat's unit mode; both read the shared geometry module.
- **Avatars are untouched.** Verified: the VRM morph pipeline reads only value/min/max/bindings — descriptors never enter morph keys or weights.
- **The prototype is throwaway.** Fold the validated design into the real section, then park the prototype file and its StatManager wiring on a throwaway branch per prototype-capture convention.

## Testing Decisions

- Tests assert **external behavior at the two pure seams**, per the user's seam sign-off:
  1. The extended band lookup: unit-aware banding cases (raw stat, percent stat, percentage type, min≠0, absent field = raw, today's-behavior parity for percent mode). Prior art: the existing band-lookup unit tests.
  2. The new descriptor-geometry module: spans, uncovered gap, boundary values at thresholds, conversion round-trips (raw→%→raw is identity within rounding), degenerate ranges (min = max).
- **UI gets one light jsdom test**: flipping the unit control performs a single whole-list conversion write (the prototype's stale-closure regression). Prior art: the existing editor jsdom harness patterns.
- Bench rule changes are tested through the existing pure rules seam, mutation-style: reintroduce each defect, watch the right finding fire with the right wording.
- Every new guard is mutation-tested (bug reintroduced, right test red, restore verified) per the standing test bar; suite time reported.

## Out of Scope

- Any migration or rewriting of stored threshold values.
- Changing the Percentage stat type, stat-code sandbox exposure, or how stat values themselves are computed.
- The avatar/VRM lane (verified untouched).
- Renaming "% of Max" to reflect min≠0 range math — flagged, user kept the label.
- The new-stat template descriptors (30/60/100 on a 0–100 default range — already correct under raw reading).
- ST lorebook / character-card import behavior.
- The unrelated Bench polish already shipped this session (description-rule split, summary savings gate, legacy-start advice).

## Further Notes

- The percent semantics trace to the upstream first commit; parity with them is preserved *as an opt-in mode* rather than the default.
- The residual risk of the raw default is a hypothetical non-0-100 world authored deliberately in percents — none found; the out-of-range Bench rule is the safety net that would surface one.
- No prompt-text changes are involved (banding changes *which* authored status is sent, not any template wording), so no probe run is required.
- Changelog: fold into the In-Progress Test Bench / editor buckets as one user-facing entry; the export-shape reminder must appear in the release notes conversation.
