# 07: Persona in the Openings Test Tool and Copy

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

This ticket changes the last editor and settings strings that name the played character some other way. Rulings Q12, Q13 (code card), Q15, Q20. Sonnet at low effort, because these are string changes in three files.

## What to build

An author opens the Openings test tool:

- The preview line reads "Turn one as Kate", or "Turn one with no persona" when no persona is picked.
- The persona select's hint reads "Sets the persona".
- The lens badge reads **Lens Pick**, and the **Active Traits** note reads "defaults plus the lens pick" (Q15 as reopened).

Two more strings change:

- A persona-capable entity's code card reads "Persona: Playable".
- In Settings, the author-note ⓘ line reads "…not something your persona says".

## Acceptance criteria

- [ ] The preview line, the select hint, the lens badge and the **Active Traits** note read as above. "The default character" and "PC" are gone.
- [ ] The code card's persona line reads **Persona**: **Playable**.
- [ ] The author-note ⓘ line says "your persona".
- [ ] The opening instrument and code card tests assert the new text, with and without a picked persona. Putting back the old text makes them fail.
- [ ] A changelog fragment. Four gates green, exit codes read.
