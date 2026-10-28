# 13: Client: Supporter-only listing in Community Creations

Status: done
Blocked by: 08, 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: button states and one staff toggle on top of existing controls and the module from ticket 11.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings.

## What to build

On a Supporter-only listing, Download is replaced by Install for a Supporter, a Patreon button for a signed-in non-supporter, and Sign In when signed out (Q19). Everyone can still see, like and comment. Staff get a Supporter-only toggle in the staff listing controls from ticket 08.

## Acceptance criteria

- [x] The button reads Install, Patreon or Sign In by sign-in state and qualification. (`SupporterListingButton.test.tsx` "the Supporter-only button")
- [x] Install installs through the Supporter content module and then shows the item as installed. (`SupporterListingButton.test.tsx` "installs through the module, then shows Installed")
- [x] Likes and comments work for non-supporters on a Supporter-only listing. (`RemoteWorldDetailsModal.supporterOnly.test.tsx`; the like button and comment field render; the card test clicks like)
- [x] Only staff see the Supporter-only toggle. (card and modal tests; the staff gate failed when removed)
- [x] Component tests cover each state. (six states plus the card and the modal)
- [ ] Frame `.scratch/frames/supporter-only-listing.png`, both themes, at 1440 and 390 wide.
- [x] The Community Creations docs page covers Supporter-only listings. (`docs/Community-Creations.md` "Supporter-Only Listings")

## Landed

**Not verified**
- The frame: not taken. The Browser pane is unreliable for frames here.
- `handleToggleSupporterOnly` in `CommunityCreationsBrowser.tsx` (row patch, in-flight guard): no test. `setRemoteWorldSupporterOnly` is tested against a stubbed fetch only, not the live route.
- The Install click against the real store and server: the tests use a fake store.
- On the website build (no local library) a Supporter-only listing shows no Install, Patreon or Sign In button. Q19 does not carve out the web.

**For you**
- Sign in as staff, open a Mascot listing and select the heart on its card or **Limit to Supporters** in its details. Check the button swaps and the row updates.
- Sign in as a non-supporter and check a Supporter-only listing shows **Patreon**. Sign out and check **Sign In** opens the login dialog.
- As a Supporter, check **Install** installs the Mascot and the button then reads **Installed**.
- A Supporter-only listing of a kind other than Mascot shows a disabled **Not Supported Yet** to a Supporter. Q40 set this.
- A Supporter who is not on the entitled list (a stale list, or an author or staff account) sees **Patreon**. Q40 says no special case.
