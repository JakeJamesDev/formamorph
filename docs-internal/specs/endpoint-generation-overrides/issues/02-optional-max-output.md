# 02: Make Endpoint Max Output Optional

Status: in-progress

**Parent:** [Endpoint Generation Overrides](../spec.md)

**What to build:** Players can disable an external endpoint's Max Output override and let the server choose its output limit. Disabling it also removes its context reservation and derived response-length guidance, while short internal calls keep their own caps.

**Blocked by:** 01 — Configure Endpoint Sampler Overrides.

## Acceptance criteria

- [ ] Max Output gains an independent override switch on external endpoint configurations, including hosted Default, using the endpoint persistence and control pattern established in ticket 01.
- [ ] Disabling the override shows Endpoint default and retains its number through reload and endpoint changes. The remembered number has no effect while disabled.
- [ ] Settings created before this feature retain their existing Max Output values as enabled overrides, including hosted Default's existing cap. Their sampler overrides remain off.
- [ ] Newly created endpoint configurations start all six overrides off, even when connection values are copied from another endpoint. Distinguish new creation from loading existing settings so compatibility logic cannot re-enable new overrides.
- [ ] Max Output resolves as explicit internal call cap, then enabled target endpoint override, otherwise omission. An internal cap wins outright rather than being clamped to the endpoint value.
- [ ] With the endpoint override off and no internal cap, the outgoing request omits the output-limit field rather than sending null or a substitute cap.
- [ ] With Max Output off, narration removes the context reserve and length guidance derived from that setting. No hidden estimate or additional response-budget control replaces them.
- [ ] The context-window limit itself, unrelated prompt instructions, and short internal call caps remain in force. Built-in engine output and reasoning behavior remain unchanged.
- [ ] Re-enabling the override restores its cap, reservation, and derived guidance from the remembered value.
- [ ] Live narration preparation and Request Anatomy agree with the effective target settings. A per-prompt endpoint route does not borrow the selected endpoint's limit.
- [ ] The request description identifies whether a sent output cap came from an internal call or the endpoint override, supporting ticket 03 without misattribution.
- [ ] Tests through actual request construction, existing settings operations, and narration/Turn Pipeline interfaces prove on/off behavior, compatibility, new creation, routing, re-enabling, and internal caps. Use a realistic context-boundary case to prove the reserve is removed while context-window management still works.
- [ ] Live preview checks verify the switch and retained value on custom endpoints and hosted Default using the existing dev route and static/DOM evidence.
- [ ] Treat removal of generated length guidance as a prompt behavior change: follow the prompt-writing guide and record before/after probe evidence on both required model tiers, at least two runs per case, objective metrics, and other-metric regression checks.
- [ ] Typecheck, lint, tests, and build pass; report test wall time, measure relevant coverage, and prove guards fail when the protected behavior regresses. Update the code graph and appropriate In Progress changelog entry.

## Scope notes

The dependency is the reusable endpoint override persistence, UI, routing, and source attribution introduced by ticket 01. Removing the reserve is an explicit product decision; do not substitute an internal reserve. No world/save migration, export-shape change, or version bump.
