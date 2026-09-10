# 06: Download a world with dependencies and add-ons

Status: ready-for-agent
Status note: PAUSED with the linked-world-content effort. Ticket 03 removes the `LINKING_ENABLED`
flag and is the resume point.
Blocked by: 01, 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: extends the download coordination boundary into a multi-listing operation with partial failure, retry, and linking, and it is the path every player takes.

## Parent

[spec.md](../spec.md) — Relationship authority and download behavior, Missing sources and offline use, Settled follow-up decisions (Unlisted), Proposed implementation boundary.

## What to build

A player downloading a community world receives its required content automatically and chooses its optional content.

The community world details window gains a **Linked Content** section with three tabs: **Required**, listing dependencies as included; **Approved Add-ons**; and **Community Add-ons**, each with a checkbox per item. Declined add-ons never appear. The action column's download button reads the count of required and selected items. Unlisted required components arrive through this path like any other and are never offered under the add-on tabs.

The download coordinator resolves the world's sources, downloads the world, the required components, and the selected add-ons, places components in the library, and links the world's copies to them with the link record from ticket 01. A required component that fails leaves the world download pending: completed items are kept and a Retry finishes the rest. An optional component that fails does not hold up the world; it is reported with its own Retry. Re-downloading a world a player already has keeps today's copy and update decisions.

## Acceptance criteria

- [ ] The details window shows Required with the world's dependencies, and Approved and Community tabs with checkboxes; a declined add-on is absent from every tab.
- [ ] Download installs the world, its required components, and the selected add-ons; each world copy shows Linked with its source in the World Editor.
- [ ] An unlisted required component installs and links; it is absent from both add-on tabs.
- [ ] A required download failure keeps the world pending with Retry; retry completes it without re-downloading finished items.
- [ ] An optional download failure leaves the world ready and offers Retry for that item only.
- [ ] Type check, lint, tests, and build pass; the test drives the real coordinator against a stubbed catalog, not a copied prototype transition.

## Blocked by

- 01 — Link metadata on world content.
- 04 — Server: listing relationships and Unlisted.
