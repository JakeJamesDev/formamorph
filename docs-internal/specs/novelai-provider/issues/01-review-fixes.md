# Spec: NovelAI Provider Review Fixes

Status: done

Follow-up to `.scratch/novelai-provider/spec.md`, from the two-axis code review of the shipped provider and the grilling session that ruled on each finding. Five fixes; three declined findings are recorded under Out of Scope so they aren't re-raised.

## Problem Statement

The shipped NovelAI provider has four sharp edges a player can actually hit and one bit of dead module surface:

1. A preset using a NovelAI model id that this build's dropdown doesn't list (a future model, or one NovelAI renames) is treated as "not configured for NovelAI" — switching the preset away and back silently overwrites the player's model, sizes, and steps with the seeded defaults.
2. A preset that carried a typed endpoint URL from a previous provider (e.g. a local A1111 address) keeps it when switched to NovelAI, and generation then POSTs NovelAI's request at localhost — a confusing failure for a cloud provider whose host the player never chose.
3. Every request sends `noise_schedule: "karras"`, but the sampler mapper deliberately lets `ddim` through — a combination NovelAI's own UI never produces and the server may reject.
4. The ZIP extractor accepts `.jpg`/`.webp` archive entries while the response is always converted with a hardcoded PNG mime — a mislabeled data URL if NovelAI ever returns another format.
5. Two module exports are referenced nowhere outside the module.

## Solution

Tighten the provider and its preset seeding so switching providers never destroys NovelAI configuration, a first switch lands on the right host, the request body never pairs DDIM with a schedule NovelAI wouldn't, and the extractor only accepts what the request asked for.

## User Stories

1. As a player whose preset uses a NovelAI model this build doesn't list, I want switching providers and back to keep my model, sizes, and steps, so that trying another provider never destroys my configuration.
2. As a player switching a preset to NovelAI for the first time, I want a leftover endpoint URL from the previous provider cleared, so that generation reaches NovelAI's host instead of failing against a local server.
3. As a player who deliberately pointed a NovelAI preset at a proxy URL, I want that URL to survive switching away and back, so that clearing only happens on a genuine first switch.
4. As a player whose sampler setting resolves to DDIM, I want the request to carry the noise schedule NovelAI pairs with DDIM, so that generation succeeds instead of being rejected on a parameter technicality.
5. As a player, I want the response extractor to accept only the image format the request asked for, so that the image I get back is never mislabeled.
6. As a developer, I want the provider module to export only what other modules use, so that the module surface says what is actually shared.

## Implementation Decisions

- **Re-seed guard by prefix.** The "already configured for NovelAI" test matches model ids by the `nai-diffusion` prefix rather than membership in the hardcoded model list — the same tolerance the model dropdown already shows for unlisted ids, and the literal reading of the original decision ("isn't already a NovelAI id").
- **Endpoint joins the seed.** The NovelAI provider-switch seed sets the endpoint to blank alongside model/sizes/steps. Blank means the field shows the NovelAI host as placeholder and endpoint resolution supplies it at request time — the default stays a default, not user data. Because it rides the existing first-switch-only guard, a configured NovelAI preset (including a deliberate proxy URL) is never touched.
- **Schedule follows the sampler.** The request body sends `noise_schedule: "native"` when the resolved sampler is `ddim`, `"karras"` otherwise — mirroring NovelAI's own UI pairing. The `ddim` alias stays in the mapper.
- **Extractor narrowed to PNG.** The archive-entry match accepts only `.png` names, since the request pins `image_format: "png"` and the caller labels the bytes PNG. Fallback to the first entry when no `.png` is found stays, as does the bare-bytes path for non-ZIP responses.
- **Un-export the unused.** The V4-family predicate and the error-message builder become module-private. The request type stays exported (it is the body builder's public return type).
- **Commit as an amend** onto the unpushed provider commit — same unit, per the repo's combine-over-fragment rule — after verifying it is still unpushed.
- No world or save export-shape changes. No changelog entry: none of these behaviors ever shipped in a release, so there is nothing user-visible to record (the In-Progress entry for the provider already covers the feature).

## Testing Decisions

- Same seams as the parent spec, no new ones: pure preset functions for the switch behavior, the pure body builder for the schedule, the pure extractor for the format narrowing. Assert external behavior (given values in → values out), never internals.
- Provider-switch tests: an unlisted `nai-diffusion-*` model survives a switch untouched; a first switch clears a carried-over endpoint; a configured NovelAI preset keeps a custom endpoint.
- Body-builder tests: sampler resolving to `ddim` → `noise_schedule: "native"`; any `k_*` sampler → `"karras"`.
- Extractor test: an archive whose only image entry is non-PNG falls through to the first-entry fallback rather than matching.
- Un-exports need no test — typecheck is the gate.
- Mutation check each new guard (re-break, prove red, restore), per the repo test bar.

## Out of Scope

Declined review findings — do not re-raise:

- Renaming the local `clamp` helper (stays as-is).
- Inlining the single-entry provider-seed map (stays general).
- The fixed request-parameter block and the dev hook routing `provider` through the seeding path — both confirmed as intended behavior, not creep.
- Live verification of the DDIM/karras rejection against the real API (superseded by the native-for-ddim fix).

## Further Notes

- The endpoint-clear rides the same `isConfiguredFor` guard as the rest of the seed, so fixing the guard (prefix test) also governs when the endpoint clears — the two fixes interact and their tests should cover the combination.
- Decisions sourced from the 2026-08-24 grilling session on the two-axis review of commit `1080b0e`.
