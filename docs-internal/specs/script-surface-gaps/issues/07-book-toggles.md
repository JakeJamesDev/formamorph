# 07: Book Toggles

Status: done
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: book reach and book writes on top of ticket 06's overlay, with one derivation rule.

## What to build

Scripts reach books by who turned them off (Q33). That is derived with no new data: a book the save has off while the world, or the player's library add, has it on is player-off and stays absent; a book the world ships off is listed with `enabled: false` (Q36). Book `enabled` takes writes in both directions on any reachable book (Q37, Q40). Book toggles live in ticket 06's overlay and rewind with undo (Q38). A library book the player added reads and takes writes like any book in play, and the library record is never written (Q39). User Tools stay read-only. The Scripts guide covers book reach and writes. From ticket 06's landing: the Tool snapshot's built-in lookup reads the world's authored books, not the playthrough's, so a library book added at world entry never reaches it; this ticket points it at the playthrough's books through the overlay, so Q39 holds there too.

Spec: Q33, Q36–Q40, stories 34–38.

## Acceptance criteria

- [x] A book the world ships off reads `enabled: false`; a Before the AI write switching it on puts its matching entries in this turn's narration request (`GameViewer.bookToggles` "puts a shipped-off book…", entered through the real selection; `dictionaryEntries` "lists a book the world ships off as off…")
- [x] A script switches an on book off, and its entries leave the next request (`GameViewer.bookToggles` "takes an on book's entries out…")
- [x] A book the player turned off at world entry is absent from `dictionaries` (`dictionaryEntries` "…leaves out one the player turned off…", through `playthroughPlaceholderSet`)
- [x] A library book the player added takes an entry write, and the library record is unchanged afterward (`GameViewer.bookToggles` "lands an entry write on a library book…": no `storeDictionary` call, the save's copy equal)
- [x] Undo after the turn restores the book's earlier state (`GameViewer.bookToggles` "restores the book's earlier state after a rewind…")
- [x] The Tool snapshot's built-in lookup finds an entry of a library book the player added, and skips a book a script switched off (`GameViewer.bookToggles` "with the dictionary lookup on", both cases)

## Blocked by

- 06

## Landed

**Not verified:** none.

**For you:**
- Ship a dictionary off (clear **Enabled** in Advanced mode), switch it on from a Before the AI script, and read the narration request in AI Context.