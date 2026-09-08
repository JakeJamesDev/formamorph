# 02: Replace sequential setup with the unified workspace

Status: ready-for-human
Blocked by: 01
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

## Parent

[Enter World spec](../spec.md); [accepted prototype record](../prototype.md). Visual primary source: `prototype/enter-world` at `16d6c0b9`.

## What to build

Normal Enter World opens a production workspace where players directly select trait categories and starting locations, consult Introduction, and finish setup without walking through trait-group Next/Back steps. Use the retained draft from 01. Existing library screens temporarily remain the continuation until 03 replaces them.

Model rationale: the accepted design is concrete, but hierarchy, trait semantics, and entry integration need careful implementation and browser verification.

## Acceptance criteria

- [x] Use one compact desktop navigation column and wide content area, with app typography/color tokens and active-row styling. Header contains world name, Introduction, and quieter Cancel; the primary action remains reachable outside content scrolling.
- [x] Render arbitrary-depth authored trait hierarchy permanently expanded. Preserve authored order, show container-only groups as noninteractive labels, omit empty branches/General, and keep deeply nested names usable.
- [x] Groups with direct traits open those traits even when they also have children. No branch chevrons, collapse behavior, breadcrumbs, secondary group browser, or nested tab sequence.
- [x] Show bare direct selected/available ratios such as 1/3, with accessible explanations. No visible Selected/Folder labels or container-only counts. Update counts immediately.
- [x] Exclusive traits use independent radios and preserve replacement and click-again deselection. Other traits use checkboxes. Row and indicator activation each toggle exactly once; there is no Clear choice button.
- [x] Preserve authored defaults, trait/group descriptions, stat-effect previews, ordering, and resolved placeholder text. Keep ancestor descriptions accessible even for noninteractive groups.
- [x] Provide Starting Location with existing Random, eligibility, and fallback rules. Select a meaningful initial category and handle zero-choice worlds without empty destinations.
- [x] Introduction reopens without changing the draft or visibility preference. Preserve automatic Introduction, Avatar handoff/return, session cancellation, Quick Start, and save-load behavior from 01.
- [x] Until 03 lands, label continuation accurately when an existing library screen remains; do not claim the game will start immediately if more setup screens will open. Returning from that continuation retains the workspace draft. Worlds without library steps finish normally.
- [x] Keep narrow screens functional through the shared responsive structure; final phone disclosure treatment belongs to 05. No prototype samples, development controls, or simulated game-start behavior enter production.

## Verification

- Through real MainMenu, configure a nested world, switch trait/location categories, reopen Introduction, and finish through the actual continuation. Assert retained draft and game-start output.
- Cover empty groups, mixed groups, five-level nesting, descriptions/stat effects, radio replacement/deselection, counts, and placeholder Pin changes using existing seams.
- Inspect the real desktop workspace in both themes with long text and keyboard controls. Keep tests with this behavior slice; time runs and prove regression guards fail when reverted.

## Scope boundary

Library workspace content and persistent defaults belong to 03/04. Phone-specific visual and accessibility completion belongs to 05. Avatar editor and Quick Start redesign remain out of scope.

## Comments

### Implementation verification

- Normal Enter World now opens one responsive setup dialog with an always-expanded authored trait hierarchy, direct selection ratios, trait details/stat effects, Starting Location, Introduction, Cancel, and a fixed continuation action.
- Real MainMenu tests cover retained traits, location, library selections, dictionary order, Avatar return, Placeholder Session Pins, Introduction reopening, exclusive replacement/deselection, direct start, cancellation, Quick Start, and delayed or duplicate resolution.
- Focused coverage ran 24 tests in 18.6 seconds: `enterFlow.ts` 100% statements/branches/functions/lines; `EnterWorldWorkspace.tsx` 100% statements/lines, 96.3% branches, and 94.7% functions; the broader MainMenu integration was 64.8% statements and 59.7% branches.
- Three deliberate regressions failed their intended tests: requiring both traits and locations before opening setup, dropping pure-container hierarchy branches, and canceling the native radio event that makes browser click-again state diverge. Each mutation was restored before the consolidated focused suite passed 24 tests in 13.2 seconds.
- Live MainMenu verification covered dark and light themes at desktop size plus 390×844. Long content wrapped, the footer action stayed reachable, pointer and keyboard radio changes worked, Introduction preserved the draft, and category/location selections remained intact.
- Final review fixed duplicated hierarchy traversal and rewrote the release-note lead in player language. The reported Introduction stacking concern was ruled out by the MainMenu integration test and live browser verification: Introduction appears alone first, then the workspace opens after it closes.
- Final gates: typecheck passed in 13.76 seconds, lint passed in 11.73 seconds, all 8,550 tests passed in 51.67 seconds, and the production build passed in 15.44 seconds. Graphify refreshed the code graph.
- Export shapes and the app version are unchanged. Library workspace replacement, persistent defaults, and final phone navigation remain outside this ticket.
