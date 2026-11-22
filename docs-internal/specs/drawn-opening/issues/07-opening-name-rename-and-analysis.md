# 07: Opening Name Rename and Analysis

Status: ready-for-human
Blocked by: 01, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Renaming an Opening rewrites matching `opening.name` comparisons in every script, through the existing code-name rename path (Q13). Names are unique only per owner (Q3). So when the code also tests `opening.owner`, the rewrite is scoped to that owner. When it doesn't, every match is rewritten. Code analysis knows the world's Opening names and flags a comparison against a name no Opening has.

Ships its own docs: the scripting wiki's rename notes and a changelog fragment.

## Acceptance criteria

- [x] Renaming "ambush" to "raid" rewrites `opening.name === "ambush"` in a world script, through the rename suite. (`statCodeRename.openings.test.ts`, "rewrites `opening.name === "ambush"` …")
- [x] Renaming one owner's "ambush" leaves a comparison guarded by another owner's name untouched. (same suite, "rewrites the comparison guarded by this owner …"; red when the owner check is removed)
- [x] Clearing a name leaves code as written, and analysis then flags the comparison. (rename suite "offers nothing for a cleared name"; analysis suite "flags the old name once a rename or a cleared name …")
- [x] Analysis flags `opening.name === "typo"` when no Opening has that name, and stays quiet for a real name. (`statCodeAnalysis.openingNames.test.ts`)

## Landed

**Not verified**
- The name field's offer in the live editor: only the panel component test (`OpeningsPanel.names.test.tsx`) and the planner suites cover it. No browser check, no coverage run.
- Openings of library entities and the Custom Persona in play are not counted as known names or as other owners, so a comparison against one of their names gets a warning, and an unguarded one may be rewritten outright.

**For you**
- Rename an Opening in the Openings tab with a script that compares `opening.name`: check the **Update Code References** wording ("Another owner may also have an Opening named …") and the new editor warning "No Opening is named …".
- A guard written as an early return (`if (opening.owner.name !== "A") return;`) reads as no guard.
