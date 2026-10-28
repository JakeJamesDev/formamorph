# 06: Client: Mascots section and download

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: adds a section and a download target to a large browser component, plus source tracking in the Mascot preset store.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Owns the client `mascot` kind entry that tickets 07 and 12 use.

## What to build

Community Creations gains a Mascots section. Mascot cards read like every other card. Downloading a Mascot listing adds it to the Mascot preset store as a normal custom Mascot that the player can select, edit, duplicate and export (Q18). The card shows Downloaded, and Update Available after the author publishes a new version, through the existing source-tracking pattern. A second download refreshes the copy instead of adding a duplicate.

## Acceptance criteria

- [x] The Mascots section lists Mascot listings with search, tags, sort and paging. (`CommunityCreationsBrowser.mascots.test.tsx` "lists Mascot listings only"; search and paging are the shared pipeline, seen in the frames)
- [x] Download adds a selectable custom Mascot whose images land in the mascot image store. (`mascotDownload.test.ts` "adds a selectable custom Mascot…"; the image store call is injected in that test)
- [ ] A downloaded Mascot can be edited, duplicated and exported as a card. (edit and Duplicate covered in `mascotPresets.test.ts`; Export of a followed copy has no test of its own)
- [x] Downloaded and Update Available show by the same rules as other kinds; a second download replaces the copy. (`mascotDownload.test.ts` "replaces the held copy…", `CommunityCreationsBrowser.mascots.test.tsx` "shows Downloaded… Update Available")
- [x] Component tests cover the section, the download and the refresh (prior art: the CommunityCreationsBrowser tests). (`CommunityCreationsBrowser.mascots.test.tsx`, `mascotDownload.test.ts`)
- [x] Frames `.scratch/frames/mascots-section-desktop.png` and `.scratch/frames/mascots-section-mobile.png`, dark theme, at 1440 and 390 wide. (sample listings injected into the catalog cache)
- [x] The Community Creations docs page lists Mascots. (`docs/Community-Creations.md`: tabs table, download table)

## Landed

**Not verified**
- Export of a followed copy as a card: no test of its own. Export reads the rig only, so the link fields do not reach it.
- A Mascot-tab draft open on the Mascot a download replaces: not guarded or tested. The community browser and the Formaquestion settings are separate modals, so both are probably never open together. Unchecked.
- Thumbnails on Mascot cards: the frames use sample listings with none.

**For you**
- Look at a Mascot card with a real thumbnail. Cards use the landscape crop (`thumbAspectFor`), and a Mascot render may suit portrait. Community Creations → Mascots.
- Download a Mascot twice, edit the copy in Settings → Formaquestion → Mascot, then download again. The app asks before it replaces the edited copy.
- Docs table lists Mascots before Prompts, the same order as the rail.
