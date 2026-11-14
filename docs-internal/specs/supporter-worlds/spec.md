# Spec: Timed Supporter Content and Supporter Worlds

Status: ready-for-agent
Spec session: supporter-worlds — spec

Let staff publish a Supporter-only listing with an end date, after which it becomes a normal public listing. Let a Supporter-only listing be a world that a Supporter can download, play and edit, but whose media can't leave the app. Builds on the Supporter Content spec (`docs-internal/specs/supporter-content/spec.md`, rulings Q1–Q47). Spans both repos: the Formamorph client and FormamorphServer.

## Problem Statement

Supporter-only listings exist, but only a Mascot can be installed. A Supporter-only world shows a disabled Not Supported Yet button. If a world could be downloaded, every path the app has for worlds would hand out its media: world export, entity cards, the Media tab, Duplicate, Publish, the backup bundle.

Every Supporter-only listing is also exclusive forever. The user wants early access instead: Supporters get the content first, and after a set time anyone can download it. Today staff would have to remember to clear the flag by hand on the right day.

## Solution

**Timed exclusivity.** When an admin publishes a Supporter-only Mascot or world, they can set a duration in days (R2). The server stores the end date. Everyone sees "Supporter-only until <date>" on the listing (R3). When the date passes, the listing becomes a normal public listing: downloads are clean files with no watermark, scramble or restrictions (R1). An admin can extend, shorten or clear the end date later. No duration means Supporter-only with no end.

**Supporter worlds.** A qualifying account downloads a Supporter-only world from its listing. The server sends it watermarked per account and scrambled, as it does for a Mascot. The app unscrambles it and stores it as a **Supporter Copy**: a normal world in the world store, playable and editable, with a marker that blocks every way out (R5). Duplicate, every export, Publish, media Download, the backup bundle and the crash-recovery export all skip or refuse it (R7, R15). Blocked actions stay visible but disabled, with a tooltip, and the world card shows a Supporter badge (R14). Save to Library still works, but the library entry is a Supporter Copy too: it can't be exported or published and can only go back into its source world (R7, R9).

When the pledge lapses, every Supporter Copy is removed at the next good check. Saves are kept (R6). That holds after expiry too (R12). A copy downloaded before expiry stays a Supporter Copy; the player can download the public version as a separate world (R4).

## Rulings

Settled in the grill on 2026-11-14. Numbered R so they don't collide with the base spec's Q numbers. A ruling reopens on new evidence, never on a new opinion. Base-spec rulings still hold unless one here narrows them.

| # | Ruling |
|---|---|
| R1 | When a timed listing's end date passes, it becomes a normal public listing. Downloads are clean, with no watermark, scramble or Supporter Copy marker. |
| R2 | An admin sets a duration in days. The server stores the end date. An admin can extend, shorten or clear it later. No duration means Supporter-only with no end. |
| R3 | Everyone sees the end date on the card and the details window. |
| R4 | A Supporter Copy downloaded before expiry stays a Supporter Copy after it. |
| R5 | A Supporter world is scrambled only in transit. It is stored as a normal world with per-account watermarked images and a Supporter Copy marker. Narrows base Q4 and Q39 for worlds: the unscrambled, watermarked images are stored. |
| R6 | When a pledge lapses, Supporter Copies are removed at the next good check. Saves are kept. Base Q3 and Q6 apply as for the Mascot. |
| R7 | On a Supporter Copy, only Save to Library is allowed, and the library entry is a Supporter Copy too. Blocked: Duplicate, every export (text-only ones included), Publish, media Download. |
| R8 | Audio, Avatars and 3D models are covered by the Supporter Copy rules. They are not watermarked. |
| R9 | A Supporter Copy library entry can only be added to its source world. |
| R10 | A new revision of a Supporter world shows Update Available. The player chooses to update. Base Q22's auto-update stays Mascot-only. |
| R11 | Supporter-only publish of a world refuses linked https images and names them. |
| R12 | Lapse removes Supporter Copies after expiry too. |
| R13 | An admin sets Supporter-only and the duration in the Publish dialog, for a new Mascot or World listing. The end date can be edited later from the card and the details window. Extends base Q46. |
| R14 | Blocked actions stay visible but disabled, with a tooltip. A Supporter Copy world shows a Supporter badge on its card. |
| R15 | The backup bundle and the crash-recovery export leave Supporter Copies out. |
| R16 | Only Mascot and World listings can be timed or downloaded as Supporter content. Other kinds keep Not Supported Yet and get no switch. |
| R17 | Export of a save whose world is a Supporter Copy is blocked, disabled with a tooltip, because a save holds the world's books in full. Saves still play. New evidence from ticket 04, under R7. Each save of a Supporter Copy carries the local-only marker from when it is written, so the block outlives the world's removal (R6). The marker is stripped on export like `id`, and the save `.json` shape is unchanged. |
| R18 | R7's Duplicate means Duplicate World. Duplicating an entity, book or location inside the Supporter Copy's own editor stays allowed. |
| R19 | Under R14, the crash screen shows Export World disabled with the reason as visible text, since it has no tooltip host. The backup checklist lists a Supporter Copy disabled with a tooltip, and the backup bundle drops it regardless. |
| R20 | Ticket 04 owns the allowed-action rule for both targets: a world and a library entry (marker plus `sourceWorldId`), including add-to-world. Ticket 05 wires the library surfaces. |
| R21 | R14's Supporter badge on a Supporter Copy world card is the Patreon button's heart icon in its gradient colors, with a tooltip. User ruling, 2026-11-14. |
| R22 | R21's heart is the standard mark for a Patreon item, in place of a lock icon. It marks the item wherever its name shows in a list or picker, whether or not the account has access: a Supporter Copy world card, a Supporter-only Mascot in the Mascot tab, and the Formamorph AI preset. Ticket 04 builds it as one shared component and adds it to the Design System; ticket 08 applies it to the Mascot tab and Formamorph AI. User ruling, 2026-11-14. |

## User Stories

1. As a Supporter, I want to download a Supporter-only world from its listing, so that my pledge gets me worlds other players can't play yet.
2. As a Supporter+, I want the same access, so that the higher tier never loses a perk.
3. As a Supporter, I want the downloaded world in my Worlds list next to my other worlds, so that it plays like any world.
4. As a Supporter, I want to edit a Supporter world in the World Editor, so that I can adjust it to my taste.
5. As a Supporter, I want to replace or add images in a Supporter world, so that my edits aren't limited to text.
6. As a Supporter, I want to save an entity or dictionary from a Supporter world to my library, so that I can reuse it in that world later.
7. As a Supporter, I want to see why Export, Duplicate and Publish are disabled on a Supporter world, so that I don't think the app is broken.
8. As a Supporter, I want a Supporter badge on the world's card, so that I can tell which worlds carry the restrictions.
9. As a Supporter, I want to see Update Available when staff publish a new revision, so that I can choose whether to replace my edited copy.
10. As a Supporter, I want my Supporter worlds to keep working offline for up to 7 days, so that a lost connection doesn't take them away.
11. As a lapsed Supporter, I want my saves kept when the world is removed, so that I can pick up again if I pledge again.
12. As a lapsed Supporter who pledges again, I want to download the world again from its listing, so that rejoining just works.
13. As a non-supporter, I want to see when a Supporter-only listing opens to everyone, so that I know when I can get it.
14. As a non-supporter, I want a timed listing to become a normal Download on its end date, so that I don't have to do anything special.
15. As a player, I want an expired listing to download as a normal, fully editable and exportable world or Mascot, so that early-access content becomes ordinary content.
16. As a Supporter with a copy from before expiry, I want to download the public version as a separate copy, so that I can get an unrestricted one without losing my edits.
17. As an admin, I want a Supporter-Only switch and a duration field in the Publish dialog for a new World listing, so that I can publish an early-access world in one step.
18. As an admin, I want the same duration field for a new Mascot listing, so that Mascots can be early access too.
19. As an admin, I want to extend, shorten or clear the end date after publishing, so that I can change plans.
20. As an admin, I want the listing to open on its end date without me doing anything, so that I can't forget.
21. As an admin, I want a Supporter-only world with linked images refused, with the images named, so that I don't ship media that bypasses the gate.
22. As the owner, I want each account's copy of a Supporter world watermarked, so that a leaked image names the account.
23. As the owner, I want no export, Duplicate, Publish or media Download on a Supporter world, so that there is no one-click leak path.
24. As the owner, I want backups and crash-recovery exports to leave Supporter worlds out, so that they are not a leak path.
25. As the owner, I want a Supporter Copy library entry to stay inside its source world, so that it can't be carried out through another world's export.
26. As the owner, I want a lapsed account's Supporter Copies removed, so that the perk ends with the pledge.

## Implementation Decisions

### Server

- **End date.** Add a nullable `supporter_until` timestamp on listings. One helper decides whether a listing is Supporter-only *now*: the flag is on and the end date is null or in the future. Every route that reads the flag (public content, dependency content, gated content, catalog, details, update reply, entitlement) goes through it, so expiry is exact at read time. The clock is injected for tests.
- **Expiry sweep.** An hourly job on the existing scheduler finalizes listings whose end date has passed: it clears the flag, moves the content file to the public area, clears the per-account cache, and records `supporter_expired_at`. The read-time helper means the sweep's delay is never visible to a player. An admin clearing the flag by hand (base Q44) also records `supporter_expired_at`.
- **Entitlement.** The entitlement route gains a list of formerly Supporter-only listings (those with `supporter_expired_at`) beside the current items. The client keeps a Supporter Copy of an expired listing while the account qualifies, and removes it when it does not (R4, R12).
- **Admin routes.** The create route's admin-only `supporterOnly` gains an optional duration in days, for Mascot and World only (R16); the server converts it to an end date. The Supporter-only route gains a way to set, change or clear the end date. Both refuse a duration on other kinds and an end date in the past. Each change writes an audit entry.
- **Payloads.** Catalog and details carry the end date while the listing is Supporter-only.
- **World processing.** The gated route already walks the world JSON and processes every embedded image. Non-image media passes through unmarked (R8). The ticket measures the cold processing time of the largest bundled-size world and reports it against a budget the user sets; worker threads are already in place.
- **Linked images.** Creating, updating, or flagging a Supporter-only world refuses one that holds a linked `http(s)` image, and names where each one sits (R11).

### Client

- **Supporter Copy marker.** A local-only field on the stored world record, like `sourceId`: listing id, account id and revision. It is never part of world data, so world and save export shapes don't change. A library entry saved from a Supporter Copy carries the same kind of local-only marker, plus the source world's id.
- **Allowed-action rule.** One pure function answers whether an action is allowed on a world or library entry: export (world, entity, dictionary), Duplicate, Publish, media Download, backup, crash-recovery export, Save to Library, and add to a world (allowed only for the source world). Every surface reads it. Nothing hides a button; blocked ones show disabled with a tooltip (R14). Tooltip copy follows the Writing Guide.
- **Download.** `world` joins the kinds a Supporter-only listing can download (base Q40). Download fetches the gated route, unscrambles each image object into a lossless PNG data URL, and stores the world through the normal world store with `sourceId` tracking and the Supporter Copy marker.
- **Sync.** The Supporter content module's check gains a world step, beside the Mascot sync. On a good check that says the account doesn't qualify, it removes every Supporter Copy (worlds and library entries) of that account. On a good check that qualifies, it removes Supporter Copies whose listing is in neither list. Base Q39's account rules apply: another account's Supporter Copies are not shown while it is signed in, and that account's first good check removes them. Base Q6's 7-day offline window applies. Saves are never removed (R6).
- **Updates.** Update Available follows the existing download-state pattern. Updating a Supporter Copy re-fetches through the gated route (R10).
- **Expired listings.** An expired listing shows the normal Download. A downloaded copy is a normal world or custom Mascot with no marker (R1). An installed exclusive Mascot from before expiry stays read-only (R4).
- **Publish dialog.** The admin Supporter-Only switch (base Q46) shows for a new Mascot or World listing, with an optional duration in days and the resulting end date under it. The details window and card give an admin a control to change or clear the end date.
- **Listing display.** The card and details show the end date to everyone while the listing is Supporter-only (R3).
- **Backups.** The backup bundle and the crash-recovery export leave Supporter Copies out (R15).

### Export shape

- World `.json` and save `.json` shapes are unchanged: the marker is a local-only record field, and a Supporter Copy never exports.
- The ticket that touches saves confirms that a save export carries no world media. If it does, that is new evidence for the spec session.

## Testing Decisions

A good test drives a public seam and asserts what a player, admin or route caller observes. It never asserts internal calls. Each guard is proven by putting the bug back and watching the test fail (`test-bar` skill). The user confirmed three seams.

1. **Server routes**, with an injected clock. Prior art: FormamorphServer `tests/supporterOnly.test.js`, `tests/supporterPublishRoute.test.js`, `tests/supporterProcessing.test.js`. Cover: create with a duration; duration refused on other kinds and for a past date; the public route refusing before the end date and serving after it, with no sweep run; the gated route serving a world with watermarked, scrambled images and unchanged non-image media; the sweep moving the file, clearing the cache and recording the expiry; the entitlement route's expired list; changing and clearing the end date; linked images refused on create, update and flag.
2. **Client Supporter content module**, with injected fetch and clock. Prior art: `supporterContent.test.ts`. Cover: a world download stores a Supporter Copy with unscrambled images; lapse removes every Supporter Copy and keeps saves; a qualifying check keeps copies of current and expired listings and removes others; another account's copies are hidden and then removed; the 7-day window.
3. **Allowed-action rule**, as a pure function over every action and target. Plus component tests that the buttons show disabled and the badge shows. Prior art: `WorldStorageService.supporterOnly.test.ts`, `CommunityCreationsBrowser.supporterOnly.test.tsx`, `PublishModal.supporter.test.tsx`.

## Out of Scope

- Watermarking audio, Avatars or 3D models (R8).
- Leaks through DevTools, the browser profile, screenshots or a right-click Save Image. The watermark is the deterrent there.
- Turning a Supporter Copy into a normal copy at expiry (R4).
- Timed or downloadable Supporter content for kinds other than Mascot and World (R16).
- Server detection of a Supporter world republished by someone else. Listing Review covers it.
- The Steam build (base Q20).

## Further Notes

- "Supporter Copy" is a new term. Add it to `CONTEXT.md` when this lands. Avoid "locked" (the glossary keeps it for travel locks) and "install" as a noun (the glossary keeps it for an app's local storage).
- Base Q3's removal of the exclusive Mascot on lapse is unchanged.
