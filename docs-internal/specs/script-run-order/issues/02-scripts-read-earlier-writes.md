# 02: Scripts Read Earlier Writes

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The core of the effort. This ticket owns the per-script chain that tickets 03, 04 and 05 widen.

## What to build

In every timing, scripts run one by one, each over a fresh Sandbox Snapshot of what the script before left. Stats, traits, placeholder pins, lore and choices chain. Two scripts that each take 5 Health take 10. A Blueprint stat's write to a global stat counts once per owner. A failed script adds nothing, and later scripts still run. A script switched off by an earlier one doesn't run, and one switched on runs if it is lower in the list.

`previous` stays the turn's start value, and `value` and `delta.actual` include earlier writes. Replayed writes go at the head of the chain, and re-rolls start clean. During AI Output chains on each sentence and still lands with After the AI. The Test Bench computes with the same chain, and its finding is reworded.

Rulings: Q1, Q6, Q11, Q12, Q13, Q14, Q17.

## Acceptance criteria

- [x] Tests through `runStatCodeTurn` prove a later script reads an earlier write at Before the AI, After the AI, At Game Start and When a Trait Switches, for a stat, trait, world and Blueprint home. (`statCodeTurn.chain.test.ts`: "scripts at %s", 4 timings by 4 homes)
- [x] A test through `runItemScripts` proves it for two scripts on one item event. (`statCodeTurn.chain.test.ts`: "two scripts on one item event")
- [x] A test through `openOutputRun` proves it within one sentence, and a stopped turn applies none of the writes. (`statCodeTurn.chain.test.ts`: "During AI Output")
- [x] Tests cover the failed script, the switched-off and switched-on script, `previous` and `delta.actual`, replayed writes, and penalties applying once per timing. (`statCodeTurn.chain.test.ts`, one describe each)
- [x] "lets no run see another run's write" and "moves a world stat once when a Blueprint stat on two owners writes it" flip to the new result. Any other failing test goes to the spec session first and is never edited to pass. (Both flipped; five more cleared by the spec session under Q28, listed below)
- [x] Each new guard fails when the one-snapshot rule returns. (Reinstated one snapshot: 42 tests red. Base runner: all flipped tests red)
- [x] Bundled-world tests pass with no scenario changed. (`bundledWorlds.test.ts` and the world tests unedited, green in the affected-tests gate)
- [x] The Test Bench and the help window's code test run scripts in the Scripts tab's order. Ticket 01 left them on the old sort because `rowOrder` is optional. Every multi-script caller passes it, and a test proves the Test Bench's order. (Replaced by Q26, see below. `scriptCheck.test.ts`: "fails that script once a drag puts it above the write")
- [x] Two Scripts, One Field shows the writers' list order and says each script reads the one before it. (`rules.test.ts`: "lists the writers in the Scripts tab's order")
- [x] CONTEXT.md, Order of Effects, One snapshot per run, Owner order, the prompts rule, A Note on Accumulating Stats and the Test Bench's Issues describe the new rule. (Read in the diff)
- [x] A changelog fragment under Major says shipped worlds with stacking writes play differently and how to check a world. (`changelog.d/script-run-order-02.md`)

## Landed

**Rulings that replace a ticket line**
- The ticket's Test Bench line was wrong: neither surface calls `runStatCodeTurn`, and the help code test runs one script. Q26 replaces it. Check Scripts walks the tab's order over the chain. A script play wouldn't run stays checked and adds nothing. The help code test and Test Code do not change.

**Tests flipped under Q28, beyond the two the ticket names**
- `statCodeTurn.statWrites.test.ts`: "shows a hub's write to the target's own box lower in the list"
- `statCodeTurn.test.ts`: "reads a capped ask as actual short of total"
- `statCodeTurn.test.ts`: "lands the switch after its script"
- `statCodeTurn.test.ts`: "applies each stat's switch of one trait in turn"
- `statCodeTurn.traitScripts.test.ts`: "run once per owner when two entities hold the trait"
- `statCodeTurn.output.test.ts`: "chains other writes through the scripts on one sentence" (Q28's earlier pair)
- `statCodeTurn.entityStats.test.ts`: renamed, with its reverse case added

**Not verified**
- A live game, and the Issues row in a browser: the row prints the rule's text, which `rules.test.ts` reads.
- The final `gateStats` can apply a penalty to a moved stat after a nested switch run, because that run's timing starts at the firing. The base runner has the same gap. Ticket 03 reshapes those runs.
- Check Scripts runs a Blueprint box once, so a Blueprint row adds one owner's write to its chain, not one per owner.

**Measured**
- Twenty world scripts over sixty stats, node, median of 9: 153 ms on the chain, 149 ms on the base runner. Not measured in a browser.

**For you**
- Play a world with stacking scripts, and read Health on the bar: two scripts that each take 5 take 10.
- Open a world in Advanced mode, then the Test Bench's **Issues** tab: a row lists the writers of one stat field in the tab's order.
