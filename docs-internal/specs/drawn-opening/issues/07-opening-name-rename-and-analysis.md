# 07: Opening Name Rename and Analysis

Status: ready-for-agent
Blocked by: 01, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Renaming an Opening rewrites matching `opening.name` comparisons in every script, through the existing code-name rename path (Q13). Names are unique only per owner (Q3). So when the code also tests `opening.owner`, the rewrite is scoped to that owner. When it doesn't, every match is rewritten. Code analysis knows the world's Opening names and flags a comparison against a name no Opening has.

Ships its own docs: the scripting wiki's rename notes and a changelog fragment.

## Acceptance criteria

- [ ] Renaming "ambush" to "raid" rewrites `opening.name === "ambush"` in a world script, through the rename suite.
- [ ] Renaming one owner's "ambush" leaves a comparison guarded by another owner's name untouched.
- [ ] Clearing a name leaves code as written, and analysis then flags the comparison.
- [ ] Analysis flags `opening.name === "typo"` when no Opening has that name, and stays quiet for a real name.
