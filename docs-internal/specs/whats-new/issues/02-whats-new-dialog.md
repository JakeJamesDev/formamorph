# 02: What's New Dialog

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The footer version text opens What's New on every build: desktop, Android, web, and the mobile web overflow menu. This replaces both the update popout and the web changelog popout. The spec covers this in Q0, Q13, Q17, and the "Summary source", "Tile pairing rule", "One dialog for every build" and "Dev route" decisions.

- **Layout (B4).** Use the prototype on branch `prototype/whats-new`, `?variant=B4`, as the visual reference. Rewrite it properly; don't copy prototype code.
  - The header shows the version. On builds with an update bridge, the release channel select sits right-aligned beside the close button.
  - Two tabs: What's New and Recent Changes. Recent Changes keeps today's fetched changelog view until ticket 03 replaces it.
  - The What's New tab shows the first intro paragraph as the lead, then the tiles, then the remaining intro paragraphs as small text.
  - Full changelog is bottom-left. The primary action is bottom-right: Check for updates, Download, or Close, as today.
- **Tiles.** Use the spec's pairing rule on a three-column grid that becomes one column on narrow widths.
  - A Major tile has a dialogue-colored left edge and its mapped Lucide icon. An unmapped emoji gets a default icon.
  - New tiles and Fixes have no icons. Fixes sizes to its text.
  - Colors come from theme tokens only.
- **Source order (Q17).** Take the GitHub release whose tag matches the installed version, through the update service's fetch and cache. Use the bundled summary for the installed version when the fetch fails, times out within a few seconds, or the body does not parse. The build bundles only the installed version's summary file.
- **Update controls.** The available-update banner, Download, the in-flight states and the "Update Available" footer tag behave as today.
- **Dev route.** `whatsNew` replaces `changelog` and opens the dialog on the seed summary. It has canned states for web, desktop up to date, and desktop with an update available. Update the dev-route docs to match.
- **Docs.** Add the accent-edge paired tiles to `docs/Design-System.md` and its showcase. Write all copy per `docs/Writing-Guide.md`. The prototype's labels are placeholders.

## Acceptance criteria

- [x] Clicking the footer version text opens What's New on a build with an update bridge and on one without. On mobile web it opens from the overflow menu. (Bridge: `WhatsNewHost.test.tsx` desktop and Android cases. Web: live preview DOM reads at 1024 wide (footer) and 375 wide (More menu), dialog titled v3.7.0 with 6 tiles.)
- [x] Host tests with a fake release fetch prove that the GitHub body wins when it parses, and that the bundled copy wins when offline, on timeout, and on a malformed body. Prove each guard bites by reinstating the bug once. (`What's New source order` in `WhatsNewHost.test.tsx`, plus cache-before-bundled and wrong-version cases. Nine reinstated bugs each turned the right test red, then were restored.)
- [x] Host tests show the tile groups and pairs the parser describes, and a default icon for an unmapped emoji. (`What's New tiles` in `WhatsNewHost.test.tsx`; edge cases in `tileLayout.test.ts`.)
- [x] The update banner, Download, Check for Updates and the release channel select work as before. Existing update dialog tests are ported to the new dialog. (`What's New with an update bridge` in `WhatsNewHost.test.tsx`: every case from `UpdateVersionControl.test.tsx` and `UpdateDialog.test.tsx`.)
- [x] The old update popout and web changelog popout are removed, with no remaining imports. (Files deleted; typecheck green; grep finds no source reference.)
- [x] Frames `.scratch/frames/whats-new-dark.png`, `.scratch/frames/whats-new-light.png` and `.scratch/frames/whats-new-mobile.png`: the dialog at 1440×900 in both themes, and at 375 wide. (Playwright; at 1440×900 the What's New tab fits with no scroll.)
- [x] A changelog fragment has a 👤 entry for What's New. (`docs-internal/changelog.d/whats-new-02.md`)

## Landed

**Not verified**

- The footer on a real desktop or Android build. Host tests plant the bridge; no packaged build was run.

**For you**

- Open What's New from the footer and judge whether the tiles read at a glance in your usual theme. Frames: `.scratch/whats-new-02/frames/whats-new-dark.png`, `.scratch/whats-new-02/frames/whats-new-light.png`, `.scratch/whats-new-02/frames/whats-new-mobile.png`.
- The Major tiles use `hsl(var(--dialogue))` as an arbitrary Tailwind value. A `dialogue` color token in `tailwind.config.js` would make it a named token; that is a design-system call.
- New labels: the button now reads **Check for Updates** (Title Case per the Writing Guide), and the channel label reads **Release Channel**.
