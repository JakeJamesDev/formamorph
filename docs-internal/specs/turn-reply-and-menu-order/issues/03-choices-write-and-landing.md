# 03: Choices Write And Landing

Status: ready-for-agent
Blocked by: 02 — Turn Page And Choices Reads
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the one member of a read-only global that takes a write, per timing, through the surface, the analysis and the executor's field lock; the write read back as a diff of one shared array; the game view landing the list and the save keeping two lists; the stats re-roll restarting from one of them.

## What to build

An After the AI script changes `turn.choices`: assignment, `push`, `splice`, element edits and `filter` then assign all count (Q9). The write is the array's state at run end differing from its state at run start (Q12). The After the AI scripts share one array in run order, so each reads the edits of the scripts before it (Q14). A non-string or blank item at run end fails that run as a bad write and nothing of it lands (Q13). An empty array is allowed: the turn shows no choices and the input box still works (Q15). At every other timing, between turns, in user Tools and with the player's choices off, the write drops and lists as dropped, and `turn` stays read-only there (Q11, Q16, Q21); at After the AI the editor's checks stop flagging that one write. The game shows the scripted list once the After the AI batch lands and stores it where the turn's choices live today, with the AI's own choices kept beside it as an additive turn-record field, so the save carries both (Q18). A stats re-roll starts the choice writes again from the AI's choices, shows its scripted list and patches the turn (Q18). This ticket does not hold the display: in a scripting world the AI list shows first and the scripted list replaces it when the batch lands. Ticket 04 closes that. The changelog fragment folds the write into the reads entry.

Spec: Q7 (the shown list), Q9, Q11–Q15, Q18, Q21, stories 9–15, 18, 20.

## Acceptance criteria

- [ ] After the AI scripts that assign, `push`, `splice`, edit an element, and `filter` then assign each land their list as the turn's shown choices
- [ ] Two After the AI scripts in run order: the second reads the first's edit, and the shown list holds both edits
- [ ] A run that leaves a non-string or blank item fails as a bad write; the turn shows the list as the earlier scripts left it
- [ ] A script that assigns `[]` shows no choices, and the input box accepts an action
- [ ] The same write at Before the AI, During AI Output, At Game Start, When a Trait Switches, in a user Tool and in a World Tool lists as dropped and lands nothing; with the player's choices off it lists as dropped at After the AI too
- [ ] The analysis gives no diagnostic to `turn.choices = [...]` at After the AI, and lists the same write at Before the AI and `turn.action = ""` at After the AI as read-only writes
- [ ] The stored turn holds the shown list where choices live today and the AI's own list in the new field; a save round-trip keeps both
- [ ] A stats re-roll twice in a row shows the list one run gives, from the AI's choices, and the turn record holds it
- [ ] Reinstating the field lock on `choices` turns the write tests red
- [ ] Hover cards and the Variable menu show `turn.choices` writable at After the AI and read-only elsewhere; the Scripts guide covers the write; the changelog fragment folds it into the reads entry

⚠️ Save shape: the turn record gains an additive field for the AI's own choices. Say so in the landing.

## Blocked by

- 02 — Turn Page And Choices Reads
