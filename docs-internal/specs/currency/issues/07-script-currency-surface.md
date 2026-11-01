# 07: Script Currency Surface

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A narrow surface over the Payment plan, following the `give` write path.

## What to build

A script reads an owner's balance in a Currency and runs pay under the same rules as the pass, so a toll gate needs no change math. Direct stat writes and `give` keep working.

Rulings: Q19, Q29.

## Acceptance criteria

- [ ] A script reads a coin balance, a stat balance and an untracked owner, through the real executor.
- [ ] A script's pay settles exact change and refuses a payment the owner can't afford, and the script can see the result.
- [ ] A direct stat write and `give` still work on a backing stat and a coin. A test proves each.
- [ ] A locked stat refuses a script's pay.
- [ ] The stat code sandbox exposes nothing beyond this surface.
- [ ] The editor's completions and Code Hover Cards list the surface.
- [ ] The Formaquestion stat code help and the scripting docs describe it, and a changelog fragment exists.
