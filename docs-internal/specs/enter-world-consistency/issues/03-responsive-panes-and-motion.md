# 03: Add Responsive Panes and Reliable Navigation Motion

Status: ready-for-agent
Blocked by: 02
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

## Parent

[Enter World consistency spec](../spec.md).

## What to build

Players use the library comfortably across wide, portrait-tablet, and phone layouts without losing their draft. First entry, reopening the same item, and switching to every different item all show continuous detail navigation without a blank interval or flash.

Model rationale: coupled container layout, retained pane state, focus, rendering frames, and browser-level regression evidence. The prototype demonstrated that valid transform traces can miss the visible defect, so this needs deeper diagnosis and verification.

## Acceptance criteria

- [ ] Implement three stages based on actual container width: Categories beside split list/details; collapsed Categories above split panes; collapsed Categories above a full-width list or detail pane with Back.
- [ ] Start with C's 72rem dialog threshold for Categories and 44rem library threshold for split panes. Keep layout and navigation tied to the same decisions; verify both sides of each threshold with long names, descriptions, and supported fonts.
- [ ] Keep category disclosure usable and continuation reachable. No horizontal page overflow, clipped primary action, or inaccessible library content at wide, portrait-tablet, or phone sizes.
- [ ] Preserve choices, complete order, search, inspected identity, and surviving scroll positions through resize. Back restores list position; normal clamping when content stops overflowing is acceptable.
- [ ] Retain both panes. In narrow mode, details slide from the right over an opaque surface while the list shifts left by one quarter of its width. Back reverses the 200ms movement. Wide panes carry no residual offscreen transforms.
- [ ] Prepare replacement content offscreen before entry. Support first opening, same-item reopening, different dictionaries, and entity/dictionary switches in both directions. Cancel pending entry work on replacement or unmount, and handle resizing during navigation without stale callbacks or artificial fixed delays.
- [ ] Focus enters the detail heading and returns to the opener without scrolling the animation container. Supply a visible fallback if the opener is absent. Inactive panes remain inert and excluded from accessibility navigation.
- [ ] Reduced motion skips sliding while retaining the same selection, Back, focus, and visibility outcomes. Exercise this preference in a real browser.
- [ ] Extend the existing real Enter World browser flow with repeated first/same/different-item sequences, differing detail heights, long descriptions, loaded artwork, missing artwork, and actual scroll overflow.
- [ ] Verify intermediate visible frames and readable content throughout entry/exit. A blank interval or immediate content flash fails, even if transition durations, transforms, and final coordinates look correct. Capture visual evidence alongside focus and scroll; do not certify motion from DOM position traces alone.
- [ ] Reintroduce the focus-scroll defect and a replacement-content transition defect to demonstrate the regression checks catch the failure mechanism. Do not replace these with tests of implementation details or shorten content to avoid the trigger.
- [ ] Recheck dark/light themes and alternate palette/font inheritance with the responsive composition. Preserve the themed scroll areas and complete ordering behavior from 02.
- [ ] Complete applicable project gates and report wall-clock test times. Record browser evidence and any remaining visual limits; the prototype's staged-entry experiment is a reference, not proof that production painting is correct.

## Scope boundary

Only 02 blocks this work: its production list/detail flow supplies the panes and state to adapt. 01's control alignment is independent. Preserve existing Introduction, Avatar, Cancel, saved additions, and finalization behavior; do not broaden into unrelated editor or gameplay changes.
