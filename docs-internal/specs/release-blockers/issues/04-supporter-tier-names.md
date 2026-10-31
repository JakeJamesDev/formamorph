# 04 — Supporter tier names are not decided

Type: task
Status: needs-info
Blocks: release

## Problem

The three Patreon tiers have no final names. The app shows working labels ("Supporter", "Supporter+", "Supporter++") from `SUPPORTER_LABELS` in `src/lib/supporterFlair.ts`.

Origin: [Formamorph AI](../../hosted-ai/spec.md), ticket 02. The code work is the [Supporter Tier Names](../../supporter-tier-names/spec.md) effort.

## Rulings (2026-10-31)

- Tier names come from Patreon. The app and site show each tier's Patreon title, so a rename in Patreon needs no build. Internal tier keys stay fixed.
- The fallback name is "Member", the word Patreon uses, for when no title is known.
- Names follow the idea of supporting, not tiers of a service. Copy treats the support as a donation; allowances read as a thank-you, never as a plan.
- The user leans toward story roles (Wanderer, Storyteller, Lorekeeper) or fire and growth (Spark, Ember, Hearth). Not decided.

## Clears when

- The user has set final tier names in Patreon.
- The app and site read tier names from Patreon, with "Member" as the fallback.
- A copy sweep finds no wording that frames support as payment for a service.
