# Spec: Docs Sweep

Status: ready-for-agent
Spec session: docs-sweep — spec

## Problem Statement

The Writing Guide and the copy sweep were tightened. The wiki pages in `docs/` were written before that, so their wording drifts from the current rules. Many pages also describe the app as it was: controls that moved or were renamed, steps that changed, limits that no longer hold, and features that shipped without a mention on the page that owns their subject.

The same pages are Formaquestion's search corpus and are bundled into the app. A stale page gives a player a wrong answer in the wiki and in the guide.

## Solution

Two passes over every guide page, split into page groups so no session holds more than one area of the app:

- **Staleness pass:** check each claim on the page against the app on `main`. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page.
- **Wording pass:** rewrite the page under the Writing Guide, after its staleness pass landed.

Each group gets one ticket per pass. The staleness ticket blocks the wording ticket of the same group. The Reference group goes last, because the Glossary must match the terms the other groups settle.

## Rulings

Settled with the user on 2026-10-31.

| # | Ruling |
|---|---|
| Q1 | Two passes, separate tickets: staleness and wording |
| Q2 | Staleness runs first on each group; it blocks that group's wording ticket |
| Q3 | Ten page groups, sized by the code area each page describes (table below). Formaquestion is its own group (Q8) |
| Q4 | Out of scope: `Changelog-v2.md`, the released sections of `Changelog.md`, `docs/adr/`, `docs/agents/`, `Writing-Guide.md`, `Design-System.md` |
| Q5 | The Reference group (WorldFormat, Glossary, _Sidebar) is last: its staleness ticket waits for every other wording ticket |
| Q6 | Verification per ticket: the docs tests and `npm run copy:sweep` on the group's pages. No help baseline run |
| Q7 | The help vectors are rebuilt once, at spec close. No ticket commits `build:help-vectors` output |
| Q8 | Formaquestion (about 13k words) is split from Tools and Test Bench into its own group |
| Q9 | Each wording ticket opens with a structure check: readability on every page, and a split assessment on every page over 4,000 words |
| Q10 | A page splits when it serves readers who come for different tasks. Word count alone never splits a page |
| Q11 | "Exact casing" of a control name means the label string in source. CSS `text-transform` is styling: a tag rendered EXISTS is written "exists" |
| Q12 | An icon button is named by its verb, with one line saying it is an icon button and what its tooltip reads |
| Q13 | Links to the playable app point at formamorph.ai/play/, the released build with Community on |
| Q14 | A "short mention" is one row or one sentence per missing setting or state a player acts on. No control-by-control lists of a dialog the page only names. A feature another group's page owns gets one line that links there |
| Q15 | A feature behind a server setting is documented conditionally ("When a listing waits for review…"), in its on-state behavior. Landed names the setting |
| Q16 | Docs never describe a bug's output as behavior. A claim the bug makes false is removed with no replacement, and Landed names the bug |

## Page groups

| Group | Pages | Code area | Tickets |
|---|---|---|---|
| Play | Home, How-to-Play, Starting-a-Game, Library, Saves-and-Backup, Install-on-Android | Main menu, Library board, GameViewer, saves, Android | 01, 02 |
| AI and settings | Connect-Your-Own-AI, Settings, Image-Generation, Memory, Avatars | Settings, endpoints, image gen, memory, VRM | 03, 04 |
| Personas and community | Personas, Persona-Authoring, Community-Creations | Personas, community browser, account site | 05, 06 |
| Editor core | WorldEditor, World-Editor-Overview, World-Editor-Locations, World-Editor-Entities, World-Editor-Openings, World-Editor-Media | World Editor shell and the location, entity, opening and media managers | 07, 08 |
| Editor data | World-Editor-Stats, World-Editor-Items, World-Editor-Traits | Stats, Items, Traits | 09, 10 |
| Editor text | World-Editor-Dictionary, World-Editor-Placeholders, LinkedContent, TextFormatting, Prompts | Dictionaries, placeholders, linked content, narration formatting, prompt chips | 11, 12 |
| Scripts | ScriptsGuide, StatCodeGuide | Scripts, stat code, script surface | 13, 14 |
| Tools and Test Bench | Tools, Test-Bench | World Tools, Test Bench | 15, 16 |
| Formaquestion | Formaquestion | Formaquestion, its settings, the Mascot | 17, 18 |
| Reference | WorldFormat, Glossary, _Sidebar | World export shape, the glossary terms, wiki nav | 19, 20 |

## User Stories

1. As a player, I want each wiki page to describe the app I have, so that the steps I follow work.
2. As a player, I want control names in the docs to match the labels on screen, so that I can find each control.
3. As a player, I want removed features gone from the docs, so that I don't look for them.
4. As a player, I want shipped features mentioned on the page that owns their subject, so that I learn they exist.
5. As a player, I want Formaquestion answers built from current pages, so that the guide does not repeat old behavior.
6. As a player, I want the docs to use the same words as the app, so that one thing has one name.
7. As a player, I want short paragraphs and scannable bullets, so that I can find a step without reading the whole page.
8. As an author, I want the World Editor pages to match the current panels and tabs, so that I can build a world from them.
9. As an author, I want the Scripts Guide in the technical register, so that every statement is exact and testable.
10. As an author, I want the world format reference to match the export shape, so that hand-edited files import.
11. As an author, I want the Glossary to match the terms the pages use, so that a definition never contradicts a page.
12. As a developer, I want each ticket to hold one area of the app, so that its session reads one code area and a short page set.
13. As a developer, I want the staleness pass to land before the wording pass on the same pages, so that no wording work is spent on text that is then cut.
14. As a developer, I want heading renames to keep every anchor that points at them, so that Take Me There, help topics and code guide links still resolve.
15. As a developer, I want a contradiction between a page and the code named, not fixed in code, so that a docs ticket never changes behavior.
16. As a developer, I want the help vectors rebuilt once at close, so that parallel tickets don't collide on the vectors file.
17. As the user, I want each ticket to list what it could not settle from the code, so that I can rule on intent.
18. As a player, I want a long page split by the task I came for, so that I don't scroll past authoring detail to find a play step.
19. As a player, I want each section to lead with its point, so that I can stop reading once I have the answer.
20. As a developer, I want every split ruled before it lands, so that the wiki nav changes only on purpose.

## Implementation Decisions

### Truth source

- The app on `main` at the ticket's Base is the truth for the staleness pass. Unreleased behavior on `main` counts: the wiki publishes on push to `main`.
- When a page and the code disagree and the code looks wrong, the ticket fixes nothing in code. It writes the page to the code's behavior and names the case under the ticket's Landed section, for the user.
- When intent is unclear (a feature looks half-built, or two surfaces disagree), the ticket asks the spec session before it writes the page.

### Staleness pass

- Read the page, list its checkable claims (control names, tab names, steps, limits, defaults, file formats, keyboard shortcuts, what a setting does), and check each one in source or in the dev-router preview.
- Fix wrong claims. Remove claims about removed features.
- Add a short mention of shipped behavior that belongs on the page's subject and is missing. A missing whole page is out of scope: the ticket names it under Landed.
- Settings defaults come from the settings defaults module. Control labels come from the component source.
- The staleness pass does not reword correct text. Wording is the next ticket's job.

### Structure check

- Runs first in each wording ticket, after the staleness pass settled the facts (Q9).
- Every page gets a readability check: scannable headings, steps as lists, no section that buries its point.
- Every page over 4,000 words gets a split assessment. A page splits when it serves readers who come for different tasks, such as play vs authoring or setup vs reference (Q10).
- The ticket sends each proposed split to the spec session: the page, the new pages, and the reader task of each. The spec session rules, and escalates to the user when the spec and the conversation don't settle it.
- A ruled split lands before the rewrite. The new pages go in the sidebar and on Home, and every anchor table that named a moved heading points at the new page.
- Pages under 4,000 words split only when they plainly serve two reader tasks.

### Wording pass

- Read the Writing Guide first: "Before you write", "Labels, capitalization, and complete sentences", "Controlled product terms". The Scripts group also reads "The technical register".
- Run `npm run copy:sweep` on the group's pages and triage each notice under the copy-sweep skill. The script skips `docs/*Guide.md`, so ScriptsGuide and StatCodeGuide get the hand sweep the skill requires.
- Control names in the docs take the exact casing of the label string in source (Q11).
- The wording pass changes no facts. A fact that looks wrong goes to the spec session, not into the rewrite.
- The session writes the rewrite itself. No delegation of copy to a subagent (copy-sweep skill).

### Headings and anchors

- Docs headings are anchors for the surface map, help topics, code guide links and Take Me There. A renamed or removed heading updates every table that names it in the same ticket. The docs tests list the broken ones.
- Keep a heading's wording when only its anchor would change and the old wording still reads correctly.

### Changelog

- No changelog fragment. Docs text is not an app change.

### Close

- At spec close: `npm run build:help-vectors`, commit the vectors, then the close gates.

## Testing Decisions

- The seam is the existing docs test suite, which reads `docs/*.md` directly: docs coverage of the app, the bundled Docs Index, and the code guide links. They catch a broken anchor, an unclosed fence, a missing glossary term, and a surface left without a heading.
- `npm run copy:sweep <pages>` is advisory. The ticket triages every notice and records the count before and after.
- No new tests. A docs ticket adds no code beyond anchor-table updates.
- No help baseline run (Q6).
- Each ticket runs the four gates through the ticket flow, as usual.

## Out of Scope

- `Changelog-v2.md` and the released sections of `Changelog.md`: shipped text.
- `docs/adr/`: decision records. A stale ADR is named under Landed for a later "superseded" note, not rewritten.
- `docs/agents/`: agent docs, not player copy.
- `Writing-Guide.md` and `Design-System.md`: the rule sources.
- UI copy in components. A label that contradicts its page is named under Landed; the copy sweep owns UI copy.
- Code changes, except anchor tables that follow a heading rename.
- New pages, except the pages a ruled split creates.
- The help baseline and the help vectors per ticket.

## Further Notes

- Three tickets can run at once: groups share no pages. Anchor tables are a shared surface; prepare's rebase handles two tickets editing one table.
- A split adds lines to `_Sidebar` and Home, which belong to the Reference and Play groups. A wording ticket that splits a page adds only those links there; the owning group's tickets keep the rest.
- A ticket that finds a stale ADR, a missing page, or a contradicting UI label lists it under Landed. `close-spec` gathers the lists.
