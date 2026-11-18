# Spec: Supporter Tier Schedule

Status: ready-for-agent
Spec session: supporter-tier-schedule — spec

Let staff release a Supporter-only Mascot or world to the Supporter tiers one at a time: Beacon first, then Flame, then Spark, then everyone. Each stage has its own length, and any stage can be skipped. Builds on Timed Supporter Content and Supporter Worlds (`docs-internal/specs/supporter-worlds/spec.md`, rulings R1–R36) and Supporter Content (`docs-internal/specs/supporter-content/spec.md`, Q1–Q47). Spans both repos: the Formamorph client and FormamorphServer.

## Problem Statement

A timed Supporter-only listing treats every tier the same. Every Supporter gets the content on the same day, and everyone else gets it on the end date. Higher tiers get nothing extra for early access. The user wants the higher tiers to get content first, for example 5 days for Beacon, then 5 for Flame, then 5 for Spark, then everyone. Sometimes the user wants a shorter path, such as 5 days for Beacon and then public.

## Solution

When an admin publishes a Supporter-only Mascot or world, they set a number of days for each tier stage. Beacon always opens first. An empty stage is skipped. The admin also chooses whether the listing goes public after the last stage or stays Supporter-only with no end.

Everyone sees the full schedule on the card and the details window (Q2). A Supporter whose tier hasn't opened yet sees an upgrade prompt that links to Patreon (Q7). A Supporter whose tier is open downloads as today. When the last stage ends, the listing goes public exactly as R1 describes.

A Supporter Copy stays with any account that still has a Supporter tier, even after a downgrade (Q1).

## Rulings

Settled in the grill on 2026-11-17. A ruling reopens on new evidence, never on a new opinion. Rulings in the two base specs still hold unless one here narrows them.

| # | Ruling |
|---|---|
| Q1 | A Supporter Copy downloaded legitimately stays while the account has any Supporter tier. A downgrade below the current stage keeps it. Only a full lapse removes it, as R12 says. |
| Q2 | Everyone sees the full schedule on the card and the details window: each tier's opening date and the public date. |
| Q3 | The required tier only goes down: Beacon, then Flame, then Spark, then public. Any stage can be skipped. A lower tier never opens before a higher one. |
| Q4 | The admin types the days for each stage at publish time. There are no saved presets or defaults. |
| Q5 | The schedule lives in a child table keyed by tier key. `supporter_until` keeps its live meaning as the public date, so live listings need no migration. |
| Q6 | No client minimum bump. An older client shows only the public date, and the server refuses a download from a tier that isn't open yet. |
| Q7 | A Supporter below the current stage sees an upgrade prompt that links to the Patreon page. A non-Supporter sees today's Patreon state. |
| Q8 | An admin can edit any stage until the listing goes public, including moving a passed stage back into the future. Copies already downloaded stay, per Q1. |
| Q9 | Only Mascot and World listings get a schedule, the same kinds as R16. |
| Q10 | No notice goes out when a stage opens. Players see the change only on the listing. |

## User Stories

1. As a Beacon Supporter, I want new Supporter content before the other tiers, so that my tier is worth its price.
2. As a Flame Supporter, I want content to open to me after Beacon and before Spark, so that I get early access for my tier.
3. As a Spark Supporter, I want content to open to me before it goes public, so that my pledge still gets me something early.
4. As a Supporter, I want to see when each tier gets a listing, so that I know when I can download it.
5. As a Supporter below the current stage, I want an upgrade prompt on the listing, so that I can reach the higher tier if I want it now.
6. As a non-Supporter, I want to see the date a listing goes public, so that I know when I can get it.
7. As a non-Supporter, I want to see what each tier gets and when, so that I can decide whether to pledge.
8. As a Supporter whose tier just opened, I want the Download button to work with no app update, so that I can get the content on time.
9. As a Supporter who downgraded, I want to keep the copies I already downloaded, so that a tier change doesn't take content away.
10. As a Supporter whose pledge lapsed, I want the same lapse behavior as today, so that nothing about a full lapse surprises me.
11. As a player with an older app, I want a clear refusal if I try to download before my tier opens, so that I understand why it failed.
12. As a player after the public date, I want a clean download, so that the content becomes ordinary content (R1).
13. As an admin, I want to set days for Beacon, Flame and Spark when I publish, so that one listing can roll down the tiers.
14. As an admin, I want to leave a stage empty to skip it, so that I can do "5 days for Beacon, then public".
15. As an admin, I want to choose between going public after the last stage and staying Supporter-only with no end, so that some content can stay exclusive.
16. As an admin, I want to see the dates each stage opens while I type the days, so that I can check the schedule before I publish.
17. As an admin, I want a schedule that would open a lower tier before a higher one refused, so that I can't make that mistake.
18. As an admin, I want to change any stage after publishing, so that I can change plans.
19. As an admin, I want to move a passed stage back into the future, so that I can re-gate a listing that opened too early.
20. As an admin, I want every schedule change in the audit log, so that staff can see who changed what.
21. As an admin, I want a schedule refused on other listing kinds, so that only Mascots and worlds get one.
22. As an admin, I want a listing that is already timed to keep working unchanged, so that live content doesn't break.
23. As staff or the listing's author, I want access at every stage, as today, so that I can test and maintain the listing.
24. As the owner, I want a new tier to need only a config change, so that the tier list can grow without a migration.

## Implementation Decisions

### Server

- **Schedule table.** A new child table holds one row per listing and tier key, with an `opens_at` timestamp. A listing with no rows opens every tier at publish, as today. The highest tier has no row and opens at publish. `supporter_until` stays the public date. Null still means Supporter-only with no end. The schema step creates the table on boot, and live rows need no change (Q5).
- **Tier ranking.** One reusable function ranks tier keys from the existing lowest-first tier list. Nothing hardcodes tier names.
- **Gate helper.** The read-time helper that decides whether a listing is Supporter-only now gains a sibling that returns the lowest tier open now, or none when the listing is public. Every route that gates a download goes through it. A route admits the account when its tier ranks at or above that tier. Staff and the listing's author pass as today. The clock stays injected.
- **Entitlement.** The entitlement lists are not filtered by tier. Any qualifying account gets the same lists as today, so the client's sync keeps a downgraded account's copies (Q1). Only the download gate checks the tier.
- **Admin routes.** The create route's duration gains a per-tier form: days for each stage and whether the listing goes public after the last stage. The server converts days into `opens_at` rows and `supporter_until`. The Supporter-only route gains a way to set or change the whole schedule. Both refuse a schedule that opens a lower tier before a higher one (Q3), a schedule on other kinds (Q9), and a public date in the past. Re-gating a passed stage is allowed until the listing goes public (Q8). Each change writes an audit entry.
- **Ticket 01 intent answers (2026-11-18).** Create and the Supporter-only route take `supporterSchedule` in a days form, `{ days: { <tier key>?: n }, goPublic }`, counted from the request time; an absent key skips the stage. The Supporter-only route also takes a dates form, `{ opensAt: { <tier key>?: date }, publicAt: date | null }`, which ticket 03's edit control sends, so an edit doesn't re-base untouched stages. Rows are kept after their date passes, so the full schedule stays visible (Q2). A listing with no rows is a legacy timed listing: every tier opens at publish. A schedule always writes a row for every lower tier. A skipped stage's row carries the date the next stage opens. A null `opensAt` means the tier opens at the public date, or never when there is none. The dates form must name every lower tier. Clients show a null with no public date as "not scheduled". An edit replaces the whole schedule; `null` clears the rows and keeps `supporter_until`. A qualifying account below the open tier gets a 403 with `requiredTier` and `opensAt` (its own tier's date, or null). Catalog and details carry `supporterSchedule: [{ tier, opensAt }]`, highest first, with no top-tier entry. The entitlement reply adds `tier`. Audit adds `listing_supporter_schedule`.
- **Sweep.** No change. The sweep acts only at the public date.
- **Payloads.** Catalog and details carry the schedule while the listing is Supporter-only. Each entry is a tier key and an opening date. Older clients ignore the new field and still read the public date (Q6).
- **Refusal.** A download from a qualifying account below the open tier gets a refusal that names the tier and the date it opens, so an older client shows something useful.

### Client

- **Listing action rule.** The pure rule that picks the Supporter listing button gains an upgrade state: the account qualifies, but its tier ranks below the tier open now. The entitlement reply carries only `qualifies` today, so the server adds the account's tier key beside it.
- **Upgrade prompt.** The upgrade state opens the same Patreon page as today's Patreon state (Q7). Copy follows the Writing Guide.
- **Schedule display.** The Supporter end-date mark becomes a schedule mark. It shows each tier's opening date and the public date, using the tier display names, on the card and in the details window (Q2). A listing with no tier rows still reads as today. A scheduled listing's mark leads with the top tier as open now; the client derives it, since the server sends no top-tier entry (ticket 02 intent answer).
- **Publish dialog.** The admin Supporter-only controls for a new Mascot or World listing show one days field per tier, highest first, and a switch to go public after the last stage. The resulting dates show under the fields. The edit control on the card and in the details window edits the same schedule. Ticket 03 intent answers (2026-11-18): with every tier field blank, Publish sends no schedule, which means Supporter-only with no end. "Every tier for N days, then public" is Spark N days with the others blank. The schedule dialog replaces the old end-date dialog. It has date-time inputs, prefilled so untouched stages round-trip exactly. Each lower tier can be left empty (opens at the public date), and the public date can be empty (no end). A legacy listing shows every lower tier as opening with the public date.
- **Sync.** No behavior change is needed, given the entitlement decision above. The sync test proves that a downgraded account keeps its copy.

### Export shape

- World `.json` and save `.json` shapes don't change. The schedule is listing metadata only.
- The catalog, details and admin route payloads gain the schedule. This is an additive API change, with no client minimum bump (Q6).

## Testing Decisions

A good test drives a public seam and asserts what a player, admin or route caller observes. It never asserts internal calls. Each guard is proven by putting the bug back and watching the test fail (`test-bar` skill). The user confirmed three seams.

1. **Server routes**, with an injected clock. Prior art: FormamorphServer's supporterOnly, supporterPublishRoute and supporterProcessing route tests. Cover: a Beacon-only stage admits Beacon and refuses Flame and Spark, with the refusal naming the tier and date; each stage opening at its date with no sweep run; a skipped stage opening with the next one down; going public at the public date; no end date when the admin chooses that; a live listing with only `supporter_until` behaving as before; create and edit refusing an out-of-order schedule, other kinds and a past public date; re-gating a passed stage; the audit entries; the schedule in catalog and details; staff and author access at every stage.
2. **Client listing action rule and button.** Prior art: the supporterListingAction and SupporterListingButton tests, and the PublishModal supporter test. Cover: the upgrade state for a qualifying account below the open tier; the Patreon state for a non-qualifying account; the download state once the tier opens; the schedule mark's dates; the Publish dialog's per-tier fields, the public switch and the computed dates.
3. **Client Supporter content sync**, with injected fetch and clock. Prior art: the supporterContent tests. Cover: an account that downgrades below the open tier keeps its Supporter Copy; a full lapse still removes it.

## Out of Scope

- Notices when a stage opens (Q10).
- Saved or default schedules (Q4).
- Schedules for kinds other than Mascot and World (Q9).
- A client minimum-version bump (Q6).
- Setting the tier display names in Patreon. Release blocker 04 tracks that.
- The Steam build (base Q20).

## Further Notes

- `supporter_until` has been live since the server deploy of 2026-11-15, so the design keeps its meaning. Live timed listings read as "every tier until the public date".
- The server's tier keys are `supporter`, `supporter_plus` and `supporter_top`. Spark, Flame and Beacon are display names only.
- The server deploys before a client that sends schedules.
