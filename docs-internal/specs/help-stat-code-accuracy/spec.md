# Help Stat Code Accuracy

Status: ready-for-agent
Spec session: help-stat-code-accuracy — spec
Status note: Grilled 2026-10-05, Q1–Q21. Tickets 01–08 cut.

## Problem Statement

Morphie writes stat code that does not do what the player asked. In one 7-turn session on a stat's Code tab, she wrote broken code on 4 of 6 code turns. One more turn used a form that the editor underlines. Each broken script fails with no error: a wrong read gives `undefined` or a whole entry, not an exception. Her `else` branches then switch the trait off on every turn, over the player and the AI.

| Turn | Task | Her code | What is wrong |
|---|---|---|---|
| 1 | Brave at Courage 50 | `stats.Courage >= 50` | No `.value`. The comparison is always false |
| 1 | Same | `traits.Brave = true` | Runs, but the editor underlines it |
| 3 | Prowler at night | `clock.time >= 20 \|\| clock.time <= 5` | `clock.time` does not exist |
| 4 | Trait after 2 weeks | `clock.days >= 14` | `clock.days` does not exist |
| 5 | Same trait, on a custom persona | `traits.Seasoned = true` | `traits` holds world traits only. The write is dropped |
| 7 | Month, Int over 30, Grumpy | `self.value > 30`, `clock.days >= 30` | "my int" is another stat, not `self`. The clock field is invented again |

Her box choice (**Before the AI**) was correct on every turn, and her placeholder pin was correct.

The causes:

- **Retrieval missed the API sections.** The Story Clock section reached none of the 3 clock turns. The Traits section was missing on 3 turns, and Persona and Entities on the persona turn. On the turns that had the Traits section, she wrote `.enabled` correctly.
- **The Code tab's lead has no member names.** Its lead section, Dynamic Value Calculation, lists what code can do but not how to write it.
- **The Code rider points at the world map.** It says traits are read through `traits` and does not name `entities` or `persona`.
- **Wrong code stays in the history,** and later turns copy it.
- **The editor is silent on both failures.** An unknown `clock` field and a whole stat compared to a number get no underline.
- **Morphie cannot check her own code.** She has no way to learn that a script is wrong before she answers.

## Solution

Every code turn carries one guide section with the whole sandbox API, so retrieval cannot miss it. The editor flags the two silent failures as errors. On an endpoint that takes function calls, Morphie gets a fixed function that runs her draft through the editor's analysis and a Test Code run, and she fixes what it reports before she answers. Probe cases from this transcript measure the result.

## User Stories

1. As a player who asks Morphie for stat code, I want her code to use the real clock fields, so that a time-gated trait switches on.
2. As a player, I want her to count days with the day number, so that "after two weeks" works on a world with a custom calendar.
3. As a player, I want her code to read a stat through `.value`, so that a threshold check works.
4. As a player, I want her to switch a trait through `.enabled`, so that the editor does not underline her code.
5. As a player whose trait sits on my played persona, I want her to switch it through the persona, so that the switch lands.
6. As a player whose trait sits on another entity, I want her to tell me how to reach it through that entity, so that I can adapt the code.
7. As a player who names a stat ("my int"), I want her code to read that stat, so that the check uses the right number.
8. As a player on the Code tab, I want her answer to keep the box-timing rules in view, so that she still names the right box.
9. As a player who asks a code question from another screen, I want her to get the same API reference, so that her code is as good as on the Code tab.
10. As a player who pastes code from Morphie or anywhere else, I want the editor to show an error on an unknown `clock` field, so that I see the mistake before I play.
11. As a player, I want the editor to show an error when I use a whole stat as a number, so that I add the missing `.value`.
12. As a player, I want the error to suggest the closest real name, so that I can fix it in one edit.
13. As a player whose endpoint takes function calls, I want Morphie to test her code before she answers, so that the code I paste runs.
14. As a player, I want her test to check names against my open world, so that a stat she guessed wrong is caught.
15. As a player with no world open, I want her test to still catch syntax, clock and comparison errors, so that a question from the Library still gets checked code.
16. As a player, I want her to give her best code and name the remaining error when she cannot fix it, so that I can finish the fix myself.
17. As a player, I want her tests to change nothing in my world, so that asking a question is safe.
18. As a player, I want her test calls to be limited, so that a code answer does not keep me waiting.
19. As a player, I want a setting to switch the code test off, so that I can trade checking for speed.
20. As a player whose endpoint takes no function calls, I want code answers to work without the test, so that nothing breaks for me.
21. As a player who reads AI Context, I want each test call and its result in the trace, so that I can see what she checked.
22. As a developer, I want probe cases built from this transcript, so that a change to the docs, the rider or the tool shows its effect in numbers.
23. As a developer, I want the Quick Reference held to the sandbox's member lists, so that the docs cannot drift from the code.
24. As a developer, I want the glossary and an ADR to say the code test reads the open world, so that the help request's data boundary stays documented.

## Implementation Decisions

**1. Quick Reference section.**

- A new `Quick Reference` section in the Stat Code Guide lists every sandbox object and its members in one table: `self`, `stats`, `clock`, `traits`, `persona`, `entities`, `placeholders`, `dictionaries`, `console`.
- Each row gives the read form and the write form as one line of code.
- It states the access rules the transcript broke: a stat compares through `.value`; a trait switches through `.enabled`; a persona's trait is under `persona.traits`; another entity's trait is under `entities.<Name>.traits`.
- The persona rule lives here, not in the rider (Q3, Q7). The default form is the persona's; the entity path follows in one sentence.
- "After N days" has one form: `clock.day > N` (Q6). `clock.elapsedHours` stays in the table for hour-level timing.
- It holds no example values that a small model can copy as content.
- When stat-code-v6 makes other stats writable, v6 updates the stats row. The drift test forces it (Q5).

**2. Sections on a code turn.**

- On the Code tab, the lead stays Dynamic Value Calculation, and the Quick Reference is always sent second (Q1). Retrieval fills the remaining slots under the existing 5-section and size limits.
- On a code turn from any other surface, the Quick Reference replaces the surface's lead. The "the first guide section explains this screen" line is left out of that turn's message (Q2).
- "Code turn" keeps its current meaning: the Code tab is open, or the question uses a code word.

**3. Code rider.**

- The object line names `entities` and `persona` beside `traits`, as bare names. The rule that the rider names no members stays.
- The missing space after "sentence:" is fixed. This fix ships either way.
- The `entities`/`persona` names ship only if their own probe arm shows a gain over the Quick Reference alone (Q10).

**4. Editor diagnostics.**

- An unknown field after `clock.` or `clock.previous.` is an **error**, with a "Did you mean" suggestion when a field name is close (Q4).
- A whole stat entry (`stats.Name`, `stats["Name"]`, `self`) used directly as an operand of a comparison or arithmetic operator is an **error** that suggests `.value` (Q8).

**5. The code test function.**

- A new fixed function of the help request, beside the guide lookup, the dice roll and the face call. It follows ADR-0009's pattern: its own module and executor, the shared capability gate, and no Tool catalog entry (Q11).
- **Offered** only on code turns (Q16), and only to an endpoint and model known to take function calls.
- **Inputs:** `code`, `box` (before or after), and `stat`, the name of the stat the code belongs to, read as `self`. An unknown stat gives a blank `self` (Q17).
- **Checks:** the stat-code analysis, then a Test Code run of the named box on the open world's snapshot. The result holds the errors, the warnings, the returned value, every write, and every dropped write. It applies nothing (Q12).
- **No world open:** it still runs. Unknown stat, trait and placeholder names are not flagged. Syntax, clock and comparison errors still are (Q13).
- **Call limit:** 3 calls per answer by default (Q14).
- **Setting:** its own switch and call limit in the help settings, like lookup and roll. Default **on** (Q15), subject to Q19.
- **Guidance:** the function's description carries when to call it and what to do with a failure, in the Purpose / Use when / Input / Output form the roll uses. The rider does not change when the function is off (Q20).
- **A test that still fails after the last call:** Morphie gives her best code and one sentence naming the remaining error (Q18).
- The sandbox engine loads only when the function is first called, so the help bundle stays small.
- Each call and its result show in AI Context through the existing tool rounds.

**6. Data boundary (Q21).**

- The code test reads the open world: stat, trait, placeholder, entity and dictionary names reach the help request through its results. The glossary's Formaquestion entry is amended to say so.
- A new ADR records the decision: an app-internal function may read the open world when its purpose needs it, and the code test is the first.
- Help settings are per device, so no world or save export changes shape.

**7. Probe cases.** The help code cases gain known cases from this transcript: a daypart-gated trait, a day-count-gated trait, a persona trait switch, a threshold check on a named stat from another stat's Code tab, and a multi-condition placeholder pin. Each case asserts the real member names and the absence of invented ones (`clock.time`, `clock.days`, a whole stat compared to a number).

## Testing Decisions

- Tests check behavior at existing seams, never internals.
- **The help session's answer request**, driven with a fake fetch as the existing help session tests do. Assert the sections sent and their order (Q1, Q2), the functions offered on code and non-code turns (Q16), and the test function's result inside the tool rounds, with a world and without one (Q12, Q13, Q17). Assert the call limit (Q14) and that a test applies nothing.
- **The stat-code analysis**, as the existing analysis tests do. Each new error gets a test that fails with the check removed, plus negatives: `clock.day`, `stats.Int.value` and `self.value` raise nothing. The no-world mode gets its own cases.
- **A docs drift test** holds the Quick Reference's members to the sandbox's member lists, as the rider's sandbox-name drift test does. Prove it bites by removing a row.
- **Probes**, outside the gates:
  - **Bar (Q9):** the 5 new cases pass on 80% of runs on the cloud default endpoint, with 5 or more runs per case, and the existing code cases do not drop.
  - **Rider arm (Q10):** the Quick Reference plus the rider's names, against the Quick Reference alone.
  - **Tool arm (Q19):** the Quick Reference plus the code test, against the Quick Reference alone. The cloud default takes no function calls, so this arm runs on a local tool-calling model in a GPU window the user agrees to. The function ships on by default only if this arm shows a gain. Otherwise it ships off.

## Out of Scope

- **Naming the open stat in the surface line.** The surface registry holds surface ids only. It needs a new data path. The test function's `stat` input covers part of the need.
- **Removing wrong code from the history.** Revisit if probes still show carry-over.
- **Test Code's clock.** Test Code runs the before box at story hour 0, so a night check always tests as off. Noted, not changed.
- **New retrieval keywords for the Story Clock.** Blind case `statcode-b3` targets that section. Entities and Persona may gain player wording, such as NPC, companion and custom persona.

## Further Notes

- Source transcript: `D:\Downloads\ai-context-formaquestion.json`, 8 turns, Default preset, 2026-10-05. Not tracked.
- The Availability advice in her answers (code switches only Optional traits) is correct.
- Copy drift seen in her answers: "Click **Test Code**" where the guide says "Select".
- Related: stat-code-v6 (writes to other stats) also edits the stat-code analysis. This effort lands first (Q5).

## Rulings

- **Q1.** On the Code tab, the Quick Reference is pinned second, after the Dynamic Value Calculation lead.
- **Q2.** On a code turn from another surface, the Quick Reference replaces the lead, and the screen line is dropped.
- **Q3.** For a "custom character", Morphie writes `persona.traits.X.enabled` and adds one sentence on `entities.<Name>.traits`.
- **Q4.** An unknown `clock` field is an editor error.
- **Q5.** This effort goes before stat-code-v6. The drift test makes v6 update the stats row.
- **Q6.** `clock.day > N` is the one form for "after N days".
- **Q7.** The persona rule lives in the Quick Reference. The rider gets bare names only.
- **Q8.** A whole stat used as a number is an editor error.
- **Q9.** The 5 new probe cases pass on 80% of runs on the cloud default, and the existing code cases do not drop.
- **Q10.** The rider's `entities`/`persona` names ship only on a gain in their own arm. The typo fix ships either way.
- **Q11.** The code test function is part of this effort, as its last tickets.
- **Q12.** It runs the analysis plus a Test Code run, and applies nothing.
- **Q13.** It is offered with no world open. Name checks are then skipped.
- **Q14.** At most 3 calls per answer by default.
- **Q15.** It has its own switch and call limit. Default on.
- **Q16.** It is offered on code turns only.
- **Q17.** Its inputs are `code`, `box` and `stat`.
- **Q18.** After the last failing call, Morphie gives her best code and names the remaining error.
- **Q19.** It has its own probe arm on a local tool-calling model. It defaults on only on a gain.
- **Q20.** The call guidance lives in the function's description.
- **Q21.** The code test may read the open world. The glossary is amended and a new ADR records it.
- **Q22.** (Ticket 03 intent, 2026-10-05.) The new editor errors (Q4, Q8) surface in the editor underline and in Test Code, which share the analysis. The Test Bench runs each box in QuickJS and never runs the analysis, so it does not report them. Tickets 03 and 04 land without a Test Bench change.

- **Q23.** (Ticket 05 intent, 2026-10-05.) The first ticket of this spec to land writes an ungrouped changelog entry. The changelog lint refuses a one-child group, and no second Formaquestion entry exists yet. Later tickets may regroup on their own fold.

- **Q24.** (Ticket 02 intent, 2026-10-05.) The pin is not a search source. A bare code turn, with every section source off, still sends the Quick Reference, so the turn is no longer bare. On a code turn from another screen, the Quick Reference is that turn's lead in the request, in AI Context and for follow-ups.

- **Q25.** (Ticket 04 intent, 2026-10-05.) The whole-stat error flags a stat entry as an operand of `<` `>` `<=` `>=` `+` `-` `*` `/` `%` `**`, of unary `-` and `+`, and of `==` `===` `!=` `!==` when the other operand is a number literal. Parentheses are unwrapped. Equality between two entries or against `null`, compound assignment, `&&` `||` `??` and `!` stay silent. Entry forms: `self` unless the code declares its own, `stats.Name`, `stats["Name"]`, `stats[expr]`.

- **Q26.** (Ticket 06, user ruling 2026-10-05.) The code test joins the help preset file's `functions` block with its switch and call limit, like lookup and roll. A file without it is refused. The file is unreleased, so no compat. This is an export-shape change of the help preset file; the spec's earlier "no export changes shape" line was wrong.
- **Q27.** (Ticket 06 intent, 2026-10-05.) The code test runs on the authored world, as the editor's Test Code does, with no playthrough state. Each world registration hands over its authored data beside the Tool Snapshot builder. With no world open, the analysis runs with name checks off and the Test Code run is skipped; the result carries `run: null` and `world: false`. `stat` is a required string; empty or unknown gives a blank `self`.
- **Q28.** (Ticket 07 intent, 2026-10-05.) First bar run on the cloud default, 8 runs per case: five known cases 65% with the rider names, 70% without, 0% without the Quick Reference. The names ship removed (Q10). The persona case missed at 0/8 because nothing maps the player's word "character" to `persona`; 07 adds that mapping line to the Quick Reference, with "character" used only as the player's word, and proves it with a docs arm. Ticket 05's changelog entry was dropped on main, since the space fix alone is invisible to players.

- **Q29.** (Ticket 07, user ruling 2026-10-05.) Two bar runs, 8 runs per case: the landing configuration (plain rider, Quick Reference without a persona mapping line) scored 65% in both batches vs the 80% bar. The persona case is 0 of 32 across both batches on every docs arm; the model writes the world `traits` map whatever the guide says. A Quick Reference line that mapped "the character you play" to `persona` scored 73% overall but moved the persona case nothing, so it was reverted (Q10 rule). 07 lands with the bar recorded as unmet. Ticket 08 re-measures the five cases once the code test function (06) can flag the world-map write as an unknown trait.

- **Q30.** (Ticket 08, user ruling 2026-10-05.) On an authored-world run `persona` is the empty entry, so the correct `persona.traits.X.enabled` write is reported as dropped and the function's guidance pushes the model back to the world map. Ticket 09 makes the code test report a persona trait write as pending when a persona-capable entity holds the name; dropped otherwise. The editor's Test Code is unchanged. 08 waits for 09. The user also ruled 08's local model: MeroMero v2 31B, the model the other probe tickets used, not Cydonia. It locks the PC, so the run needs an AFK window.

- **Q31.** (User ruling 2026-10-05, after an agent review of a scratch-world design.) Ticket 09 landed the stand-in persona: on Formaquestion's run the empty persona holds every persona-capable trait name, and those switches return as pending. A full scratch world (assumed traits, placeholders, entities) was rejected: the analysis exposes no name set, the nearest-name split miscalls a new `Rage` beside `Race`, and a blank world hides `Helth` beside `Health`. Ticket 10 does the two parts that hold: unknown names with no near match are tagged *not in this world, create it*, and unknown stats are assumed at 0 in 0–100 so `value / max` is a number. 08 waits for 10 so the GPU window is spent once.

- **Q32.** (Ticket 10 landing, 2026-10-05.) The create-it tag needs no near match among every owner's names, not only the owner the code reached, so a typo of a name another owner holds stays an error. Result shape: top-level `notInWorld [{line, kind, name, path}]` and `run.assumed` (stat names). Untested edge: two persona-capable entities sharing a placeholder name give the stand-in two children of that name; the pin reports pending and the values check follows sandbox key order.

- **Q33.** (Ticket 08, user ruling 2026-10-05.) First tool arm on MeroMero v2 31B, 13 code cases × 2 arms × 5 runs, 0 failed: rider 84% on the known cases (Q9 met on this model; persona 5/5), test arm 76% (persona 2/5). The model called the code test **0 times in 65 answers** while calling `set_face` every time, so the arm measured offering the function, not using it. Q19's "no gain" does not apply yet. 08 holds. Ticket 11 reopens Q20 on this evidence: the rider gains a test-first line when the function is offered, then a short trigger probe (five cases × 2 runs) checks that the model calls it at all. On a trigger, 08 re-runs the full arm and Q19 decides the default. On none, the numbers are recorded and the default is the user's call. The brave-at-courage case missed on both arms with `stats.Courage` and no `.value`.

- **Q34.** (Ticket 11 trigger probe, 2026-10-05.) With the test-first rider line, present only while the code test is offered, MeroMero v2 31B called the code test on 10 of 10 answers (five known cases × 2 runs, `--parallel 1`, 159 s, 0 failed): 1.0 calls per answer, last call clean 10/10, pass 10/10 with persona 2/2 and brave 2/2. Against 08's 0 in 65, the rider line is the trigger; the function description alone was not. The description is unchanged. 08 re-runs its full arm on 11's landing, and Q19 then decides the default.

- **Q35.** (Ticket 11 intent, 2026-10-05.) The test-first line belongs to the code test function, not to the player's Code prompt. It rides whenever the function is offered, alone after the user message when the rider is cleared. Without the function, the rider is byte-identical to before. A player who wants no line turns the code test off.

- **Q36–Q37.** (User rulings 2026-10-05.) 08's full re-run was stopped at 57 of 130 answers after the user found the test unfair: `brave-at-courage` and `quotes-pin` reject a valid `self.value` answer because the request never names the open stat, so the known-case rates (84% rider, 76% test) understate the model. The 28 test-arm answers seen did call the code test, so the rider line works on the full set. **08 lands as is:** default on, numbers recorded with that caveat. Probe discipline is a skill rule, not harness wiring: every probe starts with a minutes-long smoke run that proves the mechanism fires, and a long run gets a check-in after a few answers with a stop when the mechanism is absent. The help-code probe prints nothing until the end, which made the check-in impossible; the one harness change is a per-answer line.

- **Q38.** (User ruling 2026-10-05.) Two more tickets. 12 makes the known cases fair: `self.value` is an alternate where the question says "my X" and the request does not name the open stat, and 08's saved batches are re-scored offline. 13 adds a help focus registry beside the help world registry: the selected item's `{ kind, id, name }` reaches the help request, the surface line names it, the code test's `stat` defaults to it, and the two cases require the named stat again. The out-of-scope line on naming the open stat is reopened. The surface registry stays ids only. Probe concurrency was also fixed: LM Studio shares the loaded context across its slots, so the harness now clamps `--parallel` from `lms ps` and prints a line per answer.

- **Ticket 12 result.** (2026-10-05.) `brave-at-courage` and `quotes-pin` accept `self.value` beside the named stat. 08's 1621 s baseline re-scored offline from its saved answers (the old rates reproduce: rider 21/25, test 19/25): rider **100% (25/25)**, test **88% (22/25)**, against 84% and 76% as first recorded. `brave-at-courage` was 1/5 rider and 2/5 test, now 5/5 on both. The persona case is unchanged (rider 5/5, test 2/5). The stopped re-run saved no answers, so it cannot be re-scored. Each known case's context dependency is listed in the audit note in `help-code-cases.ts`.

- **Q39.** (Ticket 13 intent, 2026-10-05.) No rider change: the surface line already names the open stat on the Code tab, and a `self` line would be a prompt change with its own arm. Done-state: smoke, then the five known cases × 5 runs on the cloud default, rider arm, focus on the fixture stat, numbers recorded here. The Dictionary Editor's entry panel has no tab ledger, so it does not register a focus; the five world-editor panels and the Entity Editor's entity panel do. A trait opened inside an entity's Traits tab leaves the entity as the focus.

- **Q40.** (Ticket 13, user ruling 2026-10-05.) Cloud probe, five known cases, 2 batches × 5 runs, rider arm with the focus on the fixture stat vs a no-focus control in the same batch: focus 26/50 (52%), control 33/50 (66%); runs 74% vs 86%. Not significant at this n (p≈0.2). Every non-persona miss on both arms is the fence tag-line drift (focus 13, control 7); no answer used `self.value`. 13 lands as built. Ticket 14 fixes the tag line in the rider and re-measures focus vs no-focus in the same batch.

## Backlog

- The Dictionary Editor's entry panel registers a help focus once it reports a tab ledger. Raised by ticket 13.
- A Test Bench rule that runs the stat-code analysis on each filled box and lists its errors. Raised by ticket 03; new scope, user's call.
- Whole-stat error follow-ups from ticket 04's review: a number slot counts as a number literal for equality; bitwise operators join the flagged set; a non-name member such as `stats.length` gets a message that says `stats` holds entries by name. User's call on a ticket.
