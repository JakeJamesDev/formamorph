# 02: Replace sequential setup with the unified workspace

Status: ready-for-agent
Blocked by: 01
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

## Parent

[Enter World spec](../spec.md); [accepted prototype record](../prototype.md). Visual primary source: `prototype/enter-world` at `16d6c0b9`.

## What to build

Normal Enter World opens a production workspace where players directly select trait categories and starting locations, consult Introduction, and finish setup without walking through trait-group Next/Back steps. Use the retained draft from 01. Existing library screens temporarily remain the continuation until 03 replaces them.

Model rationale: the accepted design is concrete, but hierarchy, trait semantics, and entry integration need careful implementation and browser verification.

## Acceptance criteria

- [ ] Use one compact desktop navigation column and wide content area, with app typography/color tokens and active-row styling. Header contains world name, Introduction, and quieter Cancel; the primary action remains reachable outside content scrolling.
- [ ] Render arbitrary-depth authored trait hierarchy permanently expanded. Preserve authored order, show container-only groups as noninteractive labels, omit empty branches/General, and keep deeply nested names usable.
- [ ] Groups with direct traits open those traits even when they also have children. No branch chevrons, collapse behavior, breadcrumbs, secondary group browser, or nested tab sequence.
- [ ] Show bare direct selected/available ratios such as 1/3, with accessible explanations. No visible Selected/Folder labels or container-only counts. Update counts immediately.
- [ ] Exclusive traits use independent radios and preserve replacement and click-again deselection. Other traits use checkboxes. Row and indicator activation each toggle exactly once; there is no Clear choice button.
- [ ] Preserve authored defaults, trait/group descriptions, stat-effect previews, ordering, and resolved placeholder text. Keep ancestor descriptions accessible even for noninteractive groups.
- [ ] Provide Starting Location with existing Random, eligibility, and fallback rules. Select a meaningful initial category and handle zero-choice worlds without empty destinations.
- [ ] Introduction reopens without changing the draft or visibility preference. Preserve automatic Introduction, Avatar handoff/return, session cancellation, Quick Start, and save-load behavior from 01.
- [ ] Until 03 lands, label continuation accurately when an existing library screen remains; do not claim the game will start immediately if more setup screens will open. Returning from that continuation retains the workspace draft. Worlds without library steps finish normally.
- [ ] Keep narrow screens functional through the shared responsive structure; final phone disclosure treatment belongs to 05. No prototype samples, development controls, or simulated game-start behavior enter production.

## Verification

- Through real MainMenu, configure a nested world, switch trait/location categories, reopen Introduction, and finish through the actual continuation. Assert retained draft and game-start output.
- Cover empty groups, mixed groups, five-level nesting, descriptions/stat effects, radio replacement/deselection, counts, and placeholder Pin changes using existing seams.
- Inspect the real desktop workspace in both themes with long text and keyboard controls. Keep tests with this behavior slice; time runs and prove regression guards fail when reverted.

## Scope boundary

Library workspace content and persistent defaults belong to 03/04. Phone-specific visual and accessibility completion belongs to 05. Avatar editor and Quick Start redesign remain out of scope.
