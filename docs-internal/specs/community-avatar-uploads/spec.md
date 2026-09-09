# Spec: Community Avatar Uploads

Status: ready-for-agent

Publish VRM Avatars to Community Creations as a fourth listing kind, gated on the file's own embedded license, and rework the browser's section switcher to hold five sections. Spans both repos: the Formamorph client and FormamorphServer.

## Problem Statement

Players build and collect VRM Avatars in the local Model Library, but there is no way to share one. Every other creation type (worlds, entities, dictionaries) can be published and browsed; an Avatar can only be passed around by hand as a file. Meanwhile the Community Creations header is already a squeeze: three tabs plus a conditional Contest tab collapse to bare icons under 1040px, and a fifth section would not fit at all. And any sharing feature has to respect the rights VRM creators attach to their files, or the community catalog becomes a redistribution problem.

## Solution

An **Avatar** becomes a standalone listing kind in Community Creations: browsable, likeable, commentable, downloadable into the viewer's Model Library, and moderated like everything else. A player publishes one from the Model Library through the same publish flow as the other kinds. Only Avatars whose embedded VRM 1.0 metadata grants a **Permissive License** can be published; the check is automatic (read from the file, never self-declared) and is enforced on both client and server.

The section switcher is rebuilt for five sections. On a landscape layout it becomes a sidebar rail beside the results, with Contest set apart from the four content kinds by a rule. On a portrait layout it becomes a dropdown in the header, every item carrying its icon so it reads like the rail's rows stacked into one control.

## User Stories

1. As an Avatar creator, I want to publish a VRM from my Model Library, so that other players can use my Avatar.
2. As an Avatar creator, I want the publish flow to look like the one for worlds and entities, so that I do not learn a second process.
3. As an Avatar creator, I want the listing's name and portrait filled from the file's own title and embedded thumbnail, so that publishing is one confirmation, not a form.
4. As an Avatar creator, I want the listing to credit the authors named in the file, so that the original creator is visible even when that is not me.
5. As an Avatar creator, I want to be told exactly which license requirement my file fails, so that I know whether a different export or a different file would pass.
6. As an Avatar creator whose file has no VRM metadata, I want a clear refusal rather than a silent one, so that I do not think the button is broken.
7. As an Avatar creator, I want to update a listing I already published, so that a re-export replaces the old file for downloaders.
8. As an Avatar creator, I want to delete my listing, so that I can withdraw an Avatar.
9. As an Avatar creator, I want to write a Listing Changelog entry when I update, so that downloaders know what changed.
10. As a community browser, I want an Avatars section in Community Creations, so that Avatars are as findable as worlds.
11. As a community browser, I want Avatar cards to show the portrait, name, author, likes, and downloads, so that they read like every other card.
12. As a community browser, I want the details view to show the file's title, authors, and license terms, so that I know what I am allowed to do with it before downloading.
13. As a community browser, I want to search, filter, sort, and page Avatars with the same controls as other kinds, so that nothing about browsing is special-cased.
14. As a community browser, I want to like and comment on an Avatar listing, so that creators get the same feedback as other authors.
15. As a downloader, I want Save to Model Library on an Avatar listing, so that it lands where my other Avatars live.
16. As a downloader, I want a saved Avatar to show Downloaded on its card, and Update Available when the creator re-publishes, so that I can tell what I already have.
17. As a downloader, I want a second save of the same listing to refresh my copy rather than add a duplicate, so that my library stays tidy.
18. As a downloader, I want the saved Avatar to remember where it came from, so that the library can offer the update later.
19. As a downloader, I want saving an Avatar to be silent about one-click use, so that choosing it for a world stays where it is today, in the model picker.
20. As a website visitor, I want Avatar listings visible in the website's read-only catalog, so that the community is browsable before installing.
21. As a website visitor with downloads enabled, I want the device download to hand me the `.vrm` file itself, so that I can drop it into any VRM app.
22. As a player on a landscape screen, I want a sidebar listing every section with labels, so that I never have to guess an icon.
23. As a player on a landscape screen, I want Contest visually separated from the content kinds, so that the rail reads as content plus an event, not five equal things.
24. As a player on a portrait screen, I want the switcher to take one control's width, so that search and filters keep their room.
25. As a player on a portrait screen, I want every dropdown item to carry its icon, and the closed control to show the current section's icon and name, so that the portrait and landscape switchers look like the same thing.
26. As a player, I want the current section announced to assistive technology, so that the rail and dropdown are as navigable as the tabs were.
27. As a player, I want the section I arrived on (from an event banner, a notification, or the dev router) honored by the new switcher, so that deep links keep working.
28. As a first-time visitor, I want the section-switcher tutorial to point at the new rail or dropdown, so that onboarding is not left pointing at nothing.
29. As a player, I want the Contest section to appear only when there is a contest to browse, so that the rail carries no dead rows.
30. As a moderator, I want quarantine, takedown, and Reports to apply to Avatar listings unchanged, so that no new moderation surface is needed.
31. As the service owner, I want the server to refuse an Avatar whose file fails the license check even if a client claims otherwise, so that the catalog never hosts a file its creator forbade sharing.
32. As the service owner, I want a size cap on Avatar content, so that one listing cannot consume a world's worth of storage.
33. As a player on an older client, I want the new kind to be invisible rather than broken, so that clients and server can ship in any order.

## Implementation Decisions

**Domain model** (terms in the project glossary):
- **Avatar**: a VRM 3D model, in the local Model Library or published as a listing. In code the kind id is `model`, matching the library's existing `models` key; the player-facing label is Avatar / Avatars. This is the same sidestep the library already takes, because `avatar` in code means **Profile Picture** across both repos (the profile-picture routes, field, column, and storage directory). Renaming profile pictures is a separate effort.
- **Permissive License**: the verdict that a VRM's embedded metadata grants every right the catalog needs. A gate, not a badge.

**License gate** (the one new module; pure, shared shape on both sides):
- Input is the normalized VRM license. Output is `{ allowed, failedRequirements }`, where each failed requirement is a stable identifier the UI maps to copy.
- Requirements, all of which must hold:
  - metadata version is VRM 1.0 (`metaVersion === '1'`); VRM 0.0 files and files with no VRM extension fail;
  - `avatarPermission === 'everyone'`;
  - `allowRedistribution === true`;
  - `modification === 'allowModificationRedistribution'`;
  - `commercialUsage` is `personalProfit` or `corporation` (Formamorph is a paid product).
- Absence is failure: a missing field fails its requirement; it is never treated as permission (the existing `readVrmMeta` contract).
- Both bundled avatars pass. Verified by reading their metadata directly: `avatarPermission: everyone`, `allowRedistribution: true`, `modification: allowModificationRedistribution`, `commercialUsage: corporation`.
- The normalized license type gains two fields, `avatarPermission` (`onlyAuthor | explicitlyLicensedPerson | everyone`) and `modification` (`prohibited | allowModification | allowModificationRedistribution`), read from the VRM 1.0 meta. VRM 0.0 leaves them unset. A stored library record whose license predates these fields is treated as stale and re-read from the blob before the gate runs; the lazy-resolve path already exists.
- The VRM 0.0 `redistributionFromLicenseName` heuristic is untouched: it feeds the library's read-only license display, not the gate, and the gate rejects VRM 0.0 outright.

**Catalog kind**:
- Client `CATALOG_KINDS` gains `model`; `KIND_LABELS.model = { one: 'Avatar', many: 'Avatars' }`. `BROWSE_TABS` widens automatically. The client list mirrors the server list, as the existing comment requires.
- Server `KINDS` gains `model`. Kind rules: no description required, no thumbnail required (a per-kind placeholder is added to the placeholder-thumbnail config), `maxContentBytes` of 64MB. The bundled avatars are ~19MB on disk, ~25MB as base64; 64MB of content leaves room for a detailed export without approaching a world's 200MB.
- Content shape, stored verbatim and handed back on download: `{ vrm: <data URL of the .vrm bytes>, license: <normalized license>, hash: <content hash> }`. The `license` field is informational for readers of the stored content; enforcement never trusts it.
- Server validation on create and update: when `kind` is `model`, decode the data URL, parse the GLB header and JSON chunk (no geometry), normalize the VRM 1.0 meta, and run the same gate. A failing file is a 400 whose body names the failed requirements with the same identifiers the client uses. This is the only kind whose content the server inspects; it reuses the upload-terms middleware and every other kind-agnostic rule (ownership, suspension, quarantine visibility, contest lock non-applicability, changelog, comments, likes, reports).

**Publish flow (client)**:
- Entry point is the Model Library only (the library panel and the model details panel), as a Publish action beside the existing per-model actions. Not offered from the VRM viewer or character customization.
- The gate runs before the publish modal opens. A failing model does not open the modal; the player is told which requirements failed, in copy that names each one. Passing models open the existing kind-agnostic publish modal with a ready payload.
- A fourth payload builder: name from the VRM title, else the library name; description generated from the file's credited authors (there is no authored description or tag field for models in this version); thumbnail from the embedded VRM thumbnail, else absent so the server fills its placeholder; `contentData` as above; no tags.
- Update-existing and delete use the existing flows unchanged.

**Download (client)**:
- A fourth library download instance, storing into the Model Library, one copy per listing, keyed by the community link so a second save refreshes the copy. Download state (none / downloaded / update available) comes from the same link fields the entity and dictionary libraries store. The model library record therefore gains the community-link fields; this is a local IndexedDB record, not an export shape.
- No dirty-copy confirmation: models are not edited locally.
- No one-click apply to the current world; assigning an Avatar to a world stays in the existing model picker.
- Device download of an Avatar listing saves the `.vrm` file itself, not a JSON wrapper. This is what the website's read-only catalog offers where its capabilities allow.
- The listing details view shows title, authors, and license terms from the stored content's license, in the same read-only form the library's model details already use.

**Section switcher** (settled by prototype; see Further Notes):
- The layout split is the browser's existing mobile rule (viewport narrower than 768px is the portrait layout), not device orientation as such.
- Landscape: a vertical sidebar rail beside the results, below the header. Rows are World, Entity, Dictionary, Avatar, then a rule, then Contest. Contest keeps its existing condition (present only while a contest exists). The header no longer carries tabs.
- Portrait: a dropdown in the header row where the tabs were. Every item renders icon and label. The closed trigger renders its own icon and label rather than relying on the select primitive's value mirroring, and its wrapper must not be a direct-child span of the trigger, because the trigger's base style line-clamps such spans and that switches them to a box layout that stacks the icon above the text (found and fixed in the prototype).
- The selected row or item is announced as current. Section state stays where it is (`browseTab`); only the control changes. Deep-link arrival (`initialTab`, event banners, notification rows) is untouched.
- The section-switcher tutorial re-anchors to the rail on landscape and the dropdown on portrait.
- The website's embedded browser gets the same switcher; nothing there is forked.

**Compatibility**:
- No world or save export-shape change. The model library's local record gains community-link fields and the widened license fields.
- An older server refuses `kind: 'model'` on publish and returns no such rows, so an older deploy yields an empty Avatars section and a publish error; an older client never asks for the kind. We own the deploy, so ship order is client-then-server or together.

## Testing Decisions

Good tests assert external behavior at a seam: bytes in, verdict out; a request in, a response out; a rendered surface a player can see and use. Never call structure.

**New seam: the license gate.** Lib-style unit tests over the pure module: every requirement passing; each requirement failing alone and reported by name; VRM 0.0 rejected; null metadata rejected; missing fields rejected. Prior art: the VRM meta reader's tests, which build GLB fixtures in-test; extend that fixture builder rather than adding binary fixtures.

**Existing seams, client**:
- VRM meta reader: the two new fields read from VRM 1.0 meta, unset for 0.0.
- Publish payload: the model builder's name, description, thumbnail, and content shape; prior art is the existing payload tests.
- Catalog kinds: the widened list and labels; the existing drift guard against the server list stays green.
- Library download hook: a model instance stores one copy per listing, refreshes on re-download, reports the three download states; prior art is the existing hook tests.
- Model library panel: Publish present on every model; a failing model shows the named requirements and opens nothing; a passing model opens the publish modal with the built payload. Prior art: the existing library panel and publish modal suites.
- Community browser: the rail on the landscape layout with its rule before Contest and Contest absent without contests; the dropdown on portrait with icons on items and trigger; section switching and deep-link arrival; the tutorial anchor. Prior art: the existing browser suites, which mount the real component with services mocked.
- Model details / listing details: license terms displayed from stored content.

**Existing seam, server** (HTTP route tests, prior art the kind and kind-validation suites): `model` accepted on create and update with a passing file; each failing requirement produces a 400 naming it; oversize content refused; a plain glTF and a VRM 0.0 file refused; placeholder thumbnail filled when none is sent; list and single reads return the kind; every kind-agnostic rule (ownership, quarantine, comments, likes, changelog, reports) holds for the new kind. Boot-schema and kind-drift assertions updated.

**Existing seam, end-to-end**: the community browser Playwright spec at both viewports covers the rail and the dropdown as a player sees them, including the closed trigger's inline icon.

Per the test bar: each guard is shown to fail when its bug is reinstated; no scenario is shaped so a mechanic cannot fire.

## Out of Scope

- VRM 0.0 files, by any allowlist. Rejected outright.
- Any self-declared license or attestation UI.
- Author-typed description or tags for Avatar listings (named for later; the payload derives both from the file).
- Publishing from the VRM viewer or character customization.
- One-click apply of a downloaded Avatar to the current world.
- Contest entries for Avatars; contests stay worlds only.
- Renaming the profile-picture vocabulary in code (`UserAvatar`, `avatarUrl`, the `/avatars` route). A separate spec if ever.
- Per-listing content-rating from the VRM's usage flags (violent, sexual, political, antisocial); the age gate and Reports cover community content as they do today.
- Duplicate detection across listings by content hash.
- Steam Workshop parity.

## Further Notes

- **Prototype**: the section switcher was chosen from three variants on branch `prototype/community-nav` (commits `af81592f` three variants, `e31e35c0` settled design, `d2e66d9e` trigger fix), a worktree at `.claude/worktrees/prototype-community-nav`. Question: what should the switcher look like at five sections? Verdict: sidebar rail on landscape, icon dropdown on portrait; scrolling pill tabs lost on both. Launch: `npm run dev -- --port 5174 --strictPort` from the worktree, then `#dev?view=mainMenu&modal=community&mode=page`. The prototype forces Contest visible and mocks Avatar with a placeholder; the real change restores Contest's condition and replaces the placeholder with the real kind.
- The prototype dropped the `community-kind-tabs` tutorial anchor; the implementation must restore it.
- The gate's requirement identifiers are the contract between client and server copy; keep them stable.
- Glossary terms **Avatar**, **Profile Picture**, and **Permissive License** are recorded in CONTEXT.md.
- This is the first kind whose content the server parses. Keep the parse to the GLB header and JSON chunk; the binary chunk is never decoded.
- The grilling that settled the license requirements and the kind's shape: VRM only (no 2D portraits); one combined spec; license read from the file; VRM 1.0 only; unknown metadata rejected; standalone kind; server changes in scope; Save to Model Library only; publish from the Model Library only.
