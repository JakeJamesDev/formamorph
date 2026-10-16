# Spec: Scripts Leftovers

Status: done
Status note: Closed on 2026-10-15. Tickets 01–08 landed; the last landing is 525c3a056. Closed without gates.
Spec session: scripts-leftovers — spec

## Problem Statement

Scripts shipped, but parts of the app still treat them as stat code. The Test Bench, the help window's code test and the stat-move check read stat scripts only. They miss a broken trait or world script, and they miss a stat move that breaks a world script. The bench files every script failure under Stats and does not say which script asks a question. Code names and the help prompts still say "stat code." A disabled stat shows only as a 50% dim on the Scripts tab and shows nothing on the Stats tab. Two trait-switch edges lose data in play: a toggle made while a switch run holds a prompt open can be undone, and a persona-change run reads the old cast.

## Solution

Every reader covers every script: stat, trait and world, in every timing. The bench groups each failure under the section that holds the script and names the asking script beside its question. A disabled stat reads "Off" on its Scripts tab rows and its Stats tab row. "Stat code" leaves the code names and the help prompts. A trait-switch run lands only the traits it changed, and the player's own toggle wins a conflict. A persona-change run reads the new cast.

## Rulings

Settled with the user on 2026-10-15, from the open edges in the Backlog of the Scripts spec (tickets 05 and 11).

| # | Ruling |
|---|---|
| Q1 | A disabled stat's script row on the Scripts tab keeps the 50% dim (Scripts Q52) and gains an "Off" meta text |
| Q2 | A disabled stat's row on the Stats tab gets the same marker: dim plus "Off" meta text |
| Q3 | A trait-switch run lands only the traits it changed, not the whole trait state |
| Q4 | A persona-change run reads the new cast: `persona` and `entities` match the world after the change, as `trait` and the trait scope already do |
| Q5 | Script failures group by the section that holds the script: world scripts under Scripts, trait scripts under Traits, stat scripts under Stats, entity scripts under Entities. Each finding carries its script's section. The Issues list keeps one row per rule, since it shows no section headers. Reopened twice: a Scripts section already existed, so world scripts do not go under Overview; then the list proved to have no section grouping, so no row split |
| Q6 | The rename covers identifiers, file names and tests, and the Formaquestion prompts and function name. It includes every Test Bench rule id and const (rule ids are not stored in worlds, saves or settings) and the help rider's tab constant. The `statCode*` runtime modules (executor, timing and others) keep their names |
| Q7 | This is its own effort. The Scripts spec stays closed |
| Q8 | When a run and the player change the same trait during the run, the player's toggle wins |
| Q9 | The bench's choice row shows the asking script's name as muted meta text beside the question |
| Q10 | The help code test runs the code under test in its own timing and on its own owner: stat, trait or world |
| Q11 | Test seams: the existing test files listed under Testing Decisions, plus a new Stats tab marker test. Reopened once: diff landing is a pure function with its own unit test, since the GameViewer test cannot easily reach an entity's own stats (Q14); the GameViewer race test stays |
| Q12 | A Blueprint trait's `owner.*` lookup is judged against each linking entity; a miss on any of them is flagged, naming that entity. A Blueprint trait no entity links gives no finding |
| Q13 | Owner-less lookups read "but a world script has no owner", "but a global trait has no owner" and "but a global stat has no owner" (glossary terms; "world stat" and "world trait" are on the Avoid lines). The rule summaries count scripts: "N scripts look up stat names that don't exist", "N scripts read delta in their Before the AI timing, where every source is zero" |
| Q14 | A switch that drops under Q8 drops its stat effect too: the trait's applied values and `statChanges` follow the player's toggle, as if the run never switched it. Its switch log line drops too. The script's own stat writes, its own log lines and the run's other switches still land |
| Q15 | A switch to a library persona waits for that entity to load before the trait settle and the persona-change run, as the save-load settle does. The run then reads the loaded persona. A world persona pick fires at once |
| Q16 | Ticket 08 also covers the leaving persona. The trait scope drops a left library persona. A switch-off event resolves its trait against the world from before the change, and the run carries both worlds, as Scripts Q13 reads the state before the switch. Covers a library persona and a world persona-only entity alike |

## User Stories

1. As an author, I want the Test Bench to check my trait scripts against unknown stat names, so that a typo in a trait's script shows before a player hits it.
2. As an author, I want the Test Bench to check my world scripts against unknown stat names, so that a world-wide rule is checked like any stat script.
3. As an author, I want the "Before reads delta" warning on a trait or world Before the AI script too, so that the same mistake gets the same warning wherever it lives.
4. As an author, I want a world script failure to show under Scripts, so that the group header matches the tab that opens.
5. As an author, I want a trait script failure to show under Traits, so that I look for it where I wrote it.
6. As an author, I want an entity's script failure to show under Entities, so that the group matches its home.
7. As an author, I want a stat script failure to keep showing under Stats, so that nothing I know moves.
8. As an author, I want each bench item to still open its own tab, so that one click takes me to the broken script.
9. As an author, I want a bench prompt to show which script asks it, so that I know whose question I am answering.
10. As an author, I want the asking script's name in muted meta text, so that the question stays the main line.
11. As an author, I want a stat move to warn me when a world script reads that stat, so that the move does not break a world rule without notice.
12. As an author, I want a stat move to warn me when a trait script reads that stat, so that the warning covers every script.
13. As an author, I want the help window to test a trait script I paste or write, so that I get the same check as for a stat script.
14. As an author, I want the help window to test a world script, so that a world rule can be checked before I save it.
15. As an author, I want the help window to test a script in any timing, so that During AI Output, At Game Start and When a Trait Switches scripts are covered too.
16. As an author, I want the help window to call it "script," not "stat code," so that its words match the editor.
17. As an author, I want a disabled stat's script rows to read "Off," so that I know they will not run without guessing from the dim.
18. As an author using a screen reader, I want the "Off" state as text, so that I can hear what the dim shows.
19. As an author, I want a disabled stat's row on the Stats tab to read "Off" too, so that a stat looks the same on both tabs.
20. As an author, I want a disabled stat's Stats tab row dimmed, so that it matches its script rows.
21. As a player, I want a trait I toggle while a script prompt is open to stay as I set it, so that the game does not undo my choice.
22. As a player, I want a switch run's own trait changes to still land, so that the script's rule still works.
23. As a player, I want my toggle to win when the script changes the same trait, so that a direct action beats a script.
24. As an author, I want a persona-change script to see the new persona, so that it reacts to who the player plays now.
25. As an author, I want a persona-change script to see the new cast of entities, so that what it reads matches the scene the player sees.
26. As a contributor, I want the bench check, its runner and its component named for scripts, so that the code reads in the glossary's words.
27. As a contributor, I want the help code test's prompts to say "script," so that the AI uses the right term.

## Implementation Decisions

- **One script list for every reader.** The Scripts tab already has a model that lists world, stat and trait scripts. The bench check keeps a private equivalent. The static bench rules, the stat-move readers and the help code test move to one shared list of every script with its owner and timing. A Blueprint stat or trait keeps its once-per-group run.
- **Static bench rules.** The unknown-stat rules and the Before-reads-delta rule read every script from the shared list. Each item takes the section of the script's home, as the bench check's items already do.
- **Bench grouping.** The two code-check rules' findings carry the section of the script's home: Scripts, Traits, Stats, Entities. The Issues list keeps one row per rule.
- **Choice row.** A bench prompt carries the asking script's display name (its name, or the owner-and-timing fallback from Scripts Q6). The row shows it in the editor row's existing muted meta text.
- **Stat-move readers.** The code reader walks every script from the shared list, so a world or trait script that reads a moved stat is reported.
- **Help code test.** The test takes the code, a timing from all five, and an owner: a stat, a trait, or the world. It runs the code as a script with that home. With no owner named, it keeps today's fallback to the open stat. The offered function's name, purpose line and use-when line say "script."
- **Rename.** The bench check, its runner and its component, their files and their tests take script names. The name-drift test keeps guarding the one name producer under the new names. Strings the player sees follow the glossary: Script, never stat code.
- **Off marker.** A disabled stat's script rows on the Scripts tab keep the dim and add "Off" as meta text. The shared stat row spec gives the Stats tab row the same dim and meta text, in both stat trees. "Off" is the existing meta text pattern, not a new visual pattern.
- **Diff landing.** A trait-switch run records the trait state it started from. When it lands, it applies only the traits whose state the run changed. Any trait the player toggled during the run keeps the player's state, and a run change to that same trait drops. A nested switch run lands the same way.
- **New cast.** A persona-change run builds its read context from the world after the change: `persona`, `entities`, `trait` and the trait scope all come from it.
- **No export-shape change.** No world or save field changes.

## Testing Decisions

- A good test drives the public seam and checks what an author or player sees: bench findings and their sections, the reported stat-move break, the help test's JSON result, rendered row text, and the trait state after a run lands. No test reaches into private helpers.
- Each fix gets a guard that fails when the old behavior returns. A race test holds a prompt open with a real script and toggles a real trait; it does not remove the prompt to make the timing easy.
- Seams and prior art:
  - Trait-switch races: the GameViewer switch-script test file (switch-on and switch-off landings, settle turn-off).
  - New cast: the switch-scripts turn tests, which already hold a "persona change" group.
  - Bench: the rules tests (unknown-stat, before-reads-delta), the bench check tests ("every script and every timing," prompts), and the World Editor bench-check view test.
  - Stat-move readers: the owned stat tree tests, which call them.
  - Help code test: the help session code-test file.
  - Off marker: the Scripts tab view test (the 50% dim case) and a new Stats tab marker test.
  - Rename: the name-drift test, under its new names, plus typecheck.

## Out of Scope

- Any change to which scripts run, or when.
- A marker for a disabled trait's script rows. Scripts Q3 already gates them, and nobody asked for a marker.
- Tool scripts and the Tool editor.
- New bench rules beyond widening the existing ones.
- Widening the help code rider so the AI writes During AI Output, At Game Start, When a Trait Switches, trait or world scripts, and an Insert path for them. The help code test runs any of them; the rider still asks for Before the AI and After the AI boxes only.

## Further Notes

- The rename touches many files. Check it against open efforts' file lists before it lands, so it does not collide with a running ticket.

## Backlog

Open edges from ticket 07:

- A dropped switch's nested results still land: a sibling it retired, or a trait its own script switched.
- When two switch runs race, each treats the other's changes as the player's.

Open edges from ticket 08:

- A library persona whose load fails clears the wait with no entity, so the settle runs with an empty persona. The persona-unresolved notice shows it.
