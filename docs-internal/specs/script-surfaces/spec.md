# Script Surfaces

Status: done
Status note: Closed 2026-10-23; tickets 01–04 done; last landing a56fc5248. Review: spec text corrected. Closed red: src/components/prompt/CodeArea.test.tsx, a completion-pick timing failure under the full run that passes alone and sits outside the effort's files.
Spec session: script-surfaces — spec

## Problem Statement

A Script can be edited from three places: a stat's Scripts tab, a trait's Scripts tab, and the World Editor's Scripts tab that lists every script by Timing. All three draw the same row and the same code box, but each builds the box's context on its own and each writes the edited script back its own way. The 3.4.0 Scripts tab handed its rows the editor's code box instead of the Script, so every keystroke there wrote the stat, its owner and its runs into the script, nesting the last state one level deeper each time. The editor slowed down and then crashed. The other two tabs never did, so the bug looked like a browser problem.

The same split reaches into Test Code. On a stat an entity links from a Blueprint, the stat panel runs `self` under the link's id, so `self` is a copy that writes through `owner.stats` miss. The Scripts tab and play run it under the original stat's id. An author testing the same script on two tabs gets two answers.

## Solution

The three surfaces share what decides their behavior, and a row can no longer hand anything but a Script edit to the world.

- A script row reports field patches (code, timing, name). Each home merges the patch onto its stored script by id, through one helper. No row object reaches the world from any surface.
- One hook builds a box's context from the script's home: the Owner, the self name, the owner's stats and the card lookup. All three surfaces call it, the library editor included. The Scripts tab, the owner panels and the box's own home derivation agree by construction.
- `self` runs under the original stat id on every surface, as play does, and is read from the stored world by its home.
- The Scripts tab's entity write edits the live entity, so an edit landing in the same tick is kept.
- The two write paths stay: owner panels write through their field draft, the Scripts tab writes across slices by home. Both end at the same per-record setters.

## User Stories

1. As an author, I want typing in a script on the Scripts tab to stay fast, so that a long edit never slows the editor down.
2. As an author, I want the Scripts tab to save exactly what I typed, so that a script never carries hidden copies of its stat or owner.
3. As an author, I want a script edited on the Scripts tab to look the same on its stat's or trait's own tab, so that the two views never drift.
4. As an author, I want the same completions on every tab where a script box opens, so that I learn one set of names.
5. As an author, I want the same checks and squiggles on every tab, so that a problem flagged in one place is flagged in all.
6. As an author, I want Test Code on a linked stat to run as play runs it, so that writes through `owner.stats` reach `self`.
7. As an author, I want Test Code to give one answer for one script whichever tab I run it from, so that I can trust the report.
8. As an author, I want the hover cards and Find All Uses of a script to agree between tabs, so that navigation lands in the same places.
9. As an author, I want a script on a Blueprint stat to list its group's stats under `owner` on every tab, so that templates and completions match.
10. As an author, I want a global trait's script to complete without an owner on every tab, so that no tab offers names that will not resolve.
11. As an author, I want the library entity editor's script boxes to keep working without a world, so that I can author a reusable entity's code.
12. As an author, I want a save made during the old bug to keep opening, so that a bloated script never locks me out of my world.
13. As an author, I want an edit I make to an entity while a Scripts tab write is landing to survive, so that no keystroke is lost.
14. As an author, I want a world I export after this change to carry scripts of the same shape as before, so that nothing I share changes format.
15. As an author, I want renaming a script on the Scripts tab to behave as it does on the owner's tab, so that a blank name falls back the same way.
16. As an author, I want changing a script's Timing on the Scripts tab to move it the same way the owner's tab does, so that the run order reads the same.
17. As an author, I want removing a script on any tab to ask the same question when it has code, so that no tab deletes code silently.
18. As a developer, I want a field added to Script later to flow through every surface without a change per surface, so that one addition is one change.
19. As a developer, I want one place that decides a box's Owner and self, so that a rule change lands once.
20. As a developer, I want a test that fails when a row hands a box or any object with extra keys to its parent, so that this bug class cannot return.
21. As a developer, I want parity tests that record what the three builders return today, so that the merge is proven to change nothing it should not.
22. As a developer, I want the Test Code report on a linked stat covered by a test on both surfaces, so that the id rule holds.
23. As a developer, I want the write paths left separate where they differ for a reason, so that the merge does not take on link overrides, the library and the draft race.
24. As a player, I want a world I downloaded to open and run its scripts as its author tested them, so that the author's Test Code result is what I get.

## Implementation Decisions

**Row patch boundary (Q2, Q6)**
- The script row's change callback reports a partial Script: the field that changed and its new value. A cleared name reports the name as absent, so the fallback label shows and nothing exports, as today.
- One helper in the scripts library merges a patch onto the script with the given id inside a list of scripts, returning the same list when nothing changed. The owner panels' Scripts section and the Scripts tab's home-based edit both call it. No other merge of a row's change exists.
- The runtime pick that reduces a code box to a Script in the Scripts tab's entries goes away once the row reports patches. The entries keep carrying the code box for navigation and context, under its own field, never as the row's script.
- Remove stays its own callback. A Timing change is a patch like any other.

**One context hook (Q3, Q8, Q9, Q10)**
- One hook takes a script's home, as the Sandbox Snapshot names homes, and an optional world. It returns the box context the row needs: the Owner, the self name, the owner's stats under their code names, the owner stat names where they are checked, and the card lookup when a world exists.
- The Owner derives from the home through the snapshot's own derivation. The home decides everything else: a global stat or world script has no owner, an entity's stat or trait runs under that entity, a Blueprint stat runs under its group's stats, a Blueprint trait under the empty entry whose owner stat names go unchecked.
- `self` is the stat or trait as the stored world holds it, found by its home. On an entity's linked stat it is the resolved stat under the original id, never the link id. The stat panel reads it from the world, not from its editing draft; the draft writes through on every edit, so the two never differ in a way Test Code reads.
- Without a world, as in the library entity editor, the hook returns no lookup and resolves the owner's stats from the entity it is given, over the library's stat world when the library was opened from one (T04-3).
- The code box's own home derivation for Test Code is replaced by the same home, so a box runs under the home its context was built from.
- The three builders the surfaces once held (the stat panel's, the trait tab's, the Scripts tab's entry context) were extracted, recorded by the parity tests, and deleted once the hook matched the record. No surface builds its context outside the hook.

**Scripts tab entity write (Q5)**
- The Scripts tab's write of an entity slice applies the script edit inside the entity setter's updater, on the entity as it is at that moment, instead of replacing it with the copy the write read. Stats, traits and world scripts keep their per-record writers.

**What stays separate**
- Owner panels keep writing scripts through their editing draft, and the Scripts tab keeps writing across slices by home. The home-based edit only edits an existing link override; a panel's first edit on a linked stat or trait creates the override through the link editors. The library editor has no world slices. A write outside the draft followed by a draft write in the same tick is clobbered. Each of these would have to be re-solved to merge the paths, for no author-visible gain.

**Saved worlds (Q4)**
- Worlds saved during the old bug are not scrubbed on load. Their nested fields are harmless at runtime, and the next edit of each script writes it clean.

**Export shape**
- The Script record and the world export do not change. The row patch removes a way to add stray fields; it adds none.

## Testing Decisions

A good test drives a public seam with real inputs and asserts what an author sees or what the world holds. It never mirrors the implementation. Each guard is proven by reinstating the bug it prevents.

- **Patch helper and entries** (prior art: `worldScripts.test.ts`, `scripts.test.ts`): a patch merges onto the right id and leaves other scripts by reference; a cleared name drops the field; an unknown id returns the same list; every entry's script is the stored Script record by reference (T01-1), and the row's change callback carries only Script fields; the Scripts tab's edit of a stat, an entity stat, a trait, a link override and a world script writes the patched script and nothing else.
- **Context hook parity** (prior art: `GameDataContext.*.test.tsx` with renderHook under the provider): one fixture world with a global stat, an entity's own stat, a root-linked Blueprint stat, a Blueprint stat, a global trait, an entity's trait, a Blueprint trait and a world script. For each, the hook matches an explicit recorded table of the Owner, `self`, the self name, the owner stats, the owner stat names, and the lookup's answers for Before the AI (T03-1, T03-2). The two differences the record once named, the linked stat's self id and a global trait's owner stat names, are settled as the original id (Q9) and absent (T04-2).
- **Test Code on a linked stat** (prior art: `StatManager.testCode.test.tsx`): a script that writes through `owner.stats` to itself reports the written value with no dropped-write line, from the stat panel and from the Scripts tab.
- **Surfaces end to end** (prior art: `worldEditorBench`): typing in a script box on each of the three surfaces leaves one changed field on the stored script and no extra keys; a fast run of keystrokes keeps the script's JSON size flat; a rename, a Timing change and a remove behave the same on each surface.
- **Live entity write** (prior art: `worldScripts.test.ts` for the pure edit, `WorldEditor.history.test.tsx` for the commit): an entity edit queued in the same tick as a Scripts tab write survives.

## Out of Scope

- Merging the owner panels' write path with the Scripts tab's home-based write.
- Scrubbing nested fields from already saved worlds.
- Changing what `self`, `owner` or any script global exposes.
- The Tools tab and World Tool script boxes, which have their own record and writer.
- New editor UI. Every surface keeps its layout and controls.

## Ticket Rulings

- **T01-1:** a code box keeps a reference to the stored Script it was built from, under its own `script` field, set where the box producers spread the script (world, Tool, stat and trait boxes alike). The Scripts tab's entries hand that stored record to the row as `entry.script`. No field list, no pick, and the row never reads a box as its script. The entries test that pins Script-only keys stays and now asserts the stored record by reference; the row guard is added beside it.
- **T03-1:** the parity record per home and surface holds: the Owner, the box's `self` prop (kind plus stat or trait id), the self name, the owner stats as code names, the owner stat names, and the lookup's answers for the Before the AI Timing to `self()` (id and name), `owner()` (kind plus entity id or Blueprint owner ids) and `ownerEntityIds()`. No stat, trait or uses queries.
- **T03-2:** the record is an explicit expected table in the parity test, one row per home plus a named list of disagreements per surface, not a snapshot file; ticket 04 runs its hook against the same table. The builders are driven through renderHook under the GameData provider loaded with the fixture world.
- **T03-3:** two named disagreements are recorded: the linked stat's self id (link id on the stat panel, original id on the Scripts tab, showing in both `self` and `lookup.self()`), and a global trait's owner stat names (absent on the trait tab, empty on the Scripts tab). Ticket 04 settles the second as absent: the hook returns owner stat names only where an owner's names are checked.
- **T04-1:** a Blueprint trait box's card lookup lists the owners that link the trait, as a Blueprint stat box's lists the owners that link the stat. Today both surfaces list none, because the lookup finds a Blueprint box's runs by a self stat id that a trait box lacks; ticket 03 recorded that as today's value. The hook's lookup finds the runs by the home instead, so the two Blueprint kinds answer alike.
- **T04-2:** owner stat names are absent for every home with no owner: a global stat, a world script and a global trait alike. The box reads them only under an owner, so the two record rows that held an empty list move to absent.
- **T04-3:** in the library editor the hook resolves the given entity's owner stats one way for every surface: over the library editor's stat world when the library was opened from a world, so links resolve, and over the entity's own stats alone otherwise. The library trait tab gains the linked stats it lacked.
- **T04-4:** T04-1 reaches Find All Uses too: its per-box lookup lists a Blueprint trait's linking owners as the hook's does, so a hover card and Find All Uses never disagree on who runs a box.
- **T04-5:** a home whose stat or entity the world no longer holds (a panel mid-delete) resolves to a bare stat under the home's id with an empty name, and the lookup's owner reads null, as today. The box keeps rendering; the panel unmounts right after.
- **T01-2:** the patch is `Partial<Omit<Script, 'id'>>`; a key present as `undefined` drops the field, so a cleared name sends the name as `undefined`. The helper lives in the scripts library, returns the same list for an unknown id or a no-op patch, and the row reports `{ name }`, `{ timing }` and `{ code }`. The old rename helper goes.

## Further Notes

- Rulings Q1–Q11 come from the 2026-10-22 grill. Q4 ruled no scrub. Q9 was settled on a code trace: play and the Scripts tab run a linked stat's script under the original id, the stat panel under the link id. Ticket 04's Test Code test on both surfaces, run against the real executor, proved the trace.
- The bug this effort closes landed with the Scripts tab in 3.4.0 and was fixed on 2026-10-22 by reducing each entry to the Script shape. That fix hard-codes the Script field list, which the patch boundary replaces.
- Glossary: **Script** in `CONTEXT.md` already says its home decides `self`. No change needed.
