# 15: Custom Formaquestion Tools

Status: done
Blocked by: 14
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A power user adds Tools to Formaquestion, so that a dedicated player can make it a chat assistant (Q33, Q34, Q36, Q38).

**The list.**

- Formaquestion Tools are a separate list from the gameplay Tools. A Tool made here never goes to a game prompt, and a gameplay Tool does not show here.
- The player adds, edits, copies and deletes a Tool with the Tool editor of the regular Settings.
- Each Tool has a switch, default off, stored on the device.
- Import and export use the existing Tool pack file. A pack exported from the gameplay Tools imports here, and the reverse. The pack shape does not change.
- The catalog Tools are not listed (Q47).

**The help request.**

- The answer request offers each Tool that is on, with the guide lookup when it is on, when the endpoint takes function calls.
- With a Tool on and the guide lookup off, the request uses the retrieval prompt and the Tools.
- A Tool handler runs on a Tool Snapshot of the open world when a world is open in the game or the editor. On every other screen it runs on an empty snapshot and returns its empty result.
- Try It uses the open world, else the sample world, as in the regular Settings.

**What ticket 14 left for this ticket.** The Tools tab component takes the fixed functions as one prop. Its My Tools props (the Tool list, save, delete, the app version and file transfer) are optional as one group; passing them turns on My Tools, New Tool and import and export. The guide lookup's call limit is a device setting (Q59); a user Tool keeps its own limit on the Tool.

**World text.** With a Tool on and a world open, text of the player's world can go to the help endpoint. The tab states this next to the list.

**Records.**

- A new ADR: Formaquestion Tools are switched per device and are not scoped to a prompt preset. The capability gate of the Tools ADR stays. The new ADR takes the next free number.
- The glossary entries for Formaquestion and Tool change to match.

The Tools docs section gains the list, the editor and the packs.

Recommended model rationale: a second Tool store, a snapshot source in the help window, and a tool loop with player handlers.

## Acceptance criteria

- [ ] A Tool made here is in the Formaquestion list and not in Settings → Tools, and the reverse.
- [ ] A Tool that is on is sent with the answer request; one that is off is not.
- [ ] A handler reads the open world in the game and in the editor, and returns its empty result on the Main Menu.
- [ ] A tool round runs and the answer follows it (help session test with the fake fetch).
- [ ] A pack exported from the gameplay Tools imports here, with the rename rule on a name conflict.
- [ ] A Tool name that equals a fixed function's name is refused.
- [ ] The world-text line shows on the tab.
- [ ] The ADR and the glossary changes are in.
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
