# Enter World prototype — round three

Status: resolved

Accepted after the navigation shadow was removed. Production requirements and the earlier library-default decisions are captured in the [implementation spec](spec.md).

Branch: `prototype/enter-world`. Run `npm run prototype:enter-world`, or open `/?variant=unified#dev?view=mainMenu&modal=enterWorldPrototype` on the development server.

## Current iteration

- **Desktop:** one compact navigation column, matching the prompt editor's visual style. Nested trait categories, starting location, and library additions share it. The hierarchy stays fully expanded; selecting a group opens its traits.
- **Content:** a wider workspace, with two columns of trait choices when space permits. No secondary category browser, breadcrumb buttons, or group index competes with the navigation.
- **Phone portrait:** a Categories disclosure expands the hierarchy inline above the content, with a bounded scroll area. Selecting a category collapses the navigation. A shared contrasting background, bottom border separate navigation from choices. Expansion and collapse take 150 ms, with reduced motion respected.
- **Category cues:** selected/available counts distinguish editable categories from folders and update as choices change. Groups with only descendants are noninteractive labels; empty categories and branches are hidden, including General when it has no traits. Examples initially select a category with options.
- **Space:** a single header row places Introduction beside Cancel; tighter content headings leave more room for choices.
- **Preserved:** markdown introduction modal, library artwork, in-memory defaults, and the separate Avatar handoff.

The prototype example control switches between a five-level background and the bundled drone hierarchy. Phone landscape remains out of scope; tablets are low priority.

Prior iterations remain in Git history. Round two was captured in `eb33ae2f`; it was rejected as clunky and visually disconnected. This round retains its sample data but replaces the navigation.

## Limits

State remains in memory; no game starts or library data changes. Stat-effect previews and placeholder resolution are still implementation work. Library dictionary ordering remains after authored books.

## Verification

Checked desktop at 1440 × 900 and phone portrait at 390 × 844. The five-level hierarchy stays accessible; choosing a phone category collapses the inline hierarchy, and selected traits survive category changes.

TypeScript, lint, and the production build pass. The existing suite passed 8,467 tests (3 skipped) in 55.29 seconds wall time. No prototype-specific tests were added.
