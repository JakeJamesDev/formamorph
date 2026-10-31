# Spec: Supporter Tier Names

Status: ready-for-agent
Status note: The tier names themselves are open. The user sets them in Patreon; release blocker 04 holds the release until then.

The app and site show each Supporter tier by the name it has in Patreon, and every line about support reads as a donation. Rulings from the spec session on 2026-10-31 (Q1–Q4).

## Problem Statement

The three tiers show working labels ("Supporter", "Supporter+", "Supporter++") from one hardcoded map. A rename in Patreon does not reach the app, so the names can drift. Some copy also reads like a paid service ("Upgrade", "Tier"). Support is a donation, and the perks are a thank-you.

## Rulings

- **Q1:** Tier names come from Patreon. The app and site show each tier's Patreon title. A rename in Patreon needs no build. The internal tier keys (`supporter`, `supporter_plus`, `supporter_top`) and the tier-ID env vars stay as they are; budgets, windows and flair stay keyed on them.
- **Q2:** The fallback name is **Member**, the word Patreon uses. It shows whenever no title is known: offline, before the first answer, or for a tier Patreon did not return.
- **Q3:** Names and copy follow the idea of supporting, not tiers of a service. Allowances read as a thank-you ("your support includes"), never as a plan or a purchase.
- **Q4:** No release ships until the user has decided the names and set them in Patreon (release blocker 04).

## Solution

**Server.** The server reads each tier's `title` from Patreon (Tier resource, "Tier display title") and keeps the names by tier key. It refreshes them on the hourly reconcile and on a tier webhook. A public route returns `{ supporter, supporter_plus, supporter_top }`, each a string or `null`. The route never calls Patreon on a request.

- Patreon v2 returns no attribute unless `fields[tier]=title` asks for it. The campaign call with `include=tiers` is the primary path, because it names tiers with no members. A live check on 2026-10-31 returned all three titles from it. A failed or title-less campaign call falls back to `fields[tier]=title` on the members call the reconcile already makes, and that answer renames only the tiers it lists.
- An unknown or empty title is `null`, never a guess.

**Client and site.** One module owns tier names. It reads the route once per session, keeps the last answer in local storage, and returns **Member** for a tier with no known name. A tier the server answers `null` for keeps its cached name. Every place that shows a tier name reads it from that module. The hardcoded label map goes. Flair colors, icons and sort order stay keyed on the tier key.

**Copy.** A sweep finds every player-facing line about support, tiers or the allowance, in the app, the site and `docs/`. Each line reads as a donation and follows the Writing Guide. Wording a player sees for the first time goes to the user for approval.

## Testing

- Server: the route returns the stored names, `null` for an unknown tier, and makes no Patreon call. The refresh stores titles from a Patreon reply and keeps the old names when Patreon fails.
- Client: the module returns the server's name, the cached name when offline, and **Member** with no answer and no cache. A type check fails if any call site keeps the old map.
- Prove each guard by removing it once.

## Out of Scope

- Choosing the names. The user sets them in Patreon.
- Renaming internal tier keys or env vars.
- Tier prices and allowances (Formamorph AI spec).

## Further Notes

- Origin: [Formamorph AI](../hosted-ai/spec.md) ticket 02, which shipped the working labels.
- Release blocker: [04](../release-blockers/issues/04-supporter-tier-names.md).
- No export shape changes.
