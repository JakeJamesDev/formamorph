# 11: Library Updates Map the Routine

Status: ready-for-human
Blocked by: 09, 10
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The library owns the routine of a linked entity with a kind (Q30). When the library source changes, its Starts, rows and Can Also Go reach each linked copy, mapped to that world's places.

Ticket 09 made the routine world-owned as an interim: a library update, the "differs from source" check and the update review ignore it. This ticket replaces that with a mapped read.

- **Update.** A library update passes the source's routine through the copy's stored location connections, by the carry rule of Q11, and writes the result on the copy. A place with no connection drops, as in a fresh carry. The copy's own routine edits are replaced.
- **Compare.** The "differs from source" check and the update review compare the copy's routine with the source's routine after the same mapping. A copy that equals a fresh carry of its source does not differ.
- **Start ids.** A fallback Start gets a fresh id at carry time. Compare ignores Start ids and compares what each Start is: its place, its weight and its rows.
- **Link repair.** Repair already rebuilds the routine as a fresh carry (ticket 09). Keep it, and make it share the mapping with update and compare, so the three cannot disagree.
- **No kind.** An entity with no kind keeps today's rule: its stored location list is world-owned.

Use one mapping function for carry, update, compare and repair. Remove the interim world-owned handling of ticket 09 (902cbe090): `COPY_ROUTINE_FIELDS`, `withoutCopyFields` and the routine block in `applyLibraryUpdate`, all in `src/lib/linkedContent.ts`. Both kinds follow the rule (Q31).

The update review must show the author what changes in the routine before they accept, since their own routine edits are replaced. Follow the existing review's patterns; write new copy from the Writing Guide. The library linking wiki text changes if it says what an update keeps.

Kinds are unreleased, so this is a fix to unreleased work (Q25): no changelog fragment; list the lines in the landing.

Spec rulings: Q30, Q11, Q19, Q21, Q25.

## Acceptance criteria

- [x] A source's row that moves to another connected place reaches the linked copy on update, at the mapped place. The test fails with ticket 09's interim handling restored. (`linkedContent.routine.test.ts` "moves a row…"; the interim reinstated as a mutation failed it.)
- [x] A source's row that moves to a place the world has no connection for drops from the copy on update. ("drops a row whose place…")
- [x] A routine edit made on the copy is replaced on update. The update review lists the routine change before the author accepts. ("moves a row…" and "lists the routine change in the review", rows Starts and Can Also Go.)
- [x] A copy that equals a fresh carry of its source does not show as differing, also when a fallback Start has a fresh id. ("reads a copy equal to a fresh carry…"; mutation keeping Start ids failed it.)
- [x] A copy whose routine was edited in the world shows as differing. ("reads a copy whose routine was edited…")
- [x] Carry, update, compare and repair give the same routine for the same source and connection map. One test compares all four. ("give the same routine…", over a Unique, a fallback and a Generic source.)
- [x] The interim world-owned handling of ticket 09 is gone, with no caller left. (grep: no `COPY_ROUTINE_FIELDS` or `withoutCopyFields` in `src`; the two interim tests went with it.)
- [x] An entity with no kind keeps its stored location list across a library update, as today. The existing test passes unchanged. ("carries a location connection over…" passes with unchanged assertions; its call gained the new `places` argument.)
- [x] An entity with a kind stores no `locations` after an update (ticket 10). ("stores no location list…")
- [x] The wiki text on library updates matches. (`docs/LinkedContent.md`, Update Available.)
- [x] The landing lists the fix lines for the entity kinds entry. (Below.)

For you: link a character with a routine into a second world, change its routine in the library, update the copy, and check the review and the result.

## Landed

Q33 (spec session, during this ticket): a copy that loses its kind on update takes the source's membership, carried through its connections. Tests cover both directions; the review shows a Locations row for a kind change.

**Fix lines for the entity kinds entry (Q25):**
- A library update now brings an entity's routine to each linked copy, mapped to that world's locations. A place with no connection there is left out.
- **View Changes** lists the routine as **Starts** and **Can Also Go**, in this world's location names.
- A linked copy whose routine matches its library item no longer reads as changed, and saving the world no longer writes it back.

**Not verified:**
- The review rows in the live dialog. Only `diffContent` output was read in tests; no preview frame.

**For you:**
- Link a character with a routine into a second world, change its routine in the library, update the copy, and check the review and the result.
- Read the review rows (Library → right-click the tile → **Check for Updates** → **View Changes**). The Starts text is new copy.

**Seen, not fixed:**
- A copy with no kind compared to its library item may always read as differing: the source's `locationRefs` count, and a world copy has none. Ticket 11 strips them only in the mapped routine compare.
- Write-back of an owned copy stores this world's location ids in the library item. Another world's copy then has no connection for them and drops those places on its next update.
