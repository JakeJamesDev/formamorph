# 32: Wiki And Copy Match The Routine

Status: done
Blocked by: 26, 27, 28, 29, 30, 31
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Morphie answers from the wiki pages and from the app's own copy. Several statements there describe entities and locations as they were before this effort. Found by the help-docs sweep of 2026-11-11. Check each against the code as it is when you start: Presence Rows and tickets 26 to 31 changed some of them.

**Wiki statements to correct**

- The Entities page tells the author to pick places in Locations on the Profile tab. Placement is on the Routine tab.
- The Entities page says an entity's place can be set "from either side" through the location's Entities picker. The Presence tab now has an add control for any entity and an editor under its list (Q207). Describe that, and make the Entities and Locations pages agree.
- The Entities page, the Persona pages and the Locations page use "Locations" as the name of an entity field: for the canvas entity card, for a Playable or Persona-Only entity's start places, and in the text on what reaches the AI. Use the labels the Routine tab shows. Only the Custom Persona keeps a plain Locations list.
- The Settings page says each follower adds a request for Entity Movement. One request covers all of them.
- The Prompt Chips page says "Groups get no tag". The kind is Generic.
- The Locations page calls Can Also Go the "Traversable" list.
- The Locations page says the Can Be Here mark covers every place a row names. It covers only places connected to the Start.

**App copy to correct**

- The Entity Movement info text in Settings repeats the stale request count.
- The Custom Persona's hint names Presence and Movement, which are retired. The Persona page says "Placement and Known In".

**Missing**

- The player-facing pages say nothing about characters that move. Add a short section: characters keep a daily routine, can come along or wait, and the icon that marks a follower. Write it for a player, with no editor terms.
- The Glossary has no entry for Routine, Starts, the lock on a row, Can Also Go, Automatic Links, Nearby, Far or Distance.

Read the Writing Guide first ("Before you write"). Write each correction from a facts list checked against the screen, in the labels the screen shows. Run the copy sweep on every changed string.

**Left over from ticket 26:** the two placement sentences on the Test Bench page (AI Context and Opening) were not run through the copy sweep. Sweep them with the rest.

**Left over from ticket 30 (code, Q228):** the script read `held` is false whenever `action` is empty. So an entity that a script moved while in a gap, on a row with no connected place, or with no schedule (a runtime character) reads `held` false although the engine holds it. Make `held` read the hold alone. It stays false for a follower, a waiting entity, a Generic entity, the played entity and the persona. Update the tests that pin the old rule, and the `held` entry in the script help and the Scripts Reference.

**Then rebuild the help vectors**, once, as the last step: `npm run build:help-vectors`. Three sections were stale before this ticket, and every doc edit of tickets 26 to 31 added more. No test fails on a stale section, so count them before and after.

Spec rulings: Q214, Q207, Q175, Q174.

## Acceptance criteria

- [x] Each wiki statement above is corrected, and the landing gives the label on screen that each now uses. Labels: **Routine** tab and **Starts at** (Entities how-to); **Add an entity here**, **Entities Here**, **Routine**, **Known In** (Presence account); "starts" for Playable/Persona-Only start places, per Q229 (Entities, Persona-Authoring, Personas, Starting-a-Game, Locations); **Routine** / **Known In** for the canvas entity card (EntityPickCard modes); one request (Settings); **Generic** (Prompt Chips); **Can Also Go** (Locations reasons table); **Can Be Here** now says connected to the start (`routinePlaces` in entityPicking.ts). Checked against source.
- [x] The Entities and Locations pages give the same account of adding an entity to a location. Entities "## Locations" now lists add, edit-under-list and remove as the Locations page does.
- [x] The Entity Movement info text and the Settings page both say one request covers every entity. Matches turnPasses.ts "The turn's one entity location request".
- [x] The Custom Persona hint names no retired field, and the tests that pin the old string are updated. No test pinned it; new `PersonaPresenceHint.test.tsx` pins "Placement and Known In".
- [x] A player page has the section on characters that move, with no editor term in it. `docs/Entities.md` "Characters That Move"; How-to-Play's Entities row links it.
- [x] The Glossary has the eight terms, each linked to the section that explains it. Starts, Routine, Locked, Can Also Go, Automatic Links, Distance, Nearby, Far; anchors checked by the review.
- [x] After a script move, `held` reads true for an entity in a gap and for a runtime character, and the test fails with the old rule. It reads false for a follower and a Generic entity. `statCodeTurn.routineReads.test.ts`: the gap test failed with `action !== ""` reinstated; a held follower and a held waiting entity read false, and that test failed with the follow guard removed.
- [x] `npm run copy:sweep` gives no notice on the changed strings. Last run: notices only on untouched lines.
- [x] After the rebuild, a count of stale help sections against the docs on the branch gives zero for every page this effort touched. The landing gives the count before and after. Stale: 12 at claim, 32 before the rebuild, 0 of 699 after (`.scratch/countStale.ts`, same hash test as `buildHelpVectors.ts`).
- [x] The changelog fragment has one entry for the copy changes an author or player sees. `docs-internal/changelog.d/npc-schedules-32.md`, Routines group.

For you: read the new player section and the eight Glossary entries, and approve or change the wording.

## Landed

**Not verified**

- None. No screen was checked in a browser: the copy changes are two strings, pinned by tests and read against source.

**For you**

- Read the new player section and the eight Glossary entries, and approve or change the wording. Player section: `docs/Entities.md` "Characters That Move"; Glossary: the Building a World table.
- The heading "Characters That Move" uses "character", which the Writing Guide's terminology table reserves. The spec session named it; the body says "entity". Keep it, or rename it "Entities That Move".

**Handed over**

- Ticket 33 (Q229): `personaPick.ts` offers every routine place as a player start. `startsMet` in `src/lib/presence.ts` reads the same `entity.locations`, so the "already met" rule is wider than the docs say too.
