# 03: Add Responsive Panes and Reliable Navigation Motion

Status: ready-for-human
Blocked by: 02
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

## Parent

[Enter World consistency spec](../spec.md).

## What to build

Players use the library comfortably across wide, portrait-tablet, and phone layouts without losing their draft. First entry, reopening the same item, and switching to every different item all show continuous detail navigation without a blank interval or flash.

Model rationale: coupled container layout, retained pane state, focus, rendering frames, and browser-level regression evidence. The prototype demonstrated that valid transform traces can miss the visible defect, so this needs deeper diagnosis and verification.

## Acceptance criteria

- [x] Implement three stages based on actual container width: Categories beside split list/details; collapsed Categories above split panes; collapsed Categories above a full-width list or detail pane with Back.
- [x] Start with C's 72rem dialog threshold for Categories and 44rem library threshold for split panes. Keep layout and navigation tied to the same decisions; verify both sides of each threshold with long names, descriptions, and supported fonts.
- [x] Keep category disclosure usable and continuation reachable. No horizontal page overflow, clipped primary action, or inaccessible library content at wide, portrait-tablet, or phone sizes.
- [x] Preserve choices, complete order, search, inspected identity, and surviving scroll positions through resize. Back restores list position; normal clamping when content stops overflowing is acceptable.
- [x] Retain both panes. In narrow mode, details slide from the right over an opaque surface while the list shifts left by one quarter of its width. Back reverses the 200ms movement. Wide panes carry no residual offscreen transforms.
- [x] Prepare replacement content offscreen before entry. Support first opening, same-item reopening, different dictionaries, and entity/dictionary switches in both directions. Cancel pending entry work on replacement or unmount, and handle resizing during navigation without stale callbacks or artificial fixed delays.
- [x] Focus enters the detail heading and returns to the opener without scrolling the animation container. Supply a visible fallback if the opener is absent. Inactive panes remain inert and excluded from accessibility navigation.
- [x] Reduced motion skips sliding while retaining the same selection, Back, focus, and visibility outcomes. Exercise this preference in a real browser.
- [x] Extend the existing real Enter World browser flow with repeated first/same/different-item sequences, differing detail heights, long descriptions, loaded artwork, missing artwork, and actual scroll overflow.
- [x] Verify intermediate visible frames and readable content throughout entry/exit. A blank interval or immediate content flash fails, even if transition durations, transforms, and final coordinates look correct. Capture visual evidence alongside focus and scroll; do not certify motion from DOM position traces alone.
- [x] Reintroduce the focus-scroll defect and a replacement-content transition defect to demonstrate the regression checks catch the failure mechanism. Do not replace these with tests of implementation details or shorten content to avoid the trigger.
- [x] Recheck dark/light themes and alternate palette/font inheritance with the responsive composition. Preserve the themed scroll areas and complete ordering behavior from 02.
- [x] Complete applicable project gates and report wall-clock test times. Record browser evidence and any remaining visual limits; the prototype's staged-entry experiment is a reference, not proof that production painting is correct.

## Scope boundary

Only 02 blocks this work: its production list/detail flow supplies the panes and state to adapt. 01's control alignment is independent. Preserve existing Introduction, Avatar, Cancel, saved additions, and finalization behavior; do not broaden into unrelated editor or gameplay changes.

## Comments

- Browser evidence: the real Enter World flow passed across desktop and mobile (5 passed, 5 intentionally skipped by project, 54.7s). The strengthened motion case separately passed in 16.8s with three screenshots across first entry and exit, plus screenshots for same-item, replacement, entity/dictionary, and reduced-motion states. Live preview checks covered wide, portrait-tablet, and phone containers in dark and light Purple/Lexend themes.
- Motion traces sample every animation frame for pane coverage, opacity, readable heading content, and continuous travel. Browser screenshots provide the compositor evidence at multiple intermediate points; exact raster classification at every display refresh remains a human review surface rather than an automated assertion.
- Mutation checks proved both guards: removing `preventScroll` failed the browser motion evidence in 20.50s, and bypassing the staged replacement entry failed the component test in 2.56s. Both defects were restored before the green runs.
- Final gates: typecheck 18.72s; lint 15.64s with 0 errors and 2 existing Fast Refresh warnings in `SaveList.tsx`; 8,634 tests passed and 3 skipped in 64.30s; production build completed in 20.70s. `graphify update .` completed with exit code 0.
