# 02: Scripts Read Earlier Writes

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The core of the effort. This ticket owns the per-script chain that tickets 03, 04 and 05 widen.

## What to build

In every timing, scripts run one by one, each over a fresh Sandbox Snapshot of what the script before left. Stats, traits, placeholder pins, lore and choices chain. Two scripts that each take 5 Health take 10. A Blueprint stat's write to a global stat counts once per owner. A failed script adds nothing, and later scripts still run. A script switched off by an earlier one doesn't run, and one switched on runs if it is lower in the list.

`previous` stays the turn's start value, and `value` and `delta.actual` include earlier writes. Replayed writes go at the head of the chain, and re-rolls start clean. During AI Output chains on each sentence and still lands with After the AI. The Test Bench computes with the same chain, and its finding is reworded.

Rulings: Q1, Q6, Q11, Q12, Q13, Q14, Q17.

## Acceptance criteria

- [ ] Tests through `runStatCodeTurn` prove a later script reads an earlier write at Before the AI, After the AI, At Game Start and When a Trait Switches, for a stat, trait, world and Blueprint home.
- [ ] A test through `runItemScripts` proves it for two scripts on one item event.
- [ ] A test through `openOutputRun` proves it within one sentence, and a stopped turn applies none of the writes.
- [ ] Tests cover the failed script, the switched-off and switched-on script, `previous` and `delta.actual`, replayed writes, and penalties applying once per timing.
- [ ] "lets no run see another run's write" and "moves a world stat once when a Blueprint stat on two owners writes it" flip to the new result. Any other failing test goes to the spec session first and is never edited to pass.
- [ ] Each new guard fails when the one-snapshot rule returns.
- [ ] Bundled-world tests pass with no scenario changed.
- [ ] Two Scripts, One Field shows the writers' list order and says each script reads the one before it.
- [ ] CONTEXT.md, Order of Effects, One snapshot per run, Owner order, the prompts rule, A Note on Accumulating Stats and the Test Bench's Issues describe the new rule.
- [ ] A changelog fragment under Major says shipped worlds with stacking writes play differently and how to check a world.
