# Spec: What's New

Status: ready-for-agent
Spec session: whats-new — spec

## Problem Statement

A player who updates Formamorph learns what changed only by clicking the version text in the footer. That opens a raw changelog: one line per entry, many versions deep, in a scrolling box. Reading what one release is about takes far too long, so most players never do. The same terse list is the GitHub release body, so the release page has the same problem. The release's real story already exists, because the Discord post is written for each release. But the app and the release page never show it.

## Solution

Each release ships a short **Release Summary** in the Discord post's voice: a few intro paragraphs, then the Major, New and Fixes highlights. The app shows it as **What's New**, a dialog that opens by itself once per version after an update. The footer version text opens it again at any time.

The dialog keeps today's update controls. The release channel sits in the header beside the close button. Two tabs split the content:

- **What's New**: the intro, then the highlights as tiles. Major highlights are wide tiles with an accent edge and an icon. Each one sits beside a related New tile. Fixes fills the last row. The colors follow the app theme.
- **Recent Changes**: the one-line-per-entry list for the installed version and the two before it, read from the changelog bundled with the app.

The Full changelog link stays bottom-left. When an update is available, the banner can preview the new version's summary before the player downloads it.

The Release Summary is one file per release. The release workflow refuses to ship without a valid one. It becomes the GitHub release body, and the release skill turns it into the Discord post. One text serves the app, GitHub and Discord. The app reads the GitHub copy first, so post-release edits reach players. It falls back to the copy bundled in the build when offline.

## Rulings

Settled in the grill on 2026-11-19. The prototype is on branch `prototype/whats-new`, verdict commit `7e3d5b8cf`. Launch entry `proto-whats-new` serves it on port 5352, and `?variant=B4` is the winner.

- **Q0 Layout**: B4. Tabs What's New | Recent Changes. The release channel select is in the header, right-aligned beside the close button. Full changelog is bottom-left and the primary action is bottom-right. Major tiles span two of three columns, with a dialogue-colored left edge and icon on a plain card. Each pairs with a New tile. New tiles and Fixes carry no icons. Fixes fills the last row's gap and sizes to its text. Colors come from theme tokens, never status colors.
- **Q0b Release body**: the GitHub release body becomes the Release Summary. Older builds render it oddly, and that is accepted.
- **Q0c Metadata in structure**: the markdown structure carries the summary's metadata. There are no inline tags.
- **Q1 Icons**: the author writes an emoji at the start of each Major item. The app maps a fixed set of emoji to Lucide icons.
- **Q2 Location**: one file per release at `docs/whats-new/<version>.md`. The wiki sync is top-level only, so these never become wiki pages.
- **Q3 Fresh install**: What's New stays closed on a fresh install and records the version as seen.
- **Q4 Ordering**: What's New opens first. The event acknowledge poster and the main-menu tutorial wait until it closes.
- **Q5 Overflow**: a long summary scrolls. Validation warns past a size and never fails on length.
- **Q6 Recent Changes**: shows the bold leads only, for the installed version and the two before it.
- **Q7 Update preview**: when an update is available, the banner links to the new version's summary, shown in the same layout.
- **Q8 Web**: the web build follows the same once-per-version rule.
- **Q9 Skipped versions**: after a jump of several versions, What's New shows only the installed version. Recent Changes covers the rest.
- **Q10 Several updates pending**: the preview shows only the newest version, which is the one Download installs.
- **Q11 Every release**: every release, patches included, ships a summary and opens What's New once.
- **Q12 Validation**: the release workflow fails when the version's summary is missing or malformed.
- **Q13 Unknown emoji**: the app shows a default icon. It never crashes and never shows the raw emoji as the icon.
- **Q14 Discord**: the release skill writes the summary once. The Discord post is that summary plus the usual footer links.
- **Q15 GitHub body**: the summary plus a Full changelog link, and nothing else.
- **Q16 Pre-releases**: same rule as stable releases. Each pre-release needs a summary and opens What's New once.
- **Q18 End of summary** (ticket 01): the summary ends at the first thematic break (`---`) or at the end of the file. `## Fixes` holds every paragraph up to that point. The workflow appends `---` and then a Full changelog link to the wiki changelog, the same URL the app uses.
- **Q19 Required parts** (ticket 01): no section is required on its own. A summary with no Major items, no New items and no Fixes text is an error. Missing intro paragraphs are a warning.
- **Q20 Title** (ticket 01): the title must be `# Formamorph v<version>`, pre-release suffix included. The validator errors when that version differs from the file name or the tag.
- **Q21 Lenient parsing** (ticket 01): stray content inside a section is dropped with a warning. That covers an extra paragraph, a nested bullet under a New item, or a second nested bullet. These are errors: unknown heading, missing or mismatched title, a Major item without an emoji, an unmapped emoji, an empty summary, and a Major or New item not in `**Title** — body` form. The length warning fires about 10% past the 3.7.0 seed's visible text.
- **Q22 Emoji set** (ticket 01): the map is about 30 common release themes and ignores U+FE0F when matching. Adding an emoji later is a one-line change.
- **Q23 Update phases** (ticket 02): the header always shows the installed version. The banner under it carries the update phase: available (text plus Download), downloading or downloaded (a status line), error (the error text), or checking and up to date (one muted line after a manual check). The footer's primary action is Check for updates when idle, up to date or after an error. It is Close when an update is available, a download is in flight, or on web. Download appears only in the banner.
- **Q24 Source chain** (ticket 02): the live GitHub body comes first, then the cached release list's body for the installed tag, then the bundled file. A source counts only when it parses with no errors (warnings are fine) and its title names the installed version.
- **Q25 Fetch wait** (ticket 02): when the summary is not ready on open, the tab shows a short loading state for up to 4 seconds and then shows whichever source won. It never swaps the text while the player reads. Web keeps its lazy fetch on open. Ticket 04's auto-open does its own fetch on load.
- **Q26 No summary** (ticket 02): when no source yields a summary, the dialog opens on Recent Changes and the What's New tab shows one muted line.
- **Q27 Host seam** (ticket 02): one What's New host in the main menu owns the open state. It exposes an open action, used by the footer, the overflow menu and the dev route, and its open state. Ticket 04 builds the open-once record and the holds for the event poster and menu tutorial on that state. Ticket 05 adds its preview link inside the banner.
- **Q28 Unmapped emoji in the app** (ticket 02): the app tolerates one error kind, the unmapped emoji, and renders it with the default icon. Every other error falls through to the next source (Q24). The release validator still fails on it. Parser problems carry a `code` so the two can be told apart. This matters most for ticket 05: a newer release's body may use emoji that the installed build's map lacks.
- **Q17 Source order**: the app reads the summary from the GitHub release for the installed version first. The bundled copy is the fallback when the fetch fails, times out, or does not parse.

## User Stories

1. As a returning player, I want a short summary of what changed to open after I update, so that I learn the release's story in a minute or two.
2. As a returning player, I want What's New to open only once per version, so that it never nags me on every launch.
3. As a new player, I want my first launch to show the First-Time Flow only, so that a changelog does not greet me before I know the app.
4. As an existing player updating to the first build with What's New, I want it to open, so that the feature reaches people who already play.
5. As a player, I want the biggest changes shown as larger tiles with an icon, so that I can see at a glance what matters most.
6. As a player, I want related changes placed side by side, so that the summary reads as connected features, not a list.
7. As a player, I want fixes condensed into one short box, so that they don't crowd the features.
8. As a player, I want the tiles to use my chosen color theme, so that the dialog looks like the rest of the app.
9. As a player, I want the version text in the footer to reopen What's New, so that I can read it again later.
10. As a player, I want a Recent Changes tab that lists each change in one line, so that I can scan everything in the last few versions.
11. As a player, I want Full changelog still linked, so that the complete history stays one click away.
12. As a desktop player, I want the release channel select and the update actions in the same dialog, so that updating works as it does today.
13. As a desktop player with an update available, I want to preview the new version's summary, so that I can decide whether to download it now.
14. As a desktop player several versions behind, I want the preview to show the version Download will install, so that it matches what I get.
15. As an Android player, I want the same dialog and once-per-version behavior, so that every build behaves the same.
16. As a web player, I want What's New to open after a deploy changes the version, so that I learn about changes on the web too.
17. As a mobile web player, I want What's New in the overflow menu where the version shows today, so that I can still reach it.
18. As a player who skipped versions, I want What's New to show the version I'm on, with Recent Changes covering the ones I skipped.
19. As a player who is offline, I want What's New to still open with the bundled summary, so that I always see something.
20. As a player who is online, I want the newest text from the GitHub release, so that corrections after release reach me.
21. As a player, I want What's New to open before a contest poster or menu tutorial, and those to wait their turn, so that dialogs never stack.
22. As a player, I want a long release to scroll inside the dialog, so that nothing is cut off.
23. As a pre-release player, I want each pre-release to show its own summary, so that I know what I'm testing.
24. As the developer, I want one summary file per release, so that I write the release story once for the app, GitHub and Discord.
25. As the developer, I want the summary to read cleanly as plain markdown on GitHub and Discord, so that one text works everywhere.
26. As the developer, I want headings to set importance and nested bullets to set pairing, so that no tag syntax shows in rendered markdown.
27. As the developer, I want a leading emoji to choose a Major tile's icon, so that the icon is visible in the source and maps to the app's icon style.
28. As the developer, I want the release workflow to fail on a missing or malformed summary, so that no release ships without one.
29. As the developer, I want an unknown emoji or heading to fail validation, so that a typo is caught before the release.
30. As the developer, I want a size warning for long summaries, so that I notice when What's New will scroll.
31. As the developer, I want the release skill to draft the summary from the In Progress changelog in the Discord voice, so that writing it is fast.
32. As the developer, I want the release skill to produce the Discord post from the same file, so that the two never drift.
33. As the developer, I want to edit a published GitHub release body and have the app show the edit, so that I can fix a mistake without a new build.
34. As the developer, I want a malformed hand-edited GitHub body to fall back to the bundled copy, so that a bad edit never breaks the dialog.
35. As the developer, I want the dialog reachable from the dev-router on a canned summary, so that it is checkable offline.
36. As a player on an old build, I want the new-format release notes to still show without a crash, even if they look different.

## Implementation Decisions

- **Release Summary format.** One markdown file per release, in this shape. The 3.7.0 example is the prototype's sample content:

  ```markdown
  # Formamorph v3.7.0

  First intro paragraph: the lead under the tabs.

  Further intro paragraphs: small text under the tiles.

  ## Major

  - ⏳ **Since Last Turn** — a tray above the action box lists what you did between turns, …
  - 🗓️ **Daily routines** — entities stay, wander or patrol by time of day, …
    - **Map strangers** — the in-game Map shows entities you haven't met, …

  ## New

  - **Avatar looks from stats and traits** — stats and traits change Avatar sliders and colors, …
  - **Openings and Connections tabs** — openings get their own World Editor tab, …

  ## Fixes

  The item parser properly finds characters named by an alias, … and more.
  ```

  - `## Major`, `## New` and `## Fixes` are the only headings. `## New` and `## Fixes` are optional.
  - Each Major item starts with one emoji. A Major item may have one nested bullet, which is its paired New highlight. Each other item is `**Title** — body`.
  - `## Fixes` is prose, not a list.
  - Any other content after the last section, such as the workflow's Full changelog link, is ignored.
- **One parser, two users.** A single pure **Release Summary parser** module turns markdown into a typed summary: version, intro paragraphs, Major items with icon and optional pair, New items, and Fixes text. It also reports validation problems: unknown heading, missing title, Major item without an emoji, emoji outside the icon map, empty summary, and a length warning. The app imports it. The release workflow's validator loads the same module, so the app and the validator never disagree. It follows the precedent of the changelog slice that the Vite config loads: no imports, no DOM.
- **Emoji icon map.** A fixed table maps emoji to Lucide icons. It lives beside the parser, so validation and rendering share it. An unmapped emoji fails validation (Q12) and falls back to a default icon in the app (Q13).
- **Tile pairing rule.** The rule comes from the prototype. It uses a three-column grid. A Major takes two cells and its pair takes one. A Major with no nested pair takes the next unpaired New item. A Major with nothing left to pair spans the full row. The remaining New items fill rows of three. Fixes takes the last row's empty cells, or a full row when no cells are empty, and sizes to its text. On narrow widths the grid becomes one column.
- **Summary source (Q17).** For the installed version, the app looks for the GitHub release whose tag matches it. It reuses the update service's release fetch and cache. If the fetch fails, times out within a few seconds, or the body does not parse, the app uses the bundled summary. The build bundles only the installed version's summary file.
- **Update preview (Q7, Q10).** The newest available release's body is parsed with the same parser and rendered in the same layout. Only the newest version is previewed.
- **Recent Changes (Q6).** The build bundles the bold leads for the installed version and the two before it, read from the changelog by the same rules as today's release-note extraction. These versions may cross a minor-series boundary. This is a separate bundled slice from the Formaquestion docs-index slice, which stays unchanged. Recent Changes no longer reads GitHub release bodies.
- **Open-once rule (Q2, Q3, Q8, Q11, Q16).** A per-device record keeps the last version for which What's New opened. Like the First-Time Flow records, it is never exported. What's New opens by itself when the record differs from the installed version, on every build target and channel. A fresh install records the version without opening. "Fresh" means the welcome intro has not been seen. A missing record alone does not mean fresh, because every existing player has no record when the first build with this feature ships.
- **Startup ordering (Q4).** What's New waits for the welcome intro and the First-Time Flow step, as the event poster already does. While What's New is due or open, the event acknowledge poster and the main-menu tutorial stay held. They follow the existing pattern of gating on intro and first-run.
- **One dialog for every build.** The footer version text opens What's New on desktop, Android, web and mobile web. This replaces both the update popout and the web changelog popout. On builds with an update bridge, it keeps the update controls and the "Update Available" footer tag. On builds without one, it shows a Close button where the update action would be.
- **Release workflow (Q12, Q15).** The release job validates `docs/whats-new/<tag version>.md` with the shared parser, before any artifact is published. It fails on errors and prints warnings. The release body becomes the summary file plus a Full changelog link. Today's bold-lead extraction stays, but only for the Recent Changes bundle.
- **Release skill (Q14).** The skill drafts the summary from the In Progress changelog in the audience voice, writes it to `docs/whats-new/`, and commits it with the release. It derives the Discord post from the same file plus the usual footer links. The skill files live outside the repository, so this edit is an out-of-repo step.
- **Dev route.** `whatsNew` opens the dialog on a canned summary and a canned update state, replacing the `changelog` entry. Its variants cover web, desktop up to date, and desktop with an update available.
- **No export shape change.** Worlds and saves are untouched. The only new state is one per-device local record.

## Testing Decisions

- A good test drives behavior through the seam the feature exposes, never through private helpers or the DOM structure of a tile. A test asserts what a player or the release workflow observes: which highlights show, in which group and pair, whether the dialog opens, which text source wins, and what validation reports.
- **Seam 1: Release Summary parser.** Fixture markdown files in, typed summary and validation report out. Cover the full 3.7.0 shape, optional sections absent, a Major without a pair, unmapped emoji, an unknown heading, a missing title, the trailing Full changelog link ignored, and a hand-edited body with extra content. The workflow validator is tested by running it on a valid fixture and an invalid one and reading the exit code. Prior art: the changelog-format and changelog-slice tests.
- **Seam 2: What's New host.** Render it in jsdom with a fake release fetch and a controlled local record. Cover:
  - It opens once per version and not on a fresh install.
  - It opens for an existing player whose record is missing.
  - The GitHub body wins when it parses, and the bundled copy wins when offline, on timeout, or on a malformed body.
  - Tile groups and pairing appear as the parser describes them.
  - Recent Changes shows the bundled leads for three versions.
  - The update preview shows the newest pending summary.
  - The event poster and menu tutorial stay held while What's New is open.

  Prove each guard bites by reinstating the bug once. Prior art: the update service tests (fake fetch), the changelog entry dialog tests, and the first-time flow tests.
- No test transforms or renders real release images. No probe runs, because no AI prompt changes.

## Out of Scope

- Backfilling summaries for releases before the first build that ships What's New.
- A version picker for skipped versions (Q9).
- Previewing more than the newest pending version (Q10).
- Changing the wiki changelog or its format.
- Changing the Formaquestion docs index or its changelog slice.
- Making older builds render the new release bodies well (Q0b).
- Localization of summaries.

## Further Notes

- **Export shape:** no world or save `.json` change.
- **Changelog:** the landing adds a 👤 entry for What's New, and a ⚙️ entry for the release workflow change.
- **Copy:** before writing any label, read `docs/Writing-Guide.md`. This covers the tab names, the banner, the preview link, and the version-text tooltip. The prototype's labels are placeholders.
- **Design:** B4's accent edge and paired tiles are a new visual pattern. The user approved it through the prototype. It should be added to `docs/Design-System.md` and its showcase.
- **Fit:** at 1440×900, the 3.7.0 sample fills the What's New tab exactly with no scroll. Larger releases will scroll (Q5).
- **Prototype screenshots:** the prototype's capture script is in that worktree's `.scratch/whats-new/`. The Browser pane suspends rendering while hidden, so the screenshots came from Playwright.
