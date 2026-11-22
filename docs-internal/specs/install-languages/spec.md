# Spec: Install Languages

Status: ready-for-agent

Both repos: the client sends, the server counts. Tickets carry a `Repo:` line for the server half. This extends **Active Installs** (`docs-internal/specs/active-installs/spec.md`) and changes none of its rules.

## Problem Statement

We want to translate Formamorph into one more language, and we cannot tell which one would help the most players. Cloudflare's country totals include scanners and datacenter traffic. A check of the France numbers showed that most of its 648 hits were not players. Country is also a weak guide to language. Nothing we collect shows the language of the people who actually open the app, or which players already play in a language other than English.

## Solution

The Daily Send carries two more values: the **Device Language** and the **AI Language**. The server keeps them on the daily row and reports them as their own breakdown, per day and per month, apart from the platform and version split.

- **Device Language** is the device's preferred language, as language plus region (`pt-BR`, `fr`, `zh-TW`). It shows potential reach.
- **AI Language** is the player's AI Language setting, mapped to the setting's suggestion list as a language code. Blank and English count as `en`. Anything else typed, a style included, counts as `other`. It shows who already plays in that language with an English UI.
- Nothing else changes: the same once-a-day send, the same age gate, the same off switch, the same month key and Month Close.
- The privacy policy names the two new values.

## User Stories

1. As an admin, I want each day's active installs split by Device Language, so that I can see which languages the player base speaks.
2. As an admin, I want each month's active installs split by Device Language, so that I can compare months.
3. As an admin, I want the same day and month splits by AI Language, so that I can see who already plays in a language other than English.
4. As an admin, I want `pt-BR` and `pt-PT`, and `zh-CN` and `zh-TW`, counted apart, so that I know which translation a market needs.
5. As an admin, I want the language splits kept apart from the platform and version split, so that the rows stay few.
6. As an admin, I want an install that changes language during a day or month to count once, under the first language it sent, so that the language totals add up to DAU and MAU.
7. As an admin, I want a language value that is not a well-formed code counted as `unknown`, so that junk never adds new rows.
8. As an admin, I want to read the language splits on the Usage tab beside the existing breakdown.
9. As a player, I want the send to hold my device language and my AI Language choice and nothing I typed, so that a style like "pirate speak" never leaves my device.
10. As a player, I want the privacy policy to name both values, so that nothing is collected that the policy does not name.
11. As a player, I want the Daily Check-In switch to stop these values too, so that one switch covers the whole send.

## Implementation Decisions

**Rulings** (2026-11-21, from the user)

- Q1. The send carries both the Device Language and the mapped AI Language.
- Q2. The Device Language keeps language plus region.
- Q3. The language totals are their own breakdown, per day and per month, not crossed with platform or version.

**Client**

- The sender adds a JSON body `{ deviceLanguage, aiLanguage }`. The server still sets the day by its own clock, so the body holds no time.
- `deviceLanguage` comes from `navigator.language`, canonicalized with `Intl.Locale`, kept as language plus region. A script subtag is dropped. A value that cannot be parsed sends `unknown`.
- `aiLanguage` maps the current AI Language setting through one module beside `COMMON_LANGUAGES`, case-insensitive and trimmed. Each suggestion has an ISO 639-1 code. Blank and English send `en`. Any other value sends `other`.
- The sender reads both values at each attempt, as it reads the switch.
- The request still carries no credential and no account.

**Server**

- An additive schema step adds `device_language` and `ai_language` columns to the daily rows. Rows stored before the step read as `unknown`.
- `POST /api/active-installs` reads the body. A Device Language that does not match a language code with an optional region (`^[a-z]{2,3}(-[A-Z]{2}|-[0-9]{3})?$`, at most 12 characters) is stored as `unknown`. An AI Language outside the server's copy of the code list, `en` and `other` is stored as `unknown`. A missing or unreadable body stores `unknown` for both and still counts the install, so an older client keeps counting.
- The first row of a day keeps its languages, as it keeps its version. The month total counts each hash once, under the languages of its first row that month.
- Month Close writes language totals to a new table: period kind, period, dimension (`device` or `ai`), language and count. A unique index on kind, period, dimension and language makes a close safe to repeat. The existing close rules apply: a month that already has totals is never closed again, and totals win over live rows.
- The admin route adds `languages: { device: [{ language, count }], ai: [{ language, count }] }` to every day and month, sorted by count descending, then by language. Each list adds up to that period's total.
- No new column or table holds an account id, an address or a raw Install id.

**Usage tab**

- The Usage tab shows the two language splits for the month periods, beside the existing breakdown, with the same collapsing segments.

**Privacy policy**

- The Daily Send section changes "The send holds three things" to name five: the hash, the platform, the app version, the device's language, and the AI Language choice as a language from the list or "other". It says nothing typed in the setting leaves the device.
- The totals sentence adds the language split.

**Glossary**

- CONTEXT.md gains **Device Language**. **Daily Send** names the two language values.

## Testing Decisions

- The seams are the ones Active Installs uses: HTTP on the server, the sender module with a faked fetch on the client.
- **Server**
  - A send with both languages stores them, and the admin route shows them in the day and month splits.
  - A malformed Device Language, an unlisted AI Language, and a missing body each store `unknown` and still count the install.
  - An install that sends two languages in one day counts under the first.
  - Month Close writes the language totals once when run twice, and the admin route returns the same splits before and after the close.
  - Each language list adds up to its period's total.
- **Client**
  - The body carries `deviceLanguage` and `aiLanguage`, and no other field.
  - `pt-BR`, `zh-Hant-TW` and `fr` canonicalize to `pt-BR`, `zh-TW` and `fr`. An unparsable value sends `unknown`.
  - Blank, `English` and ` english ` send `en`. `French` sends `fr`. `pirate speak` sends `other`, and the raw text appears nowhere in the request.
  - Changing the AI Language between two days changes the next send.
- Per the test bar: prove each guard fails when its bug returns.

## Out of Scope

- **Steam builds.** They have no community server, so they never send. Steamworks reports wishlists and sales by region and language for that market.
- **Crossing language with platform or version.** Ruled out in Q3.
- **Players who never pass the age gate.** They are not counted, as in Active Installs.
- **Choosing the language.** These totals inform that decision. The decision itself, and a probe of how well the cloud model writes in the chosen language, are separate work.

## Further Notes

- **The policy edit needs a new acceptance version.** The 2026-11-07 deploy published the Daily Send policy as `acceptance_version=5`. Adding two values means version 6 and a re-accept. The user decides whether this edit re-asks or ships as a minor change.
- **Collection is still behind the `active_installs` setting.** The 2026-11-07 deploy log says it was off. Turn it on, or keep it on, only after the version 6 policy is live.
- **The server half deploys before the client release.** An older client sends no body and counts under `unknown`, so the order is safe either way.
- **Export shape:** no world or save `.json` changes.
