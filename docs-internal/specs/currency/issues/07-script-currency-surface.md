# 07: Script Currency Surface

Status: ready-for-human
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A narrow surface over the Payment plan, following the `give` write path.

## What to build

A script reads an owner's balance in a Currency and runs pay under the same rules as the pass, so a toll gate needs no change math. Direct stat writes and `give` keep working.

Rulings: Q19, Q29.

## Acceptance criteria

- [x] A script reads a coin balance, a stat balance and an untracked owner, through the real executor. `statCodeExecutor.currencies.test.ts`, "reads a coin balance, a stat balance and an untracked owner"; `statCodeTurn.currencies.test.ts` runs a world script through `snapshotOf`.
- [x] A script's pay settles exact change and refuses a payment the owner can't afford, and the script can see the result. Executor tests "settles a coin pay with exact change…" and "refuses a payment the owner cannot afford…"; the turn test "lets a toll gate branch on the balance and the refusal".
- [x] A direct stat write and `give` still work on a backing stat and a coin. A test proves each. Executor tests "keeps direct stat writes working beside a payment" and "keeps give working on a coin beside a payment".
- [x] A locked stat refuses a script's pay. Executor test "refuses a locked stat for the payer and for the payee…", and the turn test "refuses a locked payer stat".
- [x] The stat code sandbox exposes nothing beyond this surface. Executor test "exposes no more than id, name and kind as fields, and no host hook"; the Tool surface drift tests hold `currencies` out of a user Tool (`statCodeSurface.access.test.ts`).
- [x] The editor's completions and Code Hover Cards list the surface. `statCodeVariableTree.test.ts` (Currencies menu, entry details, every leaf runs); `codeCards.currencies.test.ts` (hover card with Guide link, completion).
- [x] The Formaquestion stat code help and the scripting docs describe it, and a changelog fragment exists. `Scripts-Reference.md` quick reference row and Currencies section, which the help window reads; `SANDBOX_GLOBAL_NAMES` in the code rider; `currency-07.md`.

## Landed

Rulings from the spec session: Q59 to Q62 (pay settles through a host hook in the run, no replay tape; `balance` is null for a name-only Currency; same-run direct writes and `give` stay out of `balance`; a script pay and a pass pay both count).

**How it works.** The `currencies` global calls one host hook, which runs the Payment plan over a state the run holds (`src/lib/scriptMoney.ts`). The plan's coin ops join the run's inventory writes, and its stat changes land as final stat values after the run's own stat writes. A failed script discards both.

**Not verified**

- Two scripts of one turn each read the same starting state. Each plans its pay alone, so two pays from one balance can undercharge: the later stat write wins, and a coin `lose` past what is held is skipped with a diagnostic.
- A script pay followed by a pass pay in one turn has no test. The pass plans over the stats and coins after the script's writes land, which I read but did not run.
- Test Code and the Test Bench build no Currencies, as they build no items, so `currencies.X` stops the script there.
- A user Tool has no `currencies`. A Tool that reads a balance needs a read-only form.
- The Variable menu and hover card were checked through tests, not in the preview.

**Known limits**

- A coin a payment made can't pay again in the same run: the run can't name a copy the host has not landed, so the next payment refuses.
- `balance` leaves out the run's own stat writes and `give` calls (Q61).

**For you**

- Write a toll gate script with `currencies.<Currency>.pay(persona, "Gatekeeper", 5)` in a coin world and a stat world. Does the money move once, with change, and does a broke player see the refusal? Look at the Inventory tab and the script's `paid` result.
