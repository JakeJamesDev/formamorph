# Built-In Header Adoption Verification

Scope: [ticket 03](issues/03-adopt-headers-in-built-in-prompts.md), starting at `9f278115`. The audit covers all 30 built-in templates and converts 72 placements. Narrative instructions and sampler settings are unchanged.

## Adoption inventory

Each entry below names the raw Header stored on the placement. All three built-in styles derive their heading presentation from that value.

| Template | Count | Converted sections |
| --- | ---: | --- |
| systemPrompt | 13 | Game World; Background Lore; Player Stats; Traits; Player Character; Important Player Notes; Current Location; Sublocations; Reachable Locations; Characters and things that may appear in this location; Characters and things that may appear in a sub-location; Characters and things that may appear in a reachable location; Foreground Lore |
| choicesPrompt | 11 | Game World; Player Stats; Traits; Player Character; Player Notes; Current Location; Sublocations; Reachable Locations; the three Characters and things sections listed above |
| statUpdatesPrompt | 3 | Game World; Traits; Player Notes |
| locationChangePromptText | 2 | Current Location; Where The Player Can Go |
| thinkingPrompt | 10 | Game World; Traits; Player Character; Current Location; Sublocations; Reachable Locations; the three Characters and things sections; Important Player Notes |
| directorPrompt | 10 | Same sections as thinkingPrompt |
| characterPrompt | 6 | Game World; Traits; Player Character; Current Location; Sublocations; Reachable Locations |
| storyboardPrompt | 8 | Game World; Player Stats; Traits; Player Character; Current Location; Sublocations; Reachable Locations; Important Player Notes |
| sceneTagsPrompt | 1 | The passage calls this person you |
| choicesUserPrompt | 1 | The scene just told to me, the player character |
| summaryUserPrompt | 1 | The narration that resulted |
| directorUserPrompt | 1 | What just happened |
| openingTimeUserPrompt | 1 | The opening scene |
| timePassedUserPrompt | 2 | What the character did; What happened |
| sceneTagsUserPrompt | 2 | In the picture; What happens |

The other 15 templates contain no standalone single-chip section to convert: narrationUserPrompt, recapUserPrompt, rehydrateUserPrompt, oocDirectivePrompt, summaryPrompt, diaryPrompt, statUpdatesUserPrompt, locationChangeUserPrompt, milestoneSelectPrompt, milestoneSelectUserPrompt, nowLinePrompt, timePassedPrompt, openingTimePrompt, discoverEntityPrompt, and discoverEntityUserPrompt.

### Retained authored content

- Guidelines, Output, response contracts, and explanatory prose remain authored sections. Stat Updates' Player Stats section includes instructions plus its chip, so its heading stays authored.
- Inline framing such as `Narration: <NARRATION>` and the player's action sentences remains literal text. A chip inside a sentence is not a standalone section.
- First Passage, Later Material, and Remembered Moments carry body-owned framing from their producers; adoption adds no second heading around those values.
- Planning and Director retain the Persona Append sentence, “In the Cast, this is Player Character.” Heading-only Persona affixes are removed.
- An intent check with the originating spec task confirmed these boundaries, including converting standalone user-message labels.

## Rendering, persistence, and gameplay

The new [built-in regression suite](../../../src/lib/builtinPromptHeaders.test.ts) renders every template in Simple, Markdown, and XML. Each adopted placement gets populated, blank, whitespace-only, and N/A cases, heading uniqueness checks, and request-run tiling checks. Raw bodies stay intact; existing Name behavior remains covered by the shared Header suites.

Representative generated XML is parsed with `DOMParser`. Tests verify Traits and Player Character as siblings, authored/generated transitions with Persona present or absent, and intentional custom parent nesting. Built-in style conversion closes authored peers outside conditional chips, so an absent value cannot swallow a closing tag.

[Anatomy tests](../../../src/lib/anatomyPreview.test.ts) use current styled defaults through every production request hub and all thinking modes. They verify complete run coverage and the exact current Choices user message. Narration additionally compares production gameplay assembly against the shared renderer with real Persona and lore context.

The full suite exposed a lore activation regression: decorated Location/Entities placements no longer matched their context keys. [Dictionary scanning](../../../src/lib/dictionaryScan.ts) now resolves the body key before lookup and deduplication. The existing opening-scene lore test passes without changing its scenario.

Historical replay retains its recorded requests and exact assertions. With the user's approval, its five original user-message templates are explicit snapshots in [parityTestInputs](../../../src/lib/turnPipeline/parityTestInputs.ts); current defaults remain separately tested through production builders.

Production preset storage, JSON sharing, and share-code sharing round-trip native Headers and legacy custom text unchanged. **Export-envelope shapes and application version are untouched. Header-bearing shared prompts require an updated parser; older versions do not understand the extended token syntax.** No saved custom content is rewritten and no migration is added.

## Browser verification

The real Settings prompts verify every built-in style's protected Header/Format options, generated headings and XML closing tags, and editable copies. World Editor pastes actual built-in Persona/Notes tokens, edits Header and Format, saves/reopens them, and exercises desktop drag plus undo/redo.

All **16 new browser cases passed in 96.41 s**. Earlier shared reference/drag checks passed **10 cases with four mobile pointer-drag skips in 63.65 s**. Static evidence covers 1280 × 860 desktop and 375 × 812 mobile in both themes. Screenshots were reviewed for generated highlighting, disabled versus editable options, and clipping.

Reproduce with [prompt-headers.spec.ts](../../../e2e/prompt-headers.spec.ts). Screenshots are local artifacts under `.scratch/header-adoption/builtin-{preset}-{theme}-{viewport}.png` and `world-{theme}-{viewport}.png`. The unchanged production Prompt Chips reference remains consistent with these controls.

The first browser attempts exposed a clipboard fixture issue: Windows pastes CRLF. The fixture now supplies those actual clipboard bytes and retains exact persistence assertions. A sandbox teardown could not stop its own Vite child; the final run permitted normal subprocess cleanup and exited successfully, with no process-hang workaround added to the app.

The user identified a description-size mismatch in the screenshots. Header's shared `Hint` now uses the same compact 11px styling as the surrounding Prepend/Append description. Four browser checks passed in **21.09 s**, confirming identical font family, 11px size, and 16.5px line height in both themes and viewports; the shared production reference uses the same component.

The user also identified the native scrollbar on tall chip popovers. The popover now uses the shared `ScrollArea`, with a bounded flex viewport, reserved gutter, and rounded theme-derived thumb. A mobile regression failed against the native scroller in **26.37 s**; all four final desktop/mobile and light/dark checks passed in **22.26 s**. They verify actual overflow, viewport bounds, wheel scrolling, mobile touch scrolling, keyboard focus reveal, and persistence after editing the bottom Append field. The first wheel-only verification passed in **23.12 s**. Screenshots are `.scratch/header-adoption/scroll-{theme}-{viewport}.png`.

Copy review keeps existing Header/Format terminology and folds adoption into the unreleased Header entry. The copy sweep's existing notices are outside these edits.

## Model probes

The user selected cloud `default` plus local `cydonia-24b-v4.3@q4_k_m`. [The probe](../../../testing/baseline/harness/header-adoption-probe.mjs) captures actual production request builders, styles, context generation, anatomy runs, token limits, and sampler pins. It sends `reasoning_effort: "none"`; narration leaves sampling unpinned. Cases are the committed Sedge Landing `carry-forward-all` and `drop-who-leaves` scenarios, covering narration, planning, and choices.

Cloud used **12 samples per case per arm**, interleaved before/after: **144 calls in 144.25 s**. Cydonia used **two samples per case per arm**: **24 calls in 72.78 s**. Paired seeds begin at 1701. Two additional identical local requests returned byte-identical text in **6.13 s**. Cloud seeds are not treated as deterministic.

| Metric / case | Cloud before → after | Cydonia before → after |
| --- | --- | --- |
| Nonempty / all six cases | 72/72 → 72/72 | 12/12 → 12/12 |
| Token-limit truncation / all cases | 0/72 → 0/72 | 0/12 → 0/12 |
| Choices contract / both cases | 24/24 → 24/24 | 4/4 → 4/4 |
| Planning cast / carry-forward | 12/12 → 12/12 | 2/2 → 2/2 |
| Planning cast / departure | 0/12 → 0/12 | 0/2 → 0/2 |
| Planning Beats marker / both cases | 24/24 → 24/24 | 4/4 → 4/4 |
| Narration quoted dialogue / carry-forward | 12/12 → 12/12 | 2/2 → 2/2 |
| Narration quoted dialogue / departure | 1/12 → 1/12 | 1/2 → 1/2 |
| Narration bold / carry-forward | 0/12 → 0/12 | 0/2 → 0/2 |
| Narration bold / departure | 0/12 → 0/12 | 1/2 → 1/2 |
| Narration menu leakage / both cases | 0/24 → 0/24 | 0/4 → 0/4 |

Words are whitespace-delimited words, not estimated tokens. Intervals below are 10,000 paired bootstrap resamples of after-minus-before differences.

| Narration case / model | Mean words before → after | Difference, 95% bootstrap interval |
| --- | --- | --- |
| Carry-forward / cloud | 25.33 → 18.50 | −6.83 [−15.17, −1.08] |
| Departure / cloud | 61.42 → 57.75 | −3.67 [−18.67, 10.58] |
| Carry-forward / Cydonia | 141 → 137 | −4 [−19, 11] |
| Departure / Cydonia | 154 → 135 | −19 [−63, 25] |

All binary metrics above have observed difference zero. The cloud departure dialogue difference interval is [−0.25, 0.25]; the other observed binary intervals collapse to [0, 0] because their paired samples do not vary. These empirical intervals do not establish zero population risk, especially with two local samples.

**Limits:** cloud narration is measurably shorter in the carry-forward case. No minimum length contract was added or changed, and dialogue remains present. Both arms on both models fail the departure-cast expectation; this is an existing planning-quality gap, left outside Header adoption. The quote metric does not distinguish NPC speech from the player's speech. Choices checks cover 3–5 first-person lines of at most 25 words, not every semantic aspect of a choice. These probes support regression comparison on this corpus, not broad narrative-quality claims.

The first probe batch was discarded after finding a stale planning cue and nonproduction planning/choices caps in the harness. The results above use corrected production requests only. Request snapshots, full outputs, and metric details remain local in `.scratch/header-adoption/{production-before,production-after,cloud-production,local-production,metrics}.json`.

## Regression evidence and gates

| Reintroduced production defect | Expected failures | Wall time |
| --- | --- | --- |
| Duplicate ordinary Game World heading | 4 | 2.34 s |
| Ignore native Header at XML peer boundaries | 2 | 2.38 s |
| Drop raw chip Header Format | 16 | 2.32 s |
| Look up decorated lore token directly | 1 | 2.14 s |
| Remove stat-name completion input | 1 | 3.33 s |

Every mutation exited 1 and restored original source bytes. Historical replay and PromptDiff assertions remain exact. The focused current request suite passed 99 tests in 2.50 s after correcting its new test's expected title casing and typed tab iteration.

Measured coverage across 231 focused tests (5.02 s): `sectionStyle.ts` 100% lines/functions, 98.24% branches; `dictionaryScan.ts` 100% lines/functions, 95.65% branches; `GamePrompts.ts` 96.38% lines, 100% functions, 87.5% branches. The uncovered GamePrompts lines are unchanged guidance code. The new adoption/template paths are exercised; no inferred coverage claim replaces these measurements.

After the popover corrections, 24 shared Header/affix tests passed in **7.17 s**. Their focused `VariableNode.tsx` coverage is 78.29% lines, 83.52% branches, and 69.84% functions; broader chip operations are outside that focused measurement. Real layout and scrolling are verified in the browser suite above.

Final typecheck passed in **16.75 s**. Lint passed with zero errors in **14.53 s**, retaining the existing WorldOverviewManager fast-refresh warning. The final full suite passed **12,409 tests**, with three skipped, in **101.18 s** (exit 0). Vitest reported 100.44 s elapsed and 774.85 s summed across parallel test workers; there was no idle shutdown tail. The preceding full run before the scrollbar follow-up also passed in **99.33 s**.

The final production build passed in **18.69 s** with the existing large-chunk warning. No new `any`, lint-disable, version change, or export-envelope change was added. The unreleased changelog includes Header adoption, the probe, and both popover corrections.

The AST-only graph refresh completed with 14,412 nodes and 43,677 edges. Its three Gradle parsing warnings concern unchanged Android build files.

The first full suite found the lore regression and historical-template mismatches (97.91 s). A subsequent full run passed 12,408 tests but exposed a pre-existing autocomplete synchronization race (95.22 s): the test accepted a stale completion popup before stat-name suggestions arrived. The exact Stamina assertion now waits for the asynchronous result; no completion data or scenario was removed. The 38-test CodeArea suite passed in isolation in 7.45 s, and removing production stat-name inputs still makes the corrected assertion fail.

## Closing review

The plugin's independent Standards and Spec reviews compared this unit against `9f278115`.

| Axis | Result |
| --- | --- |
| Standards | No actionable documented-standard breaches or baseline code smells. No additional test run. |
| Spec | No missing, partial, incorrect, or unrequested behavior requiring changes. Independently passed 209 focused tests in 2.10 s. |

The ticket is ready for human review. Model quality limitations above remain explicit; no prompt tuning was added to address them.
