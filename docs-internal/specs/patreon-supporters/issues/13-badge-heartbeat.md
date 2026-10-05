# 13: Badge Heartbeat

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Ruling Q18; Implementation Decisions › Flair display)

Model rationale: one keyframe, one component, and a once-per-load rule. The proof is Playwright frame sampling, which is the known part.

## What to build

The heart on a Supporter badge beats once when the badge first appears on the page, and beats again while the pointer or keyboard focus is on the badge. At rest nothing moves. Each account's badge beats on arrival once per page load: scrolling a list so the same row mounts again does not beat it again.

## Acceptance criteria

- [ ] One CSS keyframe draws the beat on the icon only: scale up and back, two pulses, under 700 ms. The pill and the text do not move.
- [ ] The badge takes a key for the account (the author ID, or the username where no ID exists). A module-level set records the keys that already beat this page load. A badge with a seen key mounts still.
- [ ] Hover and focus-visible beat the heart with the same keyframe, every time.
- [ ] `prefers-reduced-motion: reduce` skips the arrival beat. The hover beat stays.
- [ ] The shared name component passes the key. The showcase passes sample keys so the reference beats once too.
- [ ] jsdom tests: a first mount carries the arrival class, a second mount with the same key does not, a different key does; reduced motion leaves the class off. Each guard bites when its rule is removed.
- [ ] Playwright: a per-frame sample of the icon's transform shows a change in the first 700 ms after mount, no change in the next second, and a change again on hover. The Browser pane cannot prove motion.
- [ ] A changelog line in In Progress, folded into the Supporter Flair entry while it is unreleased.
- [ ] Four gates green.
