# 07: Script Weather

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Author scripts can read and set the World Weather. The spec covers this in Q12 and the Scripts section.

- **Member.** A world-level weather member on the script surface: read the World Weather; set it to Clear or an allowed kind. This widens the sandbox's exposure on purpose.
- **Writes.** A set lands at commit through the existing write path, at ticket 03's script hook point, saves with the turn and undoes with it. A set that changes the experienced weather fires a Weather Change.
- **Errors.** A kind outside the allowed list, or Weather off, stops the script with an error that names it.
- **Docs.** The scripting reference wiki page describes the member.

## Acceptance criteria

- [ ] Script-runner tests cover a read, a set to each allowed kind, the out-of-list error, the Weather-off error and undo. Each guard bites when its bug returns.
- [ ] A script set during a turn reaches the Turn Commit and fires a Weather Change, and a later Weather Condition read sees it.
- [ ] Changelog fragment written.
