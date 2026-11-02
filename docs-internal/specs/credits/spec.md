# Spec: Credits

Status: done
Status note: Closed 2026-11-02. Tickets 01–04; last landing 8469140eb. Review: spec text corrected. Gates green on 2026-11-02.
Spec session: credits — spec

## Problem Statement

The Main Menu footer has a line that credits only the item icons, and it opens a dialog about only the icons. Nothing in the game thanks the people who pay for its development: the Supporters wall is on the website.

Players also can't read most of the license text they are owed. Desktop and APK players can't easily open the packaged `THIRD-PARTY-NOTICES.md`. The file itself has gaps:

- It has no Open Font License text, no upstream MIT text and no llama.cpp entry.
- It names an avatar file that no longer exists and omits the alternate avatar.
- Its package list dates from 2026-06-29, and 51 entries have no license text.
- It doesn't name eSpeak NG, which ships inside the Text to Speech chunk.

## Solution

**Footer.** The icon line becomes **Credits**, with the same place and size. On mobile it stays in the ⋯ menu.

**Credits dialog.** The line opens a dialog with three tabs:

| Tab | Holds | When it shows |
|---|---|---|
| **Credits** (opens first) | Jake James, FieryLionite, the Game Icons authors and, on desktop, llama.cpp, all at one size | Always |
| **Supporters** | The Supporters wall, loaded live | Community on, and the age gate already accepted |
| **Licenses** | The full notices file, as collapsed rows with a name filter | Always |

**Notices repair.** A generator builds the package list from what ships, and a guard fails on drift. The hand-kept Bundled assets section gets the missing entries and license texts.

**Site.** `/supporters` stays. It and the game share one wall component. The site build also ships the notices file, with a footer link to it.

## Rulings

Settled in the grill on 2026-11-02. A settled ruling reopens on new evidence, never on a new opinion. This reading of the licenses is not legal advice.

### The surface

| # | Ruling |
|---|---|
| Q1 | Three tabs: Credits, Supporters, Licenses. Credits opens first. |
| Q2, Q17 | The Credits tab names Jake James, FieryLionite, the Game Icons authors and llama.cpp, and no one else. |
| Q3 | The footer line reads **Credits**. It takes the icon line's place beside the copyright and origin lines, at the same size. On mobile it takes the same slot in the ⋯ menu. |
| Q14 | The llama.cpp line shows only in the desktop build. |

### The Supporters tab

| # | Ruling |
|---|---|
| Q4 | The wall loads live each time the tab opens, with no cache. Offline, the tab shows a failure message and a way to try again. |
| Q5 | `/supporters` stays on the site. The site and the game share one wall component. |
| Q6, Q12 | `COMMUNITY_ENABLED` alone decides the build. Pages and Steam both have community off, so neither shows the tab. No Steam flag is added. |
| Q7 | The tab shows only if the player already accepted the age gate. Selecting Credits never prompts. Otherwise the tab is hidden. |
| Q13 | In the game, selecting a name opens the in-app profile dialog. On the site, a name keeps opening `/u/<name>`. |
| Q16 | The tab matches the site: a thank-you line and the tier sections. The Patreon link shows only when the wall is empty. |

### Licenses and notices

| # | Ruling |
|---|---|
| Q8 | The Licenses tab shows the full notices file, read from the shipped file when the tab opens. It works offline. |
| Q15 | Each entry is a collapsed row, with a filter by name. Bundled assets come first, then software. |
| Q9 | This effort repairs the notices, with a generator and a drift guard. The Bundled assets section stays hand-kept. |
| Q18 | The notices name eSpeak NG and carry the GPL-3.0 text now. |
| T03-1 | Avatars get one entry each, for the files that exist: the VRoid sample (dev and Pages dev builds) and Elaina by TronSpectra (releases). The Release Avatar License effort updates its entry when a new model lands. |
| T03-2 | eSpeak NG is a Bundled assets entry with the full GPL-3.0 text, naming `phonemizer` and the Text to Speech chunk. `phonemizer`'s generated entry keeps its declared license and its own file. The eSpeak NG effort updates both if it replaces the package. |
| T03-3 | Fonts appear twice: generated package entries with their own license files, and one hand-kept Webfonts entry with the 12 families, their copyright and the OFL text. A test fails if a family in the build is missing from it. |
| T03-4 | The guard requires fenced license text on every generated entry and non-empty text on hand-kept entries. Avatars, Mixamo, world art and the Danbooru list stay as attribution with a link. Hand-kept entries marked "Needed" in the table below carry full text. |
| T03-5 | Ticket 03 owns the pure notices parser, returning `{ name, section, text }[]`. Ticket 04 imports it. |
| T03-6 | The site footer's link reads **Licenses**. |
| T04-1 | The Licenses tab lists Bundled assets, then Standards & specifications, then Components and license texts, each in file order. It skips the Software license summary, because that repeats the Components rows. The filter ignores case. |
| Q19 | New evidence: the account site's build bundles third-party packages and ships no notices file. The site build now ships the same file, with a footer link to it. It doesn't fetch the file from GitHub, because `main` can differ from the deployed site. |

### Set elsewhere

| # | Ruling |
|---|---|
| Q10 | eSpeak NG gets its own effort and is not a release blocker. |
| Q11 | The Elaina avatar's license conflict gets its own effort. |

## What each license needs

From the sweep on 2026-11-02.

| Entry | License | Credit players can reach | Notice text in the build |
|---|---|---|---|
| Game Icons | CC BY 3.0 | **Needed** | Needed |
| Original Formamorph | MIT | Optional, kept | Needed |
| 12 font families | OFL 1.1 | Optional, not shown | Needed |
| llama-server | MIT | Optional, shown on desktop | Needed |
| npm packages | MIT, ISC, BSD, Apache-2.0, BlueOak, 0BSD, Python-2.0, Unlicense | No | Needed |
| eSpeak NG (through `phonemizer`) | GPL-3.0 | See its own effort | Needed |
| animate-ui | MIT + Commons Clause | No | Needed |
| Capacitor | MIT | No | Needed |
| AndroidX | Apache-2.0, from the published POMs | No | Listed |
| Electron, Chromium | Various | No | `electron-builder` writes them |
| VRoid and Elaina avatars | VRM 1.0, credit unnecessary | No | Listed |
| Kokoro, all-MiniLM-L6-v2 | Apache-2.0, downloaded at run time | Optional, not shown | Not bundled |
| Bundled world art | CivitAI reports no credit needed; Illustrious base terms UNVERIFIED | No | Existing line |
| Mixamo | Adobe terms; official FAQ UNVERIFIED | No | Existing line |

**CC BY 3.0, section 4(b), sets the prominence bar.** A credit for contributing authors must be at least as prominent as the other credits. So the icon authors sit on the tab that opens first, at the same size as every other name. The Doll Cleanup obligations still hold: every build ships the notices, a short footer line opens the full credit at the same prominence, and the credit names the authors of the icons we ship.

## User Stories

1. As a player, I want one Credits line in the Main Menu footer, so that I know where to find who made the game.
2. As a mobile player, I want the same line in the ⋯ menu, so that I can reach it on a small screen.
3. As a player, I want the dialog to open on the people who made the game, so that the first thing I see is the credit.
4. As an icon author, I want my name on the first tab at the same size as the others, so that my credit is as prominent as theirs.
5. As an icon author, I want the Game Icons site and license named beside my name, so that a player can find the source and terms.
6. As a player, I want to know the icons draw in my theme's colors, so that the credit states the change to the work.
7. As the upstream author, I want the origin credit kept in the footer and on the Credits tab, so that the fork still names its source.
8. As a desktop player, I want llama.cpp credited, so that the engine I run is named.
9. As a web or APK player, I want no llama.cpp line, so that the credits describe what I actually have.
10. As a Supporter, I want my name in the game, so that the thanks reach people who play.
11. As a Supporter+ member, I want my section first, so that the higher tier keeps its place.
12. As a Supporter who turned off **Show Supporter Flair**, I want my name absent in the game as well, so that the toggle covers everything.
13. As a player who accepted the age gate, I want the Supporters tab there with no extra step, so that I can read it at once.
14. As a player who didn't accept the age gate, I want no prompt from opening Credits, so that a thank-you list doesn't interrupt me.
15. As a player who didn't accept the age gate, I want no user-uploaded Profile Images, so that the gate still means what it says.
16. As a player who accepts the age gate later, I want the tab to appear with no reload, so that the state stays honest.
17. As an offline player, I want the Credits and Licenses tabs to work in full, so that the required credit never depends on a network.
18. As an offline player, I want a clear failure on the Supporters tab and a way to try again, so that I know why it is empty.
19. As a player, I want a name on the wall to open that profile in the game, so that I don't leave for a browser.
20. As a website visitor, I want `/supporters` to keep working, so that existing links still land.
21. As a player on an empty wall, I want a Patreon link, so that I can be the first.
22. As a Pages or Steam player, I want no Supporters tab, so that a build with no community shows no community content.
23. As a desktop or APK player, I want to read the license text in the app, so that I don't have to unpack the install.
24. As a player, I want the Licenses tab to cost nothing until I open it, so that the Main Menu stays fast.
25. As a player, I want to filter licenses by name, so that I can find one package among hundreds.
26. As a player, I want each license collapsed, so that I can scan the list.
27. As a font author, I want the Open Font License text in every copy, so that the build meets my terms.
28. As the upstream author, I want the MIT text in the build, so that the notice travels with the code.
29. As a llama.cpp author, I want the MIT text in the desktop build, so that the notice travels with the binary.
30. As an eSpeak NG author, I want my work named with its license, so that the build states what it contains.
31. As a maintainer, I want the package list generated from what ships, so that it can't go stale by hand.
32. As a maintainer, I want the build to fail when a shipped package has no entry or no license text, so that a gap can't return in silence.
33. As a maintainer, I want the Bundled assets section kept by hand and kept across a regeneration, so that assets outside npm stay listed.
34. As a developer, I want one wall component, so that the site and the game can't drift apart.
35. As a developer, I want the site entry to stay out of the game bundle, so that the account pages stay small.
36. As a Help reader, I want the Help topic to describe Credits, so that "who made the icons" still finds an answer.

## Implementation Decisions

### Credits dialog

- A general **Credits dialog** replaces the icon dialog. The surface ID, label, route, Help map entry and dev route all move from `iconCredits` to `credits`. The dev route takes a `tab`.
- The switcher is `Tabs`, not `ToggleGroup`, because each tab has a real panel (the segmented control rule).
- The footer line and the mobile ⋯ row both open it. The exported line constant goes away.
- Icon authors keep coming from `ITEM_ICON_AUTHORS`, so a catalog change updates the credit.
- The llama.cpp line uses the existing desktop check.
- Credits links stay as ordinary links. The Steam effort changes them when it adds its build (Q12), and the CC BY URIs must stay visible as text there.

### Tab visibility

- The Supporters tab needs `COMMUNITY_ENABLED` and the age gate's `attested`. Both checks are needed, because `attested` is always true with community off.
- The dialog reads `attested` from the provider, so accepting or revoking updates the tab while it is open. If the Supporters tab disappears while selected, the dialog falls back to Credits.
- The dialog never calls `requireAttestation`.

### Shared wall component

- One **wall component** in `src/components/` fetches through `PatreonService.getSupporters` and renders the loading, failed, empty and ready states and the tier sections. The server's order stands.
- It takes the name's rendering from its host, as a `renderName` prop. The site renders the `/u/<name>` link. The game renders a button that calls `openProfile`. A `load` prop lets the dev fixture supply rows. The component therefore imports no context, and the `@/contexts/` ban in the bundle boundary still passes.
- The site's page keeps `SiteLayout` and its subtitle, and renders the component. The failed state's try-again action lives in the component, so the site gets it too.
- The component joins the boundary's allow list and the site's Tailwind scan list. The reachable-module ceiling rises deliberately, with its comment.
- It fetches on mount and writes through `useMountedRef`, so closing the dialog cancels the write. No server change is needed: the route is public and allows any origin.

### Licenses tab

- A pure parser turns the notices text into ordered entries: `{ name, section, text }`. The file's format rule is that every entry is a `###` heading under a `##` section. The Bundled assets bullets move to that form.
- The tab fetches the file relative to the build's base path, once per dialog open, when the tab first opens. This reaches `dist/` on the web, `app://local` on desktop and the APK's web root.
- The Vite plugin also serves the file in dev, so the dev route and preview work.
- A row expands to show its text as plain preformatted text. Only an expanded row mounts its text. The filter matches entry names.

### Notices generator

- A generator script, on an npm command beside `gen-item-icons`, writes the package list and the license summary. It keeps the hand-kept section and the Standards section as they are.
- The source of truth is the production build's module graph, not `npm ls`. Most runtime packages are `devDependencies` here, so a dependency walk misses them. The desktop app's production `dependencies` tree, Capacitor and packages a dist inlines are added through a hand-kept map.
- The same map supplies license text for packages that ship none, such as the 51 entries at the start, and corrects a wrong declared license.
- The **drift guard** runs inside the app build and the site build. It fails if a package in that bundle or on the map's list has no entry, or if an entry has no license text. Version differences count as drift. The generator lists the union of both builds' packages, so one file serves both.
- `shipNotices` runs in the site build too (Q19). The site's footer links to the file through the build's base path.
- Fonts come through the module graph with the full OFL text. Roboto's license follows its package, which now says OFL.

### Hand-kept entries to add or correct

- Upstream MIT text, in full.
- llama.cpp MIT text and LLVM OpenMP text. Vendored libraries in the binaries need checking.
- eSpeak NG with the GPL-3.0 text, naming where it ships (Q18).
- The default avatar's real path, and the Elaina model by TronSpectra.
- The header's generated date goes away or comes from the generator.

### Shape

- World and save files do not change. No export-shape change.
- No new visual pattern: `Tabs`, `Collapsible` rows, the existing filter input.

### Copy and docs

- Write user-facing copy from a facts list under `docs/Writing-Guide.md`, not from this spec.
- The How to Play topic becomes **Credits**, with route and keywords that keep "who made the icons" answerable. Help vectors need `build:help-vectors` before release.
- `CONTEXT.md`'s **Supporters wall** entry changes: it is no longer only a page on formamorph.ai. Its "avoid: credits" stays right: the wall is a tab in Credits, not a synonym.
- `STEAM-RELEASE-CHECKLIST.md` records the two separate efforts.

## Testing Decisions

A good test drives the public surface and reads what a player reads. It doesn't assert on which function ran.

| Seam | What the tests do | Prior art |
|---|---|---|
| Credits dialog | Render it. Read the names, links and tabs. Vary community, attestation and desktop. Assert the fallback when attestation goes away. Assert no prompt opens. | The icon dialog test |
| Main Menu footer | Render the real menu. Select **Credits** on desktop and in the ⋯ menu. | `src/test/mainMenu.tsx` |
| Wall component | Mock the fetch. Assert sections, order, empty link, failure and try-again. Assert the name uses the host's behavior in each host. | `SupportersPage.test.tsx` |
| Notices parser | Run on the real shipped file, not a fixture. Assert sections in order, every entry named and non-empty, and known entries present. | `avatarLicenseGate.bundledAvatars.test.ts` reads real files |
| Drift guard | Feed it a module list with a package absent, and an entry with no text. Assert both fail. Assert the plugin is in the app and site builds. | `shipNotices.test.ts` |
| Bundle boundary | The existing test, with the component on its allow list. | `site/bundleBoundary.test.ts` |

- Prove the guard bites: reinstate an unlisted package and watch the build fail.
- The credit test must fail if an author from `ITEM_ICON_AUTHORS` goes missing from the first tab.
- UI verification goes through `verify-ui` on the dev route: realistic viewport first, the tabs in both themes, and mobile.

## Out of Scope

- Replacing or complying with eSpeak NG (Q10). This effort only names it.
- Resolving the Elaina license conflict (Q11).
- A Steam build flag and Steam link handling (Q12).
- Caching the wall (Q4).
- Credits for fonts, Kokoro, avatars or world art (Q2).
- Any server change.
- Credits in the app outside the Main Menu.

## Further Notes

- The Mixamo raw-file item stays open in `STEAM-RELEASE-CHECKLIST.md`. Raw `.fbx` files sit at the root of `dist/`.
- The sweep's import walk over-counts slightly, because it follows some test and Electron host packages. The module graph replaces it.
