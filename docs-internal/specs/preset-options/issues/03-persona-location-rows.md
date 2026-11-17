# 03: Persona and Starting Location Rows

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A Preset value can choose a world persona and the Starting Location. The spec covers this in Q6, Q9 and Q10.

- **Apply.** Extend the apply function for persona and location rows. A persona row changes the persona before the settle, because the persona changes which owned trait trees are in play. A snapshot never resets persona or location unless a row names it.
- **Match.** Compare persona and location only when the value has a row for them.
- **Notice.** The notice names a persona or location change.
- **Editor.** The row editor offers world-authored personas and locations as targets. Player-library personas are never offered.
- **Docs.** Update [World-Editor-Options.md](docs/World-Editor-Options.md). Write a changelog fragment.

## Acceptance criteria

- [x] A location row sets the Starting Location. A persona row sets a world persona. (`entryDraft.preset.test.ts` "sets the Starting Location as a click does", "picks a world persona as a click does"; `EnterWorldFlow.test.tsx` "picks the persona and Starting Location, names both, and starts the game with them", which goes red without the places passed to apply.)
- [x] A snapshot with no persona or location row keeps the player's current persona and location. (`entryDraft.preset.test.ts` "under a snapshot with no persona or location row, keeps both".)
- [x] A persona row together with owned-trait rows for that persona applies both in one click. (`entryDraft.preset.test.ts` "applies a persona row and the rows that need that persona in one click, on its defaults"; goes red with the trees read under the old persona.)
- [x] Match ignores persona and location when the value has no row for them. (`entryDraft.preset.test.ts` "matches a persona and location only when a row names them"; goes red with the persona/location compare removed.)
- [x] Editor: persona targets list world personas only. (`WorldEditor.presetOption.test.tsx` "sets a world persona and a Starting Location": Knight and Hermit, the Custom Persona, are listed, and the Wolf is not.)

## Landed

**Not verified**
- None.

**For you**
- Click a Preset value with a persona row on the setup screen's World Options page. Judge whether "Persona set to … Starting Location set to …" reads well in the notice.
- On the Options tab, read the row editor's **Start** group (**Persona**, **Starting Location**) and its hint, "Add a shown Option, trait, persona or Starting Location first".

**Notes**
- Rulings Q32–Q38 came from this ticket's questions. Q32 changed the cascade notice and the row editor's owned traits to "Wolf: Feral".
- A persona row moves the location to that persona's start, as a click does (Q33). The move reads the gates before the settle, the same as a click. Only a location row is checked again after the settle.
- When the move lands on no location, the notice reads "Starting Location set to Random".
- No frame was taken. DOM tests cover the notice text and the editor lists.
