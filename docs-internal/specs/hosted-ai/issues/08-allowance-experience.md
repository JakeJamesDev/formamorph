# 08: Allowance Experience

Status: ready-for-human
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: UI and state wiring on top of ticket 07's preset; copy and timing rules matter more than new mechanics.

**What to build:** a Supporter always knows how much allowance is left and is never surprised by the cap. The AI settings show percent used and about-turns-left, updated after each turn. Two notices warn at the configured thresholds after a turn commits. At the cap, a message names the reset date and offers one click back to the last other preset and a link to upgrade. The first time a device sees an entitlement, it switches to Formamorph AI once.

- [x] The AI settings show tier, percent used, about-turns-left (labeled "about") and the reset date, updated from the final usage event. (hostedAllowance.test: usage copy; DOM read of `fixture=fai-ready`; the usage event writes the numbers the block reads)
- [x] Each threshold notice shows once per month per account, only after a turn commits, never during a stream, and is acknowledged on the server. (hostedNotices.test: once, the higher of two, nothing below 75%, nothing without a hosted call; hostedAllowance.test: ack posts and the server list is kept; the call sits after `applyTurnCommit` in GameViewer, by reading)
- [x] The exhausted state names the reset date, switches back to the recorded previous preset in one click, and links to upgrade. (hostedNotices.test: Switch Back and Upgrade clicks; SettingsContext.allowance.test: back to the recorded preset, Demo AI when it is gone; DOM read of `fixture=fai-exhausted`)
- [x] On first entitlement on a device, the app selects Formamorph AI once, records it locally with the previous preset, and never switches again on that device. Per the spec session, it waits while the state is exhausted and leaves the flag unset. (SettingsContext.allowance.test: switch, no second switch, exhausted wait, no tier)
- [x] Dev-route entries exist for both notices and the exhausted state (`fixture=fai-notice-75`, `fai-notice-90`, `fai-notice-exhausted`, `fai-exhausted`); frames in both themes: `.scratch/frames/fai-usage-light.png`, `.scratch/frames/fai-warning-dark.png`, `.scratch/frames/fai-exhausted-light.png`.
- [x] Copy follows the Writing Guide; the help line for the usage display passes the copy sweep, and so does ticket 07's preset state copy (it landed unswept). (checked by hand against the Writing Guide; hostedCopy.ts reworded)
- [x] The wiki page for AI setup describes Formamorph AI and its allowance without any numbers. (docs/Connect-Your-Own-AI.md)

For you: read the notice and exhausted copy in play and judge the timing of the notices.

## Landed

**Not verified**
- A full turn against a real server: every check ran against fake routes. The notices after a real commit were not seen in play.
- The `copy-sweep` skill was not run; the copy was checked by hand against the Writing Guide.
- The frames are 800-wide captures of the Browser pane, not desktop width: `.scratch/hosted-ai-08/frames/fai-usage-light.png`, `.scratch/hosted-ai-08/frames/fai-warning-dark.png`, `.scratch/hosted-ai-08/frames/fai-exhausted-light.png`.

**For you**
- Read the notice and exhausted copy in play and judge the timing of the notices.
- The warning thresholds (75 and 90) are a client constant in `src/lib/hostedAi/hostedAllowance.ts` that duplicates the server config. The server should expose them in the hosted state (the spec session is raising it).
- A notice fires only for a turn whose Formamorph AI call reported usage. A turn on another preset raises none.
