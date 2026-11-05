# 09: Settings rows and review fixes

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Implementation Decisions › Settings, Client)

Model rationale: client-only fixes in known files. The number row and the marker refresh are the only parts that need a design choice.

## What to build

The close review of this effort found these. The server needs no change: its settings routes already read and write all five keys, and its single-listing read already carries `likes_marker`.

**Server Settings tab.** Staff can see and change `network_kind` as an on/off row. They can also see and change the four thresholds: `likes_marker_min_flagged`, `likes_marker_share`, `burst_size`, `burst_window_minutes`. The tab and its service only handle on/off values today, so the thresholds need a number row. Use an existing control from the settings rows. A value the server refuses shows its error and leaves the stored value in place. The server lets any staff member write these keys; check who can open the tab, and name any mismatch in the landing.

**Marker after a removal.** When staff remove likes in the audit, the card marker, the details marker and the **Flagged Likes** count update without a catalog reload. Spec story 15: "I want a marker to clear on its own when the likes that caused it age out or are removed". Take the new reasons from a fresh read, not from a guess in the client.

**Contest entry count.** The contest bar shows the contest's full entry count while **Flagged Likes** is picked.

**Page position.** Picking any **Show** view returns to page 1.

**Summary line.** It reads "N of M likes flagged (P%) in the last 90 days", as ticket 05's ruling says.

**Standards findings.**
- The **Show** heading uses `text-caption`, which is not a real class. Use the design system's role.
- The audit that runs when the dialog opens checks for unmount and cancels, per the project's async rule.
- The comment above `moderationView` describes the state as it is now.

**Copy.** Rewrite these from a facts list, per `docs/Writing-Guide.md` ("Before you write" first):
- "Marker fires on: Burst and Flagged share"
- "Likes: Burst" and the "Bursts" heading: the reader needs to learn what the word means where it shows
- "Flagged share" as a label
- The marker's accessible name
- "Show only listings whose likes look inflated": the rule knows less than this claims
- "Open the likes audit": match the visible **Audit the likes** label

## Acceptance criteria

- [x] The Server tab has an on/off row for `network_kind` that reads and writes the live setting. (`ServerSettingsTab.test.tsx`: reads and writes the network_kind key)
- [x] The Server tab has a number row for each of the four thresholds, showing the stored value or the default. (test: shows each stored value, the share as a percent; the server's GET answers the default while none is stored, not read live here)
- [x] A threshold the server refuses shows the error and keeps the stored value. (test: shows the server's reason and puts the stored value back)
- [x] A dev-route entry shows the new rows. (`#dev?modal=adminPanel&tab=serverSettings&fixture=serverSettings`, read in the preview; refusal checked with Burst Size 1)
- [x] After a removal clears a listing's last reason, the card marker, details marker and Flagged Likes count update without a reload. (`pinnedReview` test for the card and count; `LikersDialog` test for the reasons sent to the details window; the details modal wiring is read, not rendered, because that suite mocks the modal)
- [x] After a removal that leaves a reason, the marker stays and names what remains. (`pinnedReview` test: keeps the marker and names what remains)
- [x] The contest bar's entry count stays the full count with Flagged Likes picked. (`contest` test)
- [x] Picking a Show view from a later page lands on page 1. (`pinnedReview` test)
- [x] The summary line matches the ruling's word order. (`LikersDialog` test)
- [x] The audit opened by a marker does no state write after unmount, shown by a test. (`LikersDialog` test: writes nothing and toasts nothing when the dialog unmounts before the audit fails)
- [x] The Show heading has a real type role, and the stale comment is corrected. (`text-meta`)
- [x] The copy above and the rest of this effort's strings pass the `copy-sweep` skill. This closes the unticked copy criteria on tickets 05 and 08. (sweep run on the changed files; its findings left in these files are older ones: the Remove labels, "No likes yet.", the Show heading's raw paragraph)
- [x] Each guard is proven to bite by reinstating its bug once. (page reset, contest count, marker refresh, unmount check, percent conversion, restore on refusal)
- [ ] Frames: `.scratch/frames/server-tab-flagged-likes-dark.png`, `.scratch/frames/server-tab-flagged-likes-light.png` at a realistic desktop width; `.scratch/frames/moderation-contest-mobile-dark.png` at 390px with Flagged Likes as the only view besides All Listings. The last frame closes ticket 06's mobile gap. (the two Server tab frames are stored; the mobile frame is not)

For you: open the Server tab as staff, then switch `network_kind` off and on again to confirm the row controls it.

## Landed

**Not verified**
- The mobile frame `moderation-contest-mobile-dark.png`: the age-gate dialog covers the community dev route on a fresh dev origin, and the attestation was not accepted for the user. Ticket 06's mobile gap stays open.
- The details window's marker after a removal is covered at the dialog and the browser, not rendered together.

**For you**
- Open the Server tab as staff, then switch `network_kind` off and on again to confirm the row controls it. Look at Admin Panel › Server.
- The Server tab is owner-only (`ADMIN_PANEL_OWNER_TABS`), but the server lets any staff member write these keys. Nothing changed; a mod can still write them by route.
- Flagged Share shows as a percent while the server stores 0 to 1. Try 35 and read back 35.
- The marker now reads "Burst of likes" and "Many flagged likes", and the audit's reasons line reads "Why it’s marked". Judge the wording on a marked card.
