# 02: Moderation popover

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Implementation Decisions › Client)

Model rationale: a contained toolbar refactor onto existing popover and filter patterns, with tests in the existing browser suites.

## What to build

In the community browser, one **Moderation** button replaces the **Quarantined** and **Show Pending** staff toggles. It is a popover trigger shaped like the **Filters** button, with a badge for how many options are on. The popover holds **Quarantined (n)** and **Show Pending** as independent options. The button always shows for staff where moderation applies. An option with a zero count is disabled, not hidden. An option that does not apply to the current tab is hidden. Behavior of each option is unchanged. On a narrow screen the button sits where the toggles sat. This is the prefactor ticket 06 adds **Flagged Likes** to, so the option list is data-driven enough to take a third entry without restructuring.

## Acceptance criteria

- [ ] Staff see one Moderation button and no separate Quarantined or Show Pending toggles; players and guests see none of it.
- [ ] Quarantined shows its count, is disabled at zero, and narrows the list as before when on.
- [ ] Show Pending behaves as before.
- [ ] Options that do not apply on the contest tab are hidden there.
- [ ] The trigger badge shows the number of options on.
- [ ] A dev-route entry opens the browser with the popover open for a staff user.
- [ ] Frames: `.scratch/frames/moderation-popover-desktop-dark.png`, `.scratch/frames/moderation-popover-desktop-light.png`, `.scratch/frames/moderation-popover-mobile-dark.png` (desktop at a realistic width, mobile at 390px).

For you: open the browser as staff and check the Moderation button reads clearly beside Filters.
