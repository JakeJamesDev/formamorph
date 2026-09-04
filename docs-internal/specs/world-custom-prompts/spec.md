# Custom Prompts — per-world authored Narration, Choices, and Stats prompts

Status: done

## Problem Statement

A world can currently author only a custom Narration prompt. The Choices and Stat Updates passes always run on the player's prompt preset, so a world with a strong unique flavor (tone, genre, mechanical conventions) cannot carry that flavor into the choices it offers or the way stats are adjudicated. Authors who want it must ask players to hand-edit their global settings.

Additionally, the existing narration override freezes a copy of the default prompt into the world the moment the checkbox is enabled. If the underlying default or the author's preset later improves, the world silently keeps running a stale snapshot the author never actually wrote.

## Solution

Expand the world's prompt overrides from Narration-only to Narration, Choices, and Stats, edited in a single "Custom Prompts" section of the World Editor: three segmented tabs, each with an enable checkbox rendered inside the tab chrome so all three states are visible at a glance.

Each tab shows the *live* current prompt (the active preset's value) as an unstored template. Nothing is written into the world until the author actually diverges from it — first edit freezes the text as the world's override. A per-tab Reset button (with confirmation) discards the stored override and returns the tab to live tracking, so an author is never stuck editing from scratch or copy-pasting from settings.

At play time each enabled, stored prompt wholesale-replaces the corresponding preset system prompt, exactly as the narration override does today. Players see a kind-aware notice on the world-details screen, can view the authored prompts in a tabbed read-only dialog, and can decline all of them with the existing single per-world opt-out.

## User Stories

1. As a world author, I want to write a custom Choices prompt, so that the choices offered to players match my world's tone and conventions.
2. As a world author, I want to write a custom Stats prompt, so that stat adjudication follows my world's mechanical flavor.
3. As a world author, I want the existing custom Narration prompt to keep working unchanged, so that my already-published worlds behave identically.
4. As a world author, I want the three prompts presented as segmented tabs under one "Custom Prompts" heading, so that the editor stays compact instead of stacking three large fields.
5. As a world author, I want each tab's enable checkbox inside the tab chrome itself, so that I can see which prompts are enabled without visiting each tab.
6. As a world author, I want checking a tab's checkbox to also switch to that tab, so that I immediately see the prompt I just enabled.
7. As a world author, I want clicking elsewhere on a tab to only select it, so that browsing tabs never toggles enablement by accident.
8. As a world author, I want a newly opened tab to show the active preset's current prompt as my starting template, so that I edit from what the game actually runs rather than a blank box.
9. As a world author, I want an unedited template to keep tracking the live prompt, so that my world never silently freezes a stale copy I didn't write.
10. As a world author, I want my first real edit to store the text as the world's override, so that my authored prompt travels with the world from that point on.
11. As a world author, I want a Reset button on each tab, so that I can discard my override and return to live tracking without re-entering settings or copy-pasting.
12. As a world author, I want Reset to ask for confirmation, so that I never lose authored text to a stray click.
13. As a world author, I want to draft a prompt while its checkbox is off, so that I can prepare text before switching it on; a muted note tells me it is not applied until enabled.
14. As a world author, I want disabling a checkbox to keep my authored text, so that toggling a prompt off is reversible.
15. As a world author, I want the placeholder-chip prompt editor in every tab, so that I can use the same variables the preset prompts use, per prompt kind.
16. As a world author, I want the Custom Prompts section only in Advanced editor mode, so that the simple authoring flow stays uncluttered.
17. As a world author, I want any stored custom prompt (any kind) to force-detect Advanced mode, so that my authored prompts are never hidden from me.
18. As a world author, I want my enabled custom prompts included in the exported world file, so that players receive my full authored flavor.
19. As a world author, I want an enabled-but-unedited tab to export nothing, so that my world file contains only prompts I actually wrote.
20. As a world author, I want the editor find bar to reach the Custom Prompts fields, so that search-driven navigation still lands on them.
21. As a player, I want the world-details notice to name which prompt kinds a world customizes, so that I know what I'm opting into before playing.
22. As a player, I want to view a world's authored prompts in a read-only tabbed dialog, so that I can inspect them before deciding.
23. As a player, I want one checkbox to decline all of a world's custom prompts, so that opting out stays a single simple decision.
24. As a player, I want my opt-out remembered per world on my device only, so that my preference persists without altering the world.
25. As a player, I want an enabled custom prompt to fully replace the preset's system prompt for that pass, so that authored worlds behave predictably and consistently with today's narration behavior.
26. As a player, I want passes without a stored override to keep using my preset, so that a world customizing only Choices leaves my narration and stats prompts alone.
27. As a player, I want the opening scene and every later turn to agree on the resolved prompts, so that a session never mixes overridden and preset prompts for the same pass.
28. As a player with an old world file, I want it to load and play unchanged, so that the new fields' absence is simply "no overrides."

## Implementation Decisions

- **Storage**: the world overview's existing prompt-overrides object gains sibling keys mirroring the preset field vocabulary — `choicesPrompt`/`choicesPromptEnabled` and `statUpdatesPrompt`/`statUpdatesPromptEnabled` — beside the untouched narration keys (`systemPrompt`/`systemPromptEnabled`). Additive export-shape change; no migration. The overview normalizer already passes the whole object through.
- **Semantics** (identical across all three kinds): enabled + stored text ⇒ wholesale replacement of the preset's system prompt for that pass. Disabled, absent, or blank ⇒ preset applies. Only *system* prompts are overridable; the paired user-message prompts stay preset-only.
- **No-freeze model**: the editor renders the active preset's current prompt as an unstored live template. First divergence stores the text (the freeze). Reset clears the stored text and returns to live tracking. The enabled flag is only exported alongside stored text; enabled-but-unedited is externally indistinguishable from "no override" (no export, no player notice).
- **Resolution seam**: the world-prompt domain module generalizes over a prompt-kind key (narration / choices / stat-updates) — one resolver, one stored-text accessor, one has-override predicate, parameterized by kind. The consuming view resolves once per kind and feeds the same resolved values to *both* consumption paths (the turn pipeline's prompt bundle and the direct per-pass request sites) so they cannot disagree.
- **Editor UI**: one "Custom Prompts" section in the world-details manager, Advanced mode only. Segmented tabs Narration / Choices / Stats following the existing tabbed-section pattern in the same manager. The enable checkbox is rendered within each tab trigger's chrome as a sibling interactive element (never a nested button — invalid HTML). Checkbox click toggles and selects; tab click selects only. Unchecked tabs show the editor fully editable with a muted "not applied until enabled" note. Each tab carries a Reset button gated by a confirmation.
- **Advanced-mode detection** extends to any stored prompt of any kind.
- **Player surface**: world-details notice enumerates the customized kinds; the read-only viewer dialog gains tabs showing enabled kinds only; the existing single per-world opt-out (device-local, never exported) now declines all kinds at once — its storage shape is unchanged.
- **Prompt text**: no default prompt text changes ship with this feature — it is plumbing, so no A/B probe run is required.
- **Behavior change to note**: the narration tab adopts the no-freeze model and the editable-draft disabled state, replacing today's freeze-on-enable seeding and hidden-when-disabled field. Worlds with already-stored narration text are unaffected.

## Testing Decisions

- Good tests here assert external behavior: given an overview and a preset prompt, which string does a pass run on; given author interactions, what ends up stored in the world. No assertions on internal call structure or component internals.
- **World-prompt domain module** (primary seam): pure-function tests over the kind-parameterized resolver — per kind: disabled/absent/blank/opt-out fall back to preset; enabled+stored replaces; narration legacy shapes (flag absent = enabled) still honored. Extends the module's existing test file.
- **World-details manager component tests** (existing seam and prior art): tab chrome checkbox states visible at a glance; checkbox click toggles and selects; tab click selects only; live template shown unstored; first edit stores; Reset confirms then clears back to live tracking; disabled tab remains editable with the note; Advanced-mode gating.
- **No new seams.** The consuming view (the monolith) and the main-menu notice/viewer are verified live via the dev-router with static/DOM evidence, per the project's UI verification bar. The known residual risk is wiring drift between the two consumption paths — mitigated structurally by resolving once and passing the same values, and noted for live verification (a world overriding only Choices must affect the choices request and nothing else).
- Existing tests that assert narration-only behavior (manager, domain module, data-context allowlist, editor-mode detection) update to the generalized behavior rather than being deleted.

## Out of Scope

- Overriding user-message prompts, or any pass beyond Narration, Choices, and Stat Updates (planning, presence, entities, memory, etc.). The overrides object accepts future keys without shape rework.
- Per-kind player opt-out granularity.
- Append/merge semantics — replacement only.
- Any change to default prompt text, prompt presets, or per-world preset pinning.
- Version bump, changelog finalization, or migration of shipped worlds (none needed; the change is additive).

## Further Notes

- Export-shape reminder: this adds fields to the exported world JSON (additive). The user has been informed and accepted; narration keys are unchanged so old worlds load as-is.
- The editor needs the active preset's resolved prompt values (settings-aware) for the live template and Reset source — the same values the game would run right now, not the shipped defaults.
- Changelog: 👤 Added entry in the In-Progress bucket when implemented.
