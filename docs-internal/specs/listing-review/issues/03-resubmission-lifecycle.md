# 03: Resubmission Lifecycle

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: the server spec (Rejection and quarantine; rulings Q19, Q23, Q24)

Model rationale: small surface, but it threads the moderation state through the existing quarantine edit and release paths.

## What to build

An author fixes a rejected listing and it goes back to the queue. Its quarantine deadline keeps running, with the usual one-time extension. A second rejection keeps that deadline. Approval or a staff release ends the quarantine and puts the listing live.

## Acceptance criteria

- [x] An author edit to a `rejected` listing sets `pending` with a new `moderation_queued_at`; the queue lists it as `resubmitted` with its deadline. `resubmission.test.js` "sends it back to the queue as resubmitted…"; review off and trust don't skip it (T21).
- [x] That edit grants the one-time extension and writes `quarantine_updated`, through the existing path. "extends the deadline once and logs each fix".
- [x] Rejecting a resubmission sets `rejected`, keeps `quarantine_expires_at` and the extension flag, and ignores `days`. "keeps the deadline and the extension, and ignores days" (sent `days: 0`).
- [x] Approving a quarantined `pending` listing clears all three quarantine columns and sets `listed_at`. "ends the quarantine and puts it live as new".
- [x] `DELETE /:id/quarantine` on a `rejected` listing approves it and writes `listing_approved`. "approves it into the catalog and logs the approval"; no `quarantine_released` entry (T23).
- [x] The quarantine sweep still deletes a `rejected` listing at its deadline. Both sweep cases, resubmissions included.
- [x] From ticket 02's review: approve and reject refuse a mod acting on their own listing (one submitted before a promotion), with `403`, so staff never review their own work (story 32). "staff reviewing their own listing", admins and the approving release included (T24).

## Landed

Server code: FormamorphServer `c06bcaa` "Add Resubmission Lifecycle". Full server suite 2222/2222 on main after the patch. Seven guards were reverted one at a time and each failed a test.

**Not verified:**
- Nothing in the list above.

**For you:**
- Nothing a player can judge yet: the setting ships off, and the review tab (ticket 08) shows resubmissions.
