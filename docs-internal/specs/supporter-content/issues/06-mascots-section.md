# 06: Client: Mascots section and download

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: adds a section and a download target to a large browser component, plus source tracking in the Mascot preset store.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Owns the client `mascot` kind entry that tickets 07 and 12 use.

## What to build

Community Creations gains a Mascots section. Mascot cards read like every other card. Downloading a Mascot listing adds it to the Mascot preset store as a normal custom Mascot that the player can select, edit, duplicate and export (Q18). The card shows Downloaded, and Update Available after the author publishes a new version, through the existing source-tracking pattern. A second download refreshes the copy instead of adding a duplicate.

## Acceptance criteria

- [ ] The Mascots section lists Mascot listings with search, tags, sort and paging.
- [ ] Download adds a selectable custom Mascot whose images land in the mascot image store.
- [ ] A downloaded Mascot can be edited, duplicated and exported as a card.
- [ ] Downloaded and Update Available show by the same rules as other kinds; a second download replaces the copy.
- [ ] Component tests cover the section, the download and the refresh (prior art: the CommunityCreationsBrowser tests).
- [ ] Frames `.scratch/frames/mascots-section-desktop.png` and `.scratch/frames/mascots-section-mobile.png`, dark theme, at 1440 and 390 wide.
- [ ] The Community Creations docs page lists Mascots.
