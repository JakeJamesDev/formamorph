# Spec: App Copy Sweep

Status: ready-for-agent
Spec session: app-copy-sweep — spec

## Problem Statement

The Writing Guide gained "Before you write" on 2026-10-30 and became the one copy rule source on 2026-10-31. Most in-app help and description copy was written before that. It drifts from the rules: em-dash asides, long sentences, glossary words the screen never shows, "character" and "picture" for entity and image, uncontracted help lines, and help paragraphs rendered without the Hint or Meta roles.

`npm run copy:sweep --all` reports about 1,450 notices in `src/` outside tests, after case-only label hits are set aside. The script reads only some of the drift. Every string still needs the facts-list check.

The sweep is too large for one session. A session that holds the whole app loses the facts of each screen.

## Solution

Sweep the app's copy one screen group at a time. Each group is one ticket, sized to about 150 real notices. Each ticket rewrites the copy in its files under the Writing Guide, swaps raw help paragraphs to Hint or Meta, fixes serious label and comment problems, and updates the tests that pin each string.

Settings gets a second pass. Help topics wait for the docs sweep, so they copy facts from the updated wiki pages. The group that holds the World Editor's Overview tab waits for the Overview Voice Pass.

The spec session writes one 👤 changelog entry when the spec closes.

## Rulings

Settled with the user on 2026-10-31.

| # | Ruling |
|---|---|
| Q1 | Every copy role is in scope. Help lines, ⓘ popovers, tooltips, help topics and descriptions get the full sweep. Status, error and confirmation text follow their own role rules. Labels (Q5) and code comments (Q6) get fixes for serious problems only |
| Q2 | Raw help paragraphs move to Hint or Meta in the same ticket that rewrites them |
| Q3 | Settings gets a second pass under the 2026-10-30 and 2026-10-31 rules |
| Q4 | Mod and admin tools, the design-system showcase, and dev-only screens are in scope |
| Q5 | A label is fixed only for a wrong term (character, picture, phone), a parenthetical aside, or a name that differs from its own help. Each rename gets a check of Find and the tests. Case-only drift is a nit and stays |
| Q6 | A code comment is fixed only when it is false, tells history, or uses an image verb the technical register bans. An em-dash alone is a nit and stays |
| Q7 | The help-topics ticket waits until every docs-sweep wording ticket lands |
| Q8 | The ticket that holds the World Editor's Overview tab waits for the Overview Voice Pass |
| Q9 | Tickets group files by screen, about 150 real notices each. Nit-only hits (Q5, Q6) do not count toward the budget |
| Q10 | Tickets write no changelog fragment. The spec session writes one 👤 entry at spec close |
| Q11, Q13 | A ticket fixes a code bug in place only when the fix stays in one file, no other screen relies on the behavior, and a test fails without the fix. The ticket lists each such fix as a drive-by. A larger bug goes under Findings for the user |
| Q12 | The shared-components ticket owns shared strings. Other tickets read shared components and never edit their copy |
| Seam | Existing tests that pin strings, plus the copy:sweep count before and after. New pins only where the copy-sweep skill says. Each in-place bug fix gets one test that fails without it |

### Ticket rulings

Spec-session answers to ticket intent questions.

| # | Ruling |
|---|---|
| R1 | "Unlisted files in these folders belong here" applies only to folders a ticket holds whole. In a shared folder such as `src/components/modals/` or `src/components/menu/`, a ticket holds only the files it lists. An unassigned file goes to the spec session |
| R2 | "Character" stays where it names the AI pipeline's people-in-the-story machinery: Limit Active Characters, Describe New Characters, the Output "Characters" section, staged-character detail, and the Active Character Guidance and Character chips. A line that means an entity in general says entity |
| R3 | Q5 applies to select option values. Official names stay (NovelAI model names). "(default)" stays; it marks the default value. A purpose gloss moves into the field's ⓘ and the option becomes the bare name, but only when the ⓘ then carries the meaning; otherwise the option stays |
| R4 | A file that belongs to another ticket stays out of this ticket's edits and its before and after counts |
| R5 | Every `src/components/` root file belongs to ticket 01 except the two its ticket names, even when it renders on one other screen. Read that screen's code for the facts |
| R6 | Specimen text (lorem ipsum, sample widget lines in a preview) is not copy and stays |
| R7 | A dev readout's property names are data. Its label-parenthetical notices are false positives |
| R8 | Developer-only text (console messages, thrown errors no screen shows) is out of scope. A thrown message that a screen or Error Details shows is in scope. Screen-reader text is in scope |
| R9 | A shared fallback must be true for every caller that relies on it. Audit the callers; a fallback that claims a consequence some caller lacks drops that claim. A caller that needs a specific consequence goes to its ticket as a finding |
| R10 | The built-in chip for `{{char}}` is "Entity Name": it resolves to the owning entity's name, as its own hint says. `char` stays a search term. The renaming ticket updates every test that pins the label, in any folder; comments in another ticket's files go to that ticket |
| R11 | The Overview readme fields' accessible names are "Introduction Readme" and "Gameplay Readme". The Overview Voice Pass did not rule them, so Q5's parenthetical rule applies |
| R12 | The Memory pin control "Clear Pin (Let the Story Decide)" becomes "Clear the Pin and Let the Story Decide" on all three surfaces: the Memory manager (02), the Memory panel (06) and its help topic (12) |
| R13 | `textEndpointEditorModel.ts` belongs to ticket 02. `editorMode.ts`'s mode lines stay the same as Settings' lines, because the Design System quotes them |
| R14 | A ticket that renames a label updates every quote of it: wiki pages, the Design System doc, design-system reference screens and their tests. Only comments in another ticket's files are routed to that ticket. An unassigned `src/contexts/` file goes to the ticket whose screen uses it |
| R15 | A hint placed after its control (Field help order) is a layout change and stays. The ticket lists it under Findings; close-spec gathers the list |
| R16 | The Test Bench lens selects take the visible words as their accessible names ("Testing as", "Testing at"). The Opening tab's "Lens Pick" badge becomes "Testing As". Copy says "Testing as" and "at", never "the lens" |
| R17 | A dictionary entry activates; it never "fires". Use the Writing Guide's match, activate and inject in the Triggers UI and Test Bench findings. Other trigger kinds take their own defined verb (a trait switches, a script runs) |
| R18 | Sample world text a tour suggests is world text and keeps its own voice. Only the tour's instructions are swept |
| R19 | A control named in a plain-text slot (Test Bench findings, row descriptions) takes curly quotation marks |

## Screen groups

Counts are real notices from `copy:sweep --all` on 2026-10-31, without tests and case-only label hits. A ticket file lists its exact files.

| Group | Covers | Notices | Waits for |
|---|---|---|---|
| Shared components | Root components, `ui/` primitives, Settings rows, confirm and error dialogs, typography, tutorial popover, dev readouts in the root folder | ~150 | — |
| Settings and AI setup | Settings modal and its copy table, display and output sections, local model and model details, AI setup gate, Memory manager, endpoint and sampler fields, setup guides, preset sharing, request anatomy, prompt fields, settings defaults | ~150 | — |
| World Editor panels | The editor managers (Overview, locations, entities, stats, items, traits, dictionaries, placeholders, media, openings) and the add, import and link modals they open | ~155 | — (Overview Voice Pass landed) |
| World Editor instruments | Opening, triggers, AI context and issues instruments, Test Bench, history controls, pin and condition controls, the authoring tour | ~125 | — |
| Scripts and Tools | Script surface help, code and template descriptions, World Tools editor and Try It, the template dialog, quick fixes, script boxes. Technical register, hand pass | ~75 | — |
| Game screen | Game panels, inventory, memory panel, TTS, persona picker, scene images, GameViewer, start-of-game modals, avatar creator, load and save lists | ~125 | — |
| Main menu, library and account | Main menu, enter-world flow, library, backup and restore, sign-in and account, delete account, linked accounts, hosted AI panel, publishing, linked content, update dialogs, events banner | ~135 | — |
| Community | Community browser, world details, likes, filters, contests, changelog panel, reports, add-ons, user profiles, age gate | ~115 | — |
| Mod and feedback tools | Admin panel tabs: users, policies, terms, reports, review, audit log, broadcasts, messages, notifications, events form, server settings, the feedback hub and threads | ~130 | — |
| Formaquestion | Formaquestion window, guide reader, its settings tabs, the help session copy | ~50 | — |
| Design system and dev | Design-system showcase and its reference screens, dev routes and dev samples | ~115 | — |
| Help topics | The help pop-out topics registry, tutorials, leave prompts | ~100 | All docs-sweep wording tickets |

## User Stories

1. As a player, I want every help line to start with what it does, so that I can decide in one read.
2. As a player, I want help lines to use the words on the screen, so that I can find the control they name.
3. As a player, I want one word for one thing across the app, so that "entity" and "character" never look like two features.
4. As a player, I want the ⓘ to define a term before it uses it, so that I can learn a concept I have never seen.
5. As a player, I want the ⓘ to add something the line does not say, so that opening it is worth the click.
6. As a player, I want error text to say what happened and then what to do, so that I can recover.
7. As a player, I want confirmation dialogs to state the consequence, so that I know what a button will destroy.
8. As a player, I want status lines that state the result, so that I know whether an action worked.
9. As a player, I want help topics to say the same facts as the wiki, so that two sources never disagree.
10. As a player, I want no metaphor or idiom in help, so that a translation tool and a second-language reader both get it.
11. As a player, I want short sentences in help, so that I can scan a popover.
12. As an author, I want World Editor hints to name who gets the effect (the player or the AI), so that I build the right thing.
13. As an author, I want paired field hints to mirror each other, so that I see how the two fields work together.
14. As an author, I want a blank-means-mode field to say its result, so that I know what leaving it empty does.
15. As an author, I want script help in the technical register, so that each term names one operation.
16. As an author, I want template descriptions that say what the template sets, so that I pick the right one.
17. As an author, I want Test Bench findings and editor warnings in the technical register, so that I can act on them.
18. As a player, I want help text to look like help text, so that I can tell a hint from content.
19. As a player on mobile, I want help to say "mobile", so that the copy fits a tablet too.
20. As a moderator, I want admin tool copy in the same voice, so that staff tools read like the rest of the app.
21. As a player, I want Settings copy to follow the newest rules, so that the most-read screen is the cleanest.
22. As a player, I want a renamed label to still be found by the Find bar, so that my search habits still work.
23. As a developer, I want each ticket to hold one screen group, so that its session reads one area of code.
24. As a developer, I want one owner for shared component strings, so that two tickets never rewrite the same line.
25. As a developer, I want every test that pins an old string updated in the same ticket, so that the gates stay green.
26. As a developer, I want false and history-telling comments fixed in the files a ticket touches, so that comments describe today's code.
27. As a developer, I want case-only and em-dash-only nits left alone, so that diffs stay about meaning.
28. As a developer, I want small bugs a ticket finds fixed with a test, so that a known wrong behavior does not wait for another effort.
29. As the user, I want larger bugs listed under Findings, so that I decide their fix.
30. As the user, I want drive-by corrections listed apart from the sweep, so that I can veto them.
31. As the user, I want one changelog entry for the whole sweep, so that In Progress does not fill with copy lines.

## Implementation Decisions

### Rule sources

- The Writing Guide is the only wording rule source. Read "Before you write", "Controlled product terms", "The help-line test" and, for technical surfaces, "The technical register".
- The Design System owns placement and typography: "Functional writing", "Field help order", "Typography".
- The copy-sweep skill owns the run, the triage of known false positives, and the rewrite steps.

### Per ticket

- Run `npm run copy:sweep <the ticket's files>` and record the count per rule before and after.
- Write the facts list for each screen in the user's words, checked against the code. Write the copy from that list, never from the spec, `CONTEXT.md` or code identifiers.
- Rewrite every help line, ⓘ body, tooltip, description, status, error and confirmation in the ticket's files, notice or not. The script's notices are a lead, not the scope.
- Swap raw help paragraphs to Hint or Meta (Q2). A status line takes Meta.
- Labels: fix only the Q5 cases. For each renamed label, check the Find bar's caption guard and every test that names it.
- Comments: in the ticket's own files only, fix the Q6 cases.
- Technical surfaces the script skips (script surface help, the template catalogs, code comments) get the hand sweep the skill requires.
- The session writes the copy itself. No delegation of copy to a subagent.
- Shared components belong to the shared-components ticket (Q12). Another ticket that finds a shared string wrong sends it to the spec session, which forwards it to that ticket or queues it.

### Facts and bugs

- When copy and code disagree, the code on `main` is the truth for what the copy says.
- When the code looks wrong: a fix that meets Q13 lands in the ticket with a test and a drive-by line. Anything larger goes under Findings with the file and the observed behavior.
- An intent question (what a control is meant to do) goes to the spec session before the copy is written.

### Help topics

- The help-topics ticket copies each fact from the docs page that owns it, after the docs sweep lands (Q7). A help topic and its page state the same fact in the same words.
- A help topic is extended help: short paragraphs or bullets, not hint-shaped lines.

### Changelog

- No ticket writes a fragment (Q10). At close, the spec session writes one 👤 entry that names the swept screens and lists the in-place bug fixes a player can see.
- The mod and feedback tools stay out of the changelog entry. Mod tools never appear in the changelog.

## Testing Decisions

- The seam is the existing tests that pin strings: the settings copy guard, the shared copy-shape check, the prompt description and Anatomy hint tests, the panel suites that assert on labels, and the Find bar's caption guard.
- A ticket searches the test files for each old string it changes and updates the test in the same commit.
- A new pin goes in only where the copy-sweep skill says: a renamed label the Find bar relies on, or a term a hint depends on. No whole-sentence pins.
- Each in-place bug fix ships one test that fails with the bug reinstated.
- `copy:sweep` is advisory. The ticket records before and after counts per rule and explains each notice it leaves.
- Each ticket runs the four gates through the ticket flow.

## Out of Scope

- Wiki pages in `docs/`: the Docs Sweep owns them.
- Prompt text sent to a model, bundled worlds, narration, readme prose and tests: they keep their own voice.
- The account site (`site/`) and the landing page (`hosting/`).
- Case-only label drift and em-dash-only comments (Q5, Q6).
- Bugs that fail the Q13 bar: listed under Findings, not fixed.
- Changes to the copy:sweep script to silence a notice.
- Layout or order changes on a screen, except the Hint or Meta swap.

## Further Notes

- Three tickets can run at once. Groups share no files, except `MainMenu.tsx`, which the main-menu ticket owns.
- The shared-components ticket can run first, but the others do not wait for it. They read shared strings and never edit them.
- Overview lives in the World Editor panels group, so that ticket is the one Q8 holds.
- A ticket's Landed section lists: drive-by corrections, in-place bug fixes, Findings, shared strings sent to the spec session, and the before and after sweep counts.
