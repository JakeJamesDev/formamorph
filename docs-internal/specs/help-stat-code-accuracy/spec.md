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
