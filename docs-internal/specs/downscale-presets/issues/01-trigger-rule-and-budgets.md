# 01: Trigger Rule and Budgets

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q2, Q3, Q5–Q7, Q9–Q12; Implementation Decisions › One trigger rule, The lossless test, Budgets, Estimate, Prompt copy)

## What to build

After this lands, an author who accepts Downscale gets lossy WebP for every lossless or PNG image in the set, whatever its size, and the four slot budgets match the art the app generates. Bundled Worlds Expansion ticket 17 reads the same rule, so its shipped worlds come out lossy the first time.

- The scan marks an image as a Downscale target when it is over its slot's long edge, over its slot's byte budget, or stored lossless: a PNG by format, a WebP by its lossless container. A JPEG under budget is never a target. Optimize's convertible rule is unchanged. Animated images keep their current handling.
- The slot table becomes thumbnail 1024 px and 200 KB, entity 1280 px and 250 KB, background 1920 px and 900 KB, map 2560 px and 1.5 MB. It stays the one source the scan, the Media tab, the Over Size Budget filter, the Test Bench size rule and the image panel read. No stored image is migrated or grandfathered.
- The Downscale estimate multiplies by about 0.1 for a lossless or PNG source and about 0.5 for a lossy one, then by the cap fit's area ratio. Both constants carry a short comment naming the 2026-10-26 measurement. The Optimize estimate is unchanged.
- The prompt names both reasons. All over budget: "N images larger than recommended". All lossless within budget: "N lossless images Downscale would shrink". Mixed: "N images worth optimizing — K larger than recommended, M lossless". The Downscale button exists whenever the scan lists a target, and its sentence names the count it will touch.
- The Map Background section of the World Editor Media help page takes the new byte number. One changelog fragment, Minor, for authors: Downscale now shrinks lossless art at any size, and the budgets changed.

## Acceptance criteria

- [x] A within-budget lossless WebP and a within-budget PNG are Downscale targets and come out as lossy WebP through the fake codec; a within-budget JPEG is left alone. Each case shown to fail once with the old rule reinstated. Verified: `imageOptim.convertible.test.ts` › Downscale targets; the oversized-only trigger turned 7 tests red, and a JPEG-counts-as-lossless mutation turned the JPEG case red.
- [x] An 832×1216 entity image keeps its size through Downscale; a 1300 px one is resampled to 1280. Each slot's byte budget flips the over-budget flag at its new value, shown in the media index suite. Verified: the convertible suite (portrait fit, per-slot flips) and `mediaIndex.test.ts` › the slot budgets; the old budget table turned 10 tests red.
- [x] The prompt offers Downscale for a lossless-only within-budget set with the lossless sentence, names both counts for a mixed set, and predicts about a tenth of the source for a lossless source, shown in the prompt hook suite. Verified: `useDownscalePrompt.test.tsx` › lossless images are Downscale targets; the old lead, the old button gate and the old 0.5 factor each turned a case red.
- [x] The Over Size Budget filter, the Over Budget badge and the Test Bench size rule agree with the scan on one world that holds an image over each new budget. Verified: `mediaIndex.test.ts` › agrees with the Over Size Budget filter, the Test Bench size rule and the scan (the badge reads the same `overBudget` flag); the old three-slot rule turned it red.
- [x] The Map Background help section states 1.5 MB, and the changelog fragment is in place with a lead that stands alone. Verified: `docs/World-Editor-Media.md` Map Background line; `docs-internal/changelog.d/downscale-presets-01.md`.

## Landed

**Not verified**
- Nothing unticked. The prompt copy was not seen in the running app; the hook suite renders the dialog in jsdom.

**For you**
- World Editor › Media › Optimize Images on a world with generated PNG or lossless WebP art: the dialog says "N lossless images Downscale would shrink", and Downscale cuts each image to tens of KB.
- Follow-up, named and not built: a world prompt for one image says "Downscale shrinks them", because world prompts always use the plural.
