# Endpoint Generation Overrides

Status: ready-for-agent

## Problem Statement

Players can tune generation settings on the built-in engine, but external cloud and locally hosted endpoints do not expose the same endpoint-level controls. Players need to override selected settings without replacing the server's defaults for everything else, and tuning one endpoint must not affect another.

Some prompt-specific tuning already applies to external endpoints. The new controls must fit that behavior rather than unexpectedly replacing specialized prompt settings.

## Solution

Expose independently enabled overrides on each user-created external text endpoint configuration: Temperature, Repetition Penalty, Top P, Top K, Min P, and Max Output. The hosted Default keeps its intentional fixed Max Output cap. Keep the built-in engine's existing explicit controls.

An override retains its numeric value while disabled. Disabled sampler controls display **Endpoint Default**, which describes the endpoint-level fallback; prompt-specific tuning and internal call caps still take priority. A disabled Max Output override displays **No Limit**: Formamorph omits `max_tokens` rather than resolving a default limit. Settings follow the endpoint actually selected for each request.

If a server explicitly rejects a value supplied by an enabled endpoint override, show the failure, disable that override for that endpoint, and retain its value. The player decides when to retry.

## User Stories

1. As a player using a cloud endpoint, I want generation controls in its settings, so that I can tune its responses from Formamorph.
2. As a player using a locally hosted endpoint, I want the same controls, so that I can tune it without changing the server's global defaults.
3. As a player using hosted Default, I want its intentional Max Output cap to remain fixed, so that shared-endpoint request budgets cannot be disabled or changed.
4. As a player, I want an independent switch for each setting, so that I can override one value while leaving others to their defaults.
5. As a player, I want a Temperature override, so that I can adjust response variability.
6. As a player, I want a Repetition Penalty override, so that I can adjust repetition handling.
7. As a player, I want a Top P override, so that I can tune probability-based token selection.
8. As a player, I want a Top K override, so that I can tune the candidate-token count.
9. As a player, I want a Min P override, so that I can tune the relative probability threshold.
10. As a player, I want a Max Output override, so that I can choose whether Formamorph sends an endpoint-level output cap.
11. As a player, I want disabled overrides to remember their values, so that temporary changes do not erase my tuning.
12. As a player, I want disabled sampler controls to show Endpoint Default and Max Output to show No Limit, so that a remembered number is not presented as an active override or a known server default.
13. As a player using multiple endpoint configurations, I want tuning saved separately for each, so that changes do not leak between them.
14. As a player routing prompts to different endpoints, I want each request to use its target's overrides, so that the globally selected endpoint cannot supply the wrong tuning.
15. As a player with custom prompt tuning, I want it to retain priority, so that endpoint settings do not replace deliberate prompt-specific choices.
16. As a player using built-in prompt tuning, I want specialized prompt values preserved, so that endpoint-level controls do not change their existing behavior.
17. As an existing player, I want my current endpoint output caps preserved on upgrade, so that installing the feature does not silently remove them.
18. As a player creating an endpoint, I want all six overrides initially disabled, so that tuning is opt-in.
19. As a player disabling Max Output, I want its request cap, context reservation, and derived length guidance removed, so that its remembered number no longer influences generation preparation.
20. As a player, I want short internal calls to keep their own output caps, so that disabling an endpoint cap does not remove purpose-specific limits.
21. As a player using the built-in engine, I want its existing controls preserved, so that this external-endpoint improvement does not change its setup.
22. As a player whose server rejects an override, I want to see the failure and which override was disabled, so that I can understand the change before retrying.
23. As a player receiving a generic server error, I want my settings preserved, so that an unrelated failure cannot reset my tuning.
24. As a player receiving a rejection of prompt-specific tuning, I want unrelated endpoint switches preserved, so that the app does not disable a setting that did not supply the rejected value.
25. As a player, I want control over retrying a failed request, so that disabling an override does not automatically replay a turn or incur another request.

## Implementation Decisions

### Endpoint settings and persistence

- Store an enabled state and remembered numeric value for each of the six overrides per external endpoint configuration. Keep tuning separate from the prompt preset's existing custom sampler values.
- Hosted Default gains persisted sampler tuning while its connection details remain fixed. Its intentional Max Output cap is fixed and cannot be changed or disabled.
- Preserve existing user endpoint Max Output values as enabled overrides when reading settings created before this feature. Initialize the five new sampler overrides as disabled.
- Newly created endpoint configurations start with all six overrides disabled, even when the existing creation flow copies connection values from the selected endpoint. Seed remembered numbers from existing central defaults or copied values; do not claim they are the server's actual defaults.
- Persist values and switches across endpoint selection and reload. Disabling a switch manually or following rejection never erases its number.
- This is an endpoint-settings storage extension. No world/save export-shape change, prompt-preset sharing change, or application version bump is part of this feature.

### Request resolution

Resolve every setting against the request's actual target, including per-prompt routing. Extend the existing AI Request Spec rather than adding another request construction path.

| Setting | Precedence, highest first |
| --- | --- |
| Temperature and Repetition Penalty | Enabled prompt custom value → built-in prompt-specific value → enabled endpoint override → omit field |
| Top P, Top K, Min P | Enabled endpoint override → omit field |
| Max Output | Explicit internal call cap → shared endpoint fixed cap or enabled user-endpoint override → omit field |

- Omitting a sampler field lets the server choose its behavior; do not send a null, remembered value, or substituted Formamorph default for an inactive endpoint override. Omitting `max_tokens` means only that Formamorph sends no cap; the endpoint may still enforce one.
- Keep existing per-prompt controls and built-in prompt-specific values. Do not add per-prompt Top P, Top K, or Min P controls.
- Preserve the current built-in engine resolution and reasoning behavior.
- Max Output remains a fallback for internal calls, not a ceiling imposed over their explicit caps.
- Retain the existing request parameter conventions, including repetition-penalty aliases. Rejection handling must map either alias to its owning override without confusing a prompt-supplied value with an endpoint-supplied value.
- Carry enough per-request target identity and value-source information to attribute a rejection to the endpoint configuration and override that actually supplied it. Do not infer ownership merely because a switch happens to be enabled.

### Max Output and narration

- When the external endpoint's Max Output override is disabled, omit its output cap, remove the context-space reserve derived from it, and remove response-length guidance derived from it.
- Do not substitute a hidden estimate or add a response-budget control. The remembered number has no effect while this override is off.
- Keep the context-window limit itself, unrelated prompt instructions, and short internal call caps. Removing this reserve does not disable all context management.
- Re-enabling Max Output restores the existing cap, reservation, and derived guidance using the remembered value.
- Keep live narration preparation and Request Anatomy consistent with the effective settings.

### Rejected overrides

- Preserve useful server rejection information through AI Stream's error boundary so the consumer can surface the failure and identify explicitly rejected parameters.
- Automatically disable only an enabled endpoint override that supplied the rejected request value and that the server explicitly identifies as rejected. Persist the disabled state for the actual target and retain the numeric value.
- Surface which override was disabled. Do not automatically retry the request or replay the turn.
- Generic HTTP errors, ambiguous responses, authentication failures, and network failures do not authorize changing settings. A parameter name merely appearing in an error is not proof that the parameter was rejected.
- Rejections of prompt-specific values or explicit internal call caps do not disable endpoint overrides; surface the failure without guessing.
- Preserve existing failure/partial-output behavior outside the explicitly rejected override handling. Keep settings mutations in the consuming settings layer, not inside AI Stream.

## Testing Decisions

Test observable behavior through existing interfaces, using the highest existing interface that proves each contract. Do not add another Turn Pipeline injection point or tests that duplicate the resolver's implementation.

| Existing interface | Observable proof |
| --- | --- |
| AI Request Spec, exercised through request construction and captured transport requests | Exact field presence/absence and values for all six switches; prompt precedence; explicit internal caps; target-specific routing; unchanged built-in behavior |
| Endpoint preset/settings operations and settings UI | Independent toggles; retained values; reload persistence; hosted Default tuning; existing-settings compatibility; new-endpoint defaults; isolation between configurations |
| AI Stream with controlled fetch responses, plus its settings consumer | Explicit rejection surfaces an error and disables only its owning endpoint override; numeric value survives; no automatic second request; generic and prompt-specific failures leave switches unchanged |
| Narration preparation and existing Turn Pipeline integration | Max Output off removes its reserve and derived guidance as well as its request field; other context limits and internal caps remain; re-enabling restores existing behavior |

- Prior art: the current AI Request Spec tests already cover sampler omission, built-in prompt values, custom precedence, routing, and call-level caps. Extend those observable contracts.
- The AI Stream tests already inject fetch responses and scripted streams. Exercise rejection bodies at that boundary and verify persistence through the real settings consumer rather than testing an error parser alone.
- Endpoint preset tests cover initialization and mutation; narration prompt and Turn Pipeline tests cover assembled prompts and call limits. Reuse these interfaces instead of creating a parallel test-only resolver.
- Include independent mixed switches, legitimate zero sampler values, routed requests whose target differs from the selected endpoint, and rejection cases where an endpoint override is enabled but masked by prompt tuning.
- Test both repetition-penalty spellings and failures that identify a parameter without actually rejecting it. Ensure a settings selection change during an in-flight request cannot disable the wrong endpoint's override.
- Verify settings controls in the live preview through the existing dev route at a realistic viewport, using DOM/static evidence and keyboard interaction. Confirm disabled labels and values, hosted Default behavior, and endpoint switching.
- Measure coverage and prove guards fail when their protected behavior is removed. Use meaningful recovery scenarios; do not suppress the triggering failure to make tests pass.
- Implementation completion requires typecheck, lint, tests, and build to pass, with test wall time reported; update the code graph and append the appropriate In Progress changelog entry.
- Removing generated length guidance is an AI-call prompt behavior change. Apply the project's prompt-writing/probe requirements during implementation, with before/after evidence across both required model tiers, repeated cases, objective metrics, and regression checks.

## Out of Scope

- Additional sampler types or new per-prompt sampler controls.
- Override switches on the built-in engine.
- Changing built-in prompt-specific values, reasoning controls, or unrelated prompt content.
- Fetching or discovering the server's numeric defaults, automatic capability probing, or a provider-adapter redesign.
- Automatic retries, turn replay, or guessing which setting caused a generic error.
- A separate output-budget estimate control or hidden reserve while Max Output is disabled.
- Changes to world/save exports, migrations of shipped worlds/saves, prompt-preset sharing, or application versioning.

## Further Notes

- The product behavior was confirmed through the design interview. In particular, removing the output reserve is intentional: when Max Output is off, the player accepts that more context can be used without Formamorph reserving room for the response from that setting.
- Endpoint Default is a sampler fallback, not an assertion that no prompt-level value will be sent. Explain the precedence in the settings help rather than adding repeated explanatory text to AI requests.
- Preserve the accepted Turn Pipeline architecture: the request adapter and derivation callback remain its two interfaces for injected behavior.
