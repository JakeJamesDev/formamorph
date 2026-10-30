# 08: Allowance Experience

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: UI and state wiring on top of ticket 07's preset; copy and timing rules matter more than new mechanics.

**What to build:** a Supporter always knows how much allowance is left and is never surprised by the cap. The AI settings show percent used and about-turns-left, updated after each turn. Two notices warn at the configured thresholds after a turn commits. At the cap, a message names the reset date and offers one click back to the last other preset and a link to upgrade. The first time a device sees an entitlement, it switches to Formamorph AI once.

- [ ] The AI settings show tier, percent used, about-turns-left (labeled "about") and the reset date, updated from the final usage event.
- [ ] Each threshold notice shows once per month per account, only after a turn commits, never during a stream, and is acknowledged on the server.
- [ ] The exhausted state names the reset date, switches back to the recorded previous preset in one click, and links to upgrade.
- [ ] On first entitlement on a device, the app selects Formamorph AI once, records it locally with the previous preset, and never switches again on that device.
- [ ] Dev-route entries exist for both notices and the exhausted state; frames in both themes: `.scratch/frames/fai-usage-light.png`, `.scratch/frames/fai-warning-dark.png`, `.scratch/frames/fai-exhausted-light.png`.
- [ ] Copy follows the Writing Guide; the help line for the usage display passes the copy sweep.
- [ ] The wiki page for AI setup describes Formamorph AI and its allowance without any numbers.

For you: read the notice and exhausted copy in play and judge the timing of the notices.
