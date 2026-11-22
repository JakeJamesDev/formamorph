# 01: Opening Names

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An author can give any Opening an optional code name in the Openings panel, through the same field and code-name rules as a script name (Q2, Q20). Names are unique within one owner's Openings, and two owners may share a name (Q3). A blank name shows a derived label, "Owner · Opening N", in the editor only (Q2).

This ticket owns the derived-label helper. Tickets 04, 06 and 07 import it.

Ships its own docs: the Openings section of the authoring wiki, the **Opening** glossary entry, and a changelog fragment.

## Acceptance criteria

- [ ] An Opening's name saves, survives world export and import, and absent or blank both read as no name.
- [ ] The editor refuses a name that another Opening of the same owner already has, and accepts the same name on another owner.
- [ ] An unnamed Opening shows "Owner · Opening N" in the panel, and the label follows the row when the author reorders.
- [ ] The derived-label helper is exported for later tickets and covered by its own test.

⚠️ World `.json` shape change: `name` on Openings.
