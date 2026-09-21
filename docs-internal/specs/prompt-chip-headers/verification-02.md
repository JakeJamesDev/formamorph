# Header Coverage Verification

Scope: [ticket 02](issues/02-offer-headers-on-every-prompt-chip.md). All 22 registered prompt-variable families use the shared Header path. Placeholder Chips and built-in prompt conversion remain outside this ticket.

## Registry inventory

| Capability | Families |
| --- | --- |
| Existing body formats | Stats, Traits, Persona, Location, Entities |
| Header-only Format | World, Notes, Dictionary, Length Guidance, Markdown Guidance, Active Character Guidance, Player Action, Narration, Character, Subject, Time, In Frame, Language, First Passage, Later Material, Remembered Moments, New Moments |

Header-only Format is placement metadata inside the existing prompt string, such as `<NOTES|format=xml|header="player notes">`. It is excluded from the body's lookup key and does not create body variants. Omitting Format means Simple. Clearing Header retains the metadata.

**Compatibility:** older parsers do not recognize the extended tokens. Export-envelope shapes, application version, and existing custom prompts are unchanged. No migration is added.

## Behavior and visual evidence

- Registry-driven tests exercise every family and every existing raw-body variant. Exact output includes authored line breaks, markup, and XML entities; representative XML is parsed without changing its body.
- Imported presets with Markdown, XML, and Simple style metadata initialize a new Header at Simple. Production JSON and share codes retain cleared Header's remembered Format.
- Shared rendering, gameplay narration assembly, and request-anatomy runs agree. Known empty values omit sections; missing values preserve unresolved tokens.
- Both real editing screens exercise headed Notes alongside Persona: conditional boundaries, editing, clipboard, persistence, ordinary/blank-line dragging, cancellation, self-drop rejection, and undo/redo.
- Dictionary exercises hidden Format across save/reopen, clipboard, and Background/Foreground changes. World JSON round trips retain both headed and cleared raw-body placements.
- The production Prompt Chips reference includes Notes with an XML Header and disabled options in read-only mode.

Static screenshots use 1280 × 860 desktop and 375 × 812 mobile viewports, light/dark themes, and the Lexend font. Evidence is under `.scratch/prompt-headers/{settings,world}-Notes-{light,dark}-{desktop,mobile}.png`; the checked-in browser suite reproduces it. The authority is the Design System's conditional prompt text pattern and production Prompt Chips reference.

Copy review retains established Header, Format, Simple, Markdown, and XML labels. These are existing application terms; no new functional hint is introduced. The sweep reports existing affix/placeholder copy and typography debt outside the changed lines. Terminology and label formatting were reviewed; complete ASD-STE100 certification remains outside this verification.

## Regression checks

The initial new suite failed 36 checks in **2.39 s**; the implementation passed 244 targeted checks in **2.55 s**. The World editor test exposed a misleading empty-options message in **3.62 s**; the corrected six-test editor suite passed in **3.55 s**.

Each mutation changed production code, ran the focused regression suite, and restored the original bytes. Every mutation exited 1 with the intended failures.

| Reintroduced defect | Failures | Wall time |
| --- | --- | --- |
| Forget Format when Header changes | Restore and persistence | 2.61 s |
| Drop Format when Dictionary variant changes | Hidden Format lifecycle | 2.66 s |
| Initialize Format as XML | Simple defaults | 2.39 s |
| Ignore Header-only Format during rendering | Exact output and gameplay parity | 2.72 s |
| Show Format while Header is absent | Control availability | 2.67 s |
| Omit Format from token serialization | Rendering and persistence | 2.48 s |
| Replace Subject with literal split/join | All three image-subject request cases | 1.42 s |

## Measured coverage

The targeted coverage run passed **638 tests in 43 files**, exit 0, in **17.76 s**.

| Changed module | Lines | Branches | Functions |
| --- | --- | --- | --- |
| promptVariables | 99.58% | 94.87% | 100% |
| chipVocabulary | 98.53% | 90.80% | 82.75% |
| promptTemplate | 100% | 98.33% | 100% |
| VariableNode | 95.27% | 87.50% | 89.06% |
| imagePrompt | 100% | 70% | 100% |

The reference component is exercised in the real browser rather than the unit coverage run. Native dragging, clipboard permissions, and layout are browser assertions. No built-in AI instructions changed, so model probes are outside this slice.

## Final gates

| Gate | Result | Wall time |
| --- | --- | --- |
| Typecheck | 0 errors, exit 0 | 17.71 s |
| Lint | 0 errors, one existing WorldOverviewManager refresh warning, exit 0 | 16.18 s |
| Full unit suite | 745 files passed; 12,307 tests passed, 3 skipped; exit 0 | 119.93 s |
| Production build | Success, exit 0; existing chunk-size and externalization warnings | 22.72 s |

The gates use the package scripts' executables through the bundled Node runtime. The initial full run took 134.69 s and failed three changelog subprocess tests with `spawnSync node EPERM`; placing bundled Node first on PATH fixed the environment. The focused changelog suite passed 14 tests in 1.68 s before a complete green rerun in 129.78 s. After the review correction, the final runner reports 119.31 s and 432.14 s of summed test execution across 12 workers, without an idle exit tail.

Browser verification covers **27 passing cases and five intentional mobile skips** across the main and corrected focused runs. The main run passed 23 cases in 332.08 s but exposed four setup failures in the new Dictionary checks. The first corrected lifecycle run passed both desktop cases in 69.72 s; static screenshots identified a chip receiving the setup click on mobile and an options-close/save race. The final focused run passes all six executed cases in **49.97 s**, including expanded cleared-Header drag/history checks; two pointer cases skip on mobile. The existing five skips cover native pointer dragging and viewport-independent world serialization on mobile; each runs on desktop.

The setup now focuses the actual editable surface before replacement and waits for chip options to close before finding the full-screen exit. It preserves the Header-clear, save, restore, clipboard, and variant assertions. Production code needed no browser-driven changes.

Graphify completed its AST refresh: **14,406 nodes, 43,598 edges**. It reports the existing Gradle extraction warnings. Version, settings defaults, export envelopes, and Placeholder Chip behavior are untouched. The existing unreleased Header changelog entry is expanded to cover every prompt-variable chip.

## Closing review

- **Standards:** no documented violations or actionable baseline smells, including the follow-up below.
- **Spec:** one functional gap found and resolved. Subject offered Header but its image-tag request builder replaced only the literal `<SUBJECT>` token. That builder now uses the shared renderer.
- The request-level regression failed for all three subject kinds before the fix (**1.53 s**). All 11 image-prompt tests then passed with coverage (**4.00 s**). Reintroducing split/join failed the expected three cases (**1.42 s**); original bytes were restored and checked.
- The reviewer confirmed the correction and found no other direct-substitution bypass among the registered raw-variable families. Default image-prompt instructions remain byte-identical, verified for each subject kind; no model instructions were edited.
