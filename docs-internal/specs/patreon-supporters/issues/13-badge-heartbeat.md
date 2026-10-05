# 13: Badge Heartbeat

Status: done
Status note: Built in d295cad7 and aed24e0a; the spec-session review added the tab stop. Playwright: 8 checks across desktop and mobile.
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Ruling Q18; Implementation Decisions › Flair display)

Model rationale: one keyframe, one component, and a once-per-load rule. The proof is Playwright frame sampling, which is the known part.

## What to build

The heart on a Supporter badge beats once when the badge first appears on the page, and beats again while the pointer or keyboard focus is on the badge. At rest nothing moves. Each account's badge beats on arrival once per page load: scrolling a list so the same row mounts again does not beat it again.

## Acceptance criteria

- [x] One CSS keyframe draws the beat on the icon only: scale up and back, two pulses, under 700 ms. The pill and the text do not move.
- [x] The badge takes a key for the account (the author ID, or the username where no ID exists). A module-level set records the keys that already beat this page load. A badge with a seen key mounts still.
- [x] Hover and focus-visible beat the heart with the same keyframe, every time.
- [x] `prefers-reduced-motion: reduce` skips the arrival beat. The hover beat stays.
- [x] The shared name component passes the key. The showcase passes sample keys so the reference beats once too.
- [x] jsdom tests: a first mount carries the arrival class, a second mount with the same key does not, a different key does; reduced motion leaves the class off. Each guard bites when its rule is removed.
- [x] Playwright: a per-frame sample of the icon's transform shows a change in the first 700 ms after mount, no change in the next second, and a change again on hover. The Browser pane cannot prove motion.
- [x] A changelog line in In Progress, folded into the Supporter Flair entry while it is unreleased.
- [x] Four gates green.

## Hand-over

Built in `d295cad7` (beat, once-per-load set, reduced motion, Playwright sampling) and `aed24e0a` (softer second pulse). The spec-session review found that keyboard focus never reached the badge, which has no tab stop and sits outside the name button; the fold-in gives the badge `tabIndex={0}` with the shared inset focus ring, a jsdom test, and a Playwright check that a keyboard Tab beats the heart.

Expected, not a bug: two badges for the same account in one render both beat, because the arrival set is written in an effect. The user ruled that this is the intended behavior.
