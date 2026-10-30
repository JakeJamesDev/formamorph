# 02: Moderation popover

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Implementation Decisions › Client)

Model rationale: a contained toolbar refactor onto existing popover and filter patterns, with tests in the existing browser suites.

## What to build

In the community browser, one **Moderation** button replaces the **Quarantined** and **Show Pending** staff toggles. It is a popover trigger shaped like the **Filters** button, with a badge for how many options are on. The popover holds **Quarantined (n)** and **Show Pending** as independent options. The button always shows for staff where moderation applies. An option with a zero count is disabled, not hidden. An option that does not apply to the current tab is hidden. Behavior of each option is unchanged. On a narrow screen the button sits where the toggles sat. This is the prefactor ticket 06 adds **Flagged Likes** to, so the option list is data-driven enough to take a third entry without restructuring.

## Acceptance criteria

- [x] Staff see one Moderation button and no separate Quarantined or Show Pending toggles; players and guests see none of it. (pinnedReview tests "replaces the two toggles for staff", "shows nothing to a player or a guest")
- [x] Quarantined shows its count, is disabled at zero, and narrows the list as before when on. (tests "shows the Quarantined count", "disables Quarantined at zero", "shows no group in the Quarantined view"; the disabled guard bites when reinstated)
- [x] Show Pending behaves as before. (the existing Show Pending suite passes through the popover)
- [x] Options that do not apply on the contest tab are hidden there. (contest test: no Moderation button)
- [x] The trigger badge shows the number of options away from their default (spec-session ruling). (tests "carries no badge in the default view", "badges the options away from their default"; the default guard bites)
- [x] A dev-route entry opens the browser with the popover open for a staff user. (`#dev?modal=community&fixture=moderation`, read in the preview)
- [x] Frames: `.scratch/flagged-likes-02/frames/moderation-popover-desktop-dark.png`, `.scratch/flagged-likes-02/frames/moderation-popover-desktop-light.png`, `.scratch/flagged-likes-02/frames/moderation-popover-mobile-dark.png` (desktop at 1280 wide, mobile at 390px).

For you: open the browser as staff and check the Moderation button reads clearly beside Filters.

## Landed

**Not verified**
- None. The dev fixture has no quarantined listing, so the frames show Quarantined at (0), disabled; the count and AND-narrowing are covered by tests only.

**For you**
- Open the browser as staff and check the Moderation button reads clearly beside Filters.
- Spec-session rulings built in: the badge counts options away from default; Show Pending disables (not hides) while Quarantined is on; the whole button hides on the contest tab until ticket 06. Ticket 06 must stop gating the mobile wrapper on `staffHere` when Flagged Likes applies on contest.
- The rows are hand-built in the popover, not `CheckRow`: that row is a two-column settings grid and does not fit a 256px popover.
