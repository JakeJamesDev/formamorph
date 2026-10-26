# Spec: Turn Reply And Menu Order

Status: done
Status note: Closed 2026-10-26. Tickets 01–05 done, last landing 124bd18f4. Review: spec text corrected. Gates green on 2026-10-26. Follow-ups 06 and 07 landed 2026-10-26, last landing ad84aa9a1.
Spec session: turn-reply-and-menu-order — spec

## Problem Statement

An After the AI script cannot read the page the AI just wrote. The `narration` object exists only at During AI Output, though the full reply is finished and stored before After the AI runs. No script can read or change the player's choices: the choices pass runs after the narration, its result is set before After the AI runs, and the sandbox has no name for it. The Variable menu breaks its own ordering rule at the top level. Inside a group, fields come before verbs, but the top level is a fixed list: **Discover** sits mid-list as a leaf, `notes` comes before the timing groups, and **Narration**, **Player** and **Switched Trait** come last.

## Solution

`turn` gains two read paths beside `turn.action` and `turn.number`. `turn.narration` holds the finished page the player sees. `turn.choices` holds the turn's choices, and After the AI scripts can change them. A world whose After the AI scripts can change choices holds the choices off screen until those scripts finish. The Variable menu's top level gets an order of its own: groups first, the timing groups among them, then fields, then verbs. Inside a group, fields-then-verbs stays as it is.

## Rulings

Settled with the user on 2026-10-25 through a grill; Q19–Q21 in the code review of the spec the same day; Q22–Q24 on ticket 02's intent questions Q25–Q27 on ticket 03's, and Q28–Q30 on tickets 04's and 05's, 2026-10-26. It follows the Script Surface Gaps effort, which added `turn`.

| # | Ruling |
|---|---|
| Q1 | The Variable menu's top level lists every group first, then fields such as `notes`, then verbs such as `discover`. The groups-first step is the top level's own: inside a group the rule stays fields-then-verbs, so a stat's `previous` and `delta` keep their places |
| Q2 | The timing groups (**Narration**, **Player**, **Switched Trait**) sit right after **This Stat** or **This Trait** and **Owner**, before the world's groups |
| Q3 | The finished reply is `turn.narration`, a read-only string. The During AI Output `narration` object stays as it is |
| Q4 | `turn.narration` holds the page the player sees, with During AI Output rewrites applied |
| Q5 | `turn.narration` reads empty at Before the AI, At Game Start and During AI Output |
| Q6 | Choices read as `turn.choices`, a `string[]`. It holds the turn's choices at After the AI, and `[]` before then or when choices are off |
| Q7 | After the AI scripts can change `turn.choices`. When a world can, the game holds the choices off screen until the After the AI scripts finish; otherwise it shows them as it does today |
| Q8 | Whether a world can change choices comes from a static scan of every After the AI box the turn runs: global, entity and Blueprint stat code, trait scripts and world scripts. It reads the text as the stat write scan does |
| Q9 | `turn.choices` is a mutable array: assignment, `push`, `splice` and element edits all count |
| Q10 | **Re-generate Choices** draws new choices from the AI, then reruns the After the AI scripts with only their choice writes landing. Every other write they make drops |
| Q11 | With the player's choices off, a `turn.choices` write drops and lists as dropped, and `turn.choices` reads `[]` |
| Q12 | A choices write is the array's state at run end differing from its state at run start. The Q8 scan treats any After the AI script that names `turn` as a possible writer, so an alias (`const t = turn`, `const { choices } = turn`) still holds the display. A script that only reads `turn.action` holds it too; that cost is accepted |
| Q13 | A non-string or blank item at run end fails the run as a bad write. Nothing lands |
| Q14 | The After the AI scripts share one choices array in run order; each reads the edits of the scripts before it |
| Q15 | An empty array is allowed: the turn shows no choices, and the input box still works |
| Q16 | Between turns (a player toggle, a Tool call between turns), `turn.narration` and `turn.choices` read the last finished turn's page and choices, as `turn.number` does. A choices write there drops |
| Q17 | In Test Code and the Test Bench, After the AI reads a short sample page and three sample choices |
| Q18 | A stats re-roll starts the choice writes again from the AI's own choices for that turn, never from an earlier script edit |
| Q19 | The **Re-generate Choices** rerun replays the turn as the stats re-roll does: the pre-turn state with the turn's asks laid over it, so scripts read the same `previous` and `delta` the original run did |
| Q20 | On that rerun the `player` calls are silent: `tell` and `toast` show nothing, `confirm` answers false, `ask` answers nothing picked (`[]` with `multiple`), and `input` answers empty. The script runs on |
| Q21 | `turn` stays read-only at every timing and in every Tool. `turn.choices` alone takes a write, at After the AI only. A write there is not a read-only write in the editor's checks |
| Q22 | A run between turns while a turn is in progress (a player toggle, a user Tool call, an On Call World Tool during the narration request) reads `turn.narration` as `""` and `turn.choices` as `[]`, as it reads `turn.action` empty at the turn in progress. Once that turn's commit lands, they read this turn's |
| Q23 | The "[Continue the Story]" pseudo-choice never appears in `turn.choices` |
| Q24 | The choices-off mask (Q11) is the live setting at every read, between turns included: a stored turn's choices read `[]` once the player turns choices off. `turn.narration` is the stored narration text as is |
| Q25 | Every timing marshals `turn.choices` as an unfrozen copy, so an in-place edit never throws; a difference at run end outside After the AI lists as a read-only write and lands nothing. The editor check flags `turn.<field> = …` and `turn.choices[i] = …`, skipped for `turn.choices` at After the AI; a mutating call is caught at run time and listed as dropped. Flagging mutating calls, and writes to `clock`, `location` and `notes`, is a follow-up |
| Q26 | The turn record's AI-choices field is present only when a script changed the shown list; absent means the shown list is the AI's own. A re-roll that ends with no script edit removes it, and a stats re-roll starts from it when present |
| Q27 | A When a Trait Switches run that the After the AI batch fires reads the choices the batch left; its own choices write drops (Q21) |
| Q28 | The turn record saves the turn's resolved asks (owner, stat, value, max) as an additive field, written at the commit and on a stats re-roll, so the Q19 replay reads them. A turn without the field rebuilds global value asks from `stat_changes`. Settled with the user: the record held only global value asks |
| Q29 | On the Re-generate Choices rerun a single `ask` answers `null`. In a scripting world the streamed AI list is held until the rerun lands, then the scripted list shows once. A failing script fails alone (Q13); a stopped request, an empty reply or a rerun that cannot start puts the turn's own lists back. Writes the mode drops by design are not listed as dropped |
| Q30 | In a marked world, a Stop or failure after the narration lands shows the AI's own list, since no scripted list appeared. The mark holds only with the player's choices on. The scan reads the authored world's After the AI boxes: world scripts, global, entity and Blueprint stats and traits, and the links that override their scripts; runtime characters copy Blueprints. A local name `turn` marks the world, the cost Q12 accepts |
| Q31 | Test Code lists a `turn.choices` write as a write line, as it lists every other write (close review, 2026-10-26) |

## Surface

| Path | Type | Access | Rulings |
|---|---|---|---|
| `turn.narration` | string | read | Q3, Q4, Q5, Q16, Q17, Q22, Q24 |
| `turn.choices` | string[] | write at After the AI | Q6, Q7, Q9–Q30 |

## User Stories

1. As an author, I want the Variable menu's top level to list groups before leaves, so that the menu reads the same at every depth.
2. As an author, I want **Narration**, **Player** and **Switched Trait** near the top, so that the names my box's timing adds are easy to find.
3. As an author, I want `notes` and `discover` at the end of the top level, so that one-line names never split the groups.
4. As an author, I want to read this turn's finished page in an After the AI script, so that a script reacts to what the story said.
5. As an author, I want that page with During AI Output rewrites applied, so that a script reads what the player reads.
6. As an author, I want `turn.narration` empty before the reply is done, so that I never mistake a partial page for the turn's page.
7. As an author, I want the streaming `narration` object to stay as it is, so that my During AI Output scripts keep working.
8. As an author, I want to read the turn's choices, so that a script can check what the player is offered.
9. As an author, I want to remove a choice, so that a script can hide an option the story rules out.
10. As an author, I want to add a choice, so that a script can offer an option the AI didn't.
11. As an author, I want to edit or reorder choices, so that a script can fix wording or priority.
12. As an author, I want to use `push`, `splice` and `filter` then assign, so that I edit choices the way I edit any array.
13. As an author, I want to clear the choices, so that a turn can leave the player only free input.
14. As an author, I want each After the AI script to see the earlier scripts' edits, so that scripts can build on each other.
15. As an author, I want a bad item to fail the run, so that a mistake never shows a broken choice.
16. As a player, I want choices never to change after they appear, so that I don't click an option that moves.
17. As a player, I want choices to show as soon as possible in worlds that don't script them, so that scripts I can't see never slow me down.
18. As a player, I want my choices-off setting to win, so that no world shows choices I turned off.
19. As a player, I want **Re-generate Choices** to keep the world's choice rules, so that a re-roll never brings back an option a script removed.
20. As a player, I want a stats re-roll never to stack choice edits, so that re-rolling twice shows what one run would.
21. As an author, I want between-turn runs to read the last page and choices, so that a toggle script has the latest context.
22. As an author, I want Test Code to give a sample page and choices, so that I can test choice scripts in the editor.
23. As an author, I want hover cards, the Variable menu and the Scripts guide to cover both names, so that I learn them where I write code.

## Implementation Decisions

- **Menu order.** The tree builder sorts the top level groups-first then fields-then-verbs, after the one-child-to-leaf step, since **Discover** is a one-call group until that step. The in-group `verbsLast` pass stays as it is (Q1). The timing groups move to just after the box's own groups. One builder serves Scripts and user Tools (`CodeArea` applies `readOnlyTree` for a Tool), so both menus change. The top-level pins in the variable tree tests change, and so does the pin that puts **Narration** last; the Tool script menu test's pin held as it was.
- **Turn reads.** The Sandbox Snapshot's turn input gains the page and the choices. The commit's narration is already the rewritten text: the narration request answers with the rewrite's final, so the turn pipeline hands that and the choices answer to the After the AI runs with no new plumbing. Between-turn runs read the last finished turn's values from the stored turn, which holds the rewritten page. Before the AI, At Game Start and During AI Output read empty.
- **Choices write.** `turn` is a read-only global today: read-only on the surface, in the executor's read-only globals list, and field-locked at marshaling. The surface gives `turn.choices` write access at After the AI only, the way the timing globals are added per timing, and the analysis stops flagging that one write there (Q21). The executor marshals `turn.choices` as an unfrozen array at every timing (Q25) and reads it back at run end. A difference from the start reading is the write. The After the AI scripts run one after another, not together, so each reads the array the earlier ones left; two scripts that each ask the player now ask in turn. A non-string or blank item fails the run as a bad write. At other timings, between turns, in user Tools and with choices off, the write drops and lists as dropped.
- **Display hold.** The choices landing already holds streamed choices until the narration lands and releases them in one place. A world the Q8 scan marks keeps that hold through the After the AI batch, so the commit's own choices set and the input unlock wait with it, and the scripted list shows once. Other worlds release as today: the choices stream row by row once the narration lands, and the input unlocks with them.
- **AI choices kept.** The turn record keeps the AI's own choices beside the shown list, so a stats re-roll (Q18) and **Re-generate Choices** (Q10) start from them. The shown list stays where the turn's choices are stored today. The fields are `aiChoices` (Q26) and `statAsks`, the resolved asks by owner and stat (Q28), both additive: the turn record rides in the save's message history. A stats re-roll shows its scripted list and patches the turn, as the choices re-roll patches the choices today.
- **Re-generate Choices.** In a world that can change choices, a choices re-roll builds the replay state the stats re-roll builds (the pre-turn state, the before box, the turn's asks) and runs the After the AI batch in the `choicesOnly` mode beside the triggers-only mode: choice writes land, every other write drops, and the `player` calls answer through the `silentPrompts` host (Q19, Q20). The listener-less store cancels an ask and fails the script, which is not what Q20 wants. The scan that marks a scripting world is `scriptsChangeChoices`. In other worlds it stays a plain choices request.
- **Editor surface.** The surface description gains both names with type, access and help line. The access line on `turn.choices` names the timing, since it is the one member whose access varies. Cards, completions, the Variable menu and the Scripts guide follow from it.

## Testing Decisions

A good test drives a public seam with real inputs and asserts what an author or player sees, or what the save holds. It never asserts on the prelude's text or the tree builder's internals. Every guard proves it bites: reinstating the old behavior turns it red.

- **The Variable menu tree**: the top-level order with and without each timing group, for stat, trait, world and user Tool boxes. Prior art: the variable tree tests and the Tool script menu tests, whose top-level pins change.
- **The executor**: `turn.narration` reads; `turn.choices` assignment, `push`, `splice`, element edits and aliases each land; a bad item fails; a write drops at other timings, in a user Tool and with choices off; the choices-only mode lands a choice write, drops a stat write and answers a `confirm` false with nothing shown. Prior art: the executor's stat-write and turn tests, and the triggers-only replay tests.
- **The analysis**: a `turn.choices` write at After the AI gets no diagnostic; the same write at Before the AI and a `turn.action` write at After the AI list as read-only writes. Prior art: the surface access tests.
- **The write scan**: a box that names `turn` by any path marks the world; one that names no `turn` does not; the scan sees every After the AI box kind of Q8. Prior art: the stat write scan tests.
- **The Sandbox Snapshot builder**: the page and choices per timing, between turns and in the editor samples. Prior art: the snapshot tests ticket 01 of Script Surface Gaps added.
- **The turn commit and the game view's choices landing**: the hold in a scripting world and none elsewhere; the shown list after After the AI; **Re-generate Choices** keeping a script's removal and reading the turn's `delta` as the original run did (Q19); a stats re-roll starting from the AI's choices; the AI's choices kept in the save. Prior art: the game view's turn and re-roll tests.

## Out of Scope

- Writing `turn.narration` or rewriting the page after During AI Output.
- Choice writes from Before the AI, During AI Output, At Game Start, When a Trait Switches, World Tools or user Tools.
- A built-in notice when a script changes choices.
- Reordering groups within the top level beyond Q2.

## Further Notes

- The changelog carries one entry for the menu order and three under **Scripts**: the reads and the write as one, the hold, and the **Re-generate Choices** rerun. The last two are capabilities of their own, so they stay separate.
- The help vectors rebuild before release, since the Scripts guide changes.
- Follow-ups after the close, 2026-10-26: ticket 06 folds the close review's six Standards findings; ticket 07 gives the editor check the mutating calls on `turn.choices` and the `clock`, `location` and `notes` writes (Q25). Both opened after `Status: done`.
