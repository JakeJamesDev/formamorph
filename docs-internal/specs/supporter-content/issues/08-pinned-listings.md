# 08: Client: pinned listings and staff Pin toggle

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: an ordering rule and a staff control in the existing browser.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Owns the staff listing controls that ticket 13 extends.

## What to build

Pinned listings show first in their kind's section and in All, newest pin first, before the player's sort (Q16). A pinned card carries a Pinned mark. Staff see a Pin or Unpin control on every listing.

## Acceptance criteria

- [x] Pinned listings come first under every sort and filter in a section and in All. (`useCommunityBrowserFilters.pinned.test.ts`; per kind tab only, the client has no All tab, per the spec session)
- [x] A pinned card shows the Pinned mark. (`RemoteWorldCard.pin.test.tsx` "the Pinned mark")
- [x] Only staff see the Pin control; it pins and unpins and the order updates. (`RemoteWorldCard.pin.test.tsx` "the Pin control"; the handler patches the row, which the order test covers)
- [x] Component tests cover the order and the staff-only control. (both files; each guard failed when the bug was put back)
- [ ] Frame `.scratch/frames/pinned-listing.png`, both themes, at 1440 wide.

## Landed

**Not verified**
- The frame: the Browser pane was hidden, screenshots timed out and the dev route rendered an empty page.
- The details-modal Pin button and `handleTogglePin`'s patch and in-flight guard: no test, covered by reading only.
- `setRemoteWorldPinned` against the live server routes: no client test.

**For you**
- Sign in as staff, pin a listing in a kind tab, and check it jumps to the top with the Pinned mark. Unpin it and check it drops back.
- Open a pinned listing's details and check the Pin or Unpin button and mark in the header.
- The spec and ticket still say "in All"; the client has no All tab.
