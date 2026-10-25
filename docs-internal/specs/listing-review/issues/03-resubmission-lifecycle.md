# 03: Resubmission Lifecycle

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: the server spec (Rejection and quarantine; rulings Q19, Q23, Q24)

Model rationale: small surface, but it threads the moderation state through the existing quarantine edit and release paths.

## What to build

An author fixes a rejected listing and it goes back to the queue. Its quarantine deadline keeps running, with the usual one-time extension. A second rejection keeps that deadline. Approval or a staff release ends the quarantine and puts the listing live.

## Acceptance criteria

- [ ] An author edit to a `rejected` listing sets `pending` with a new `moderation_queued_at`; the queue lists it as `resubmitted` with its deadline.
- [ ] That edit grants the one-time extension and writes `quarantine_updated`, through the existing path.
- [ ] Rejecting a resubmission sets `rejected`, keeps `quarantine_expires_at` and the extension flag, and ignores `days`.
- [ ] Approving a quarantined `pending` listing clears all three quarantine columns and sets `listed_at`.
- [ ] `DELETE /:id/quarantine` on a `rejected` listing approves it and writes `listing_approved`.
- [ ] The quarantine sweep still deletes a `rejected` listing at its deadline.
