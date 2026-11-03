# 06: On Call Tool and Choices Gaps

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Closes the three gaps ticket 04 named. Export shape: an additive change to a save, which the response must name at landing.

## What to build

An On Call Tool's inventory write reaches the rest of its turn, so output scripts and held item runs read it and a stat Currency paid by both charges in full. A stat re-roll brings back an On Call Tool's `give` or coin `pay`. Regenerate Choices reads Item Copies as a real After the AI run does, so a script that gives an item and then checks it reads the right count.

Ruling: Q48.

## Acceptance criteria

- [x] A test through `openOutputRun` proves a During AI Output script reads an On Call Tool's inventory write made during the reply. ("reaches a later sentence's script", and mounted: "reaches a During AI Output script through the game's own landing")
- [x] A test proves a held item run reads that write. ("reaches a held item run at the landing")
- [x] A test proves an On Call Tool and a During AI Output script that both pay one stat Currency charge the full sum. ("charges the full sum when the Tool and a script both pay a stat Currency", and mounted)
- [x] A test proves a stat re-roll brings back an On Call Tool's `give` and coin `pay`, each counted once. ("brings back its give and coin pay, each counted once")
- [x] A save written before this change loads, and a re-roll of its turn behaves as it did. A test proves it, and the new saved field is optional. ("of a save with no saved item writes behaves as it did")
- [x] A test proves Regenerate Choices gives a script the Item Copies a real After the AI run reads. Its writes still land nothing. ("gives a script the Item Copies a real After the AI run read, and its writes land nothing")
- [x] Each new guard fails when its gap returns. (Each reinstated bug went red; two survivors are named below)
- [x] The Scripts Reference sections on World Tools and Change the Choices describe this, and a changelog fragment exists if a released behavior changes. (World Tools lives in the Scripts Guide. No fragment: `git grep itemCopies v3.5.2` finds no script read of copies, so no released behavior changes)

## Landed

**Export shape**
- Additive save change: a Tool call's saved writes gain an optional `inventory` field.

**Guards proven by their own mutation**
- Each reinstated bug failed its test: the chain or the start ignoring the Tool; the game never telling the run; `previous` moving with a Tool; the save or the replay dropping inventory; choices reading live copies; quiet runs not chaining copies; no quiet Inventory pass; a quiet pass's payment dropped; a quiet On Call ignoring the chain; no fallback to the replay's base; quiet stats ignoring the settle; a pre-turn ledger under the quiet pass.

**Measured**
- Before the review's fold-ins, through the new and affected tests: `outputRun.ts` 100% statements, 95.65% branches. `statCodeTurn.ts` 87.73% statements, 79.18% branches.

**Not verified**
- A quiet run's item-held trait gate: reinstating the rendered copies fails no test, because no test world gates a trait on a held item.
- A quiet settle reading the replay's Bodies: reinstating the live Bodies failed no test before the settle fold-in, and I didn't test it again after.
- A live game beyond the mounted tests.

**Known gaps, not fixed here**
- Q49's log line reaches only the game log. Check Scripts and the Test Bench never replay saved writes, so showing it there isn't cheap.
- A quiet replay still reads live Body picks for slot checks (`inventoryWorldInForce`) and the live stat-enabled map, so a turn that changed either reads the turn's end there.
- A trait switch from an item's settle in a quiet replay fires no switch script.

**For you**
- Have the AI call an On Call Tool that gives an item during the reply, with a During AI Output script that reads items: the script reads it.
- Regenerate Stats on that turn: the item comes back once.
- Regenerate Choices on a turn where a script gives an item: the count in the choices matches the first draw.
