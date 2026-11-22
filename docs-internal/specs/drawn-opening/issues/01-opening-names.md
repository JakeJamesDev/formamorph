# 01: Opening Names

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An author can give any Opening an optional code name in the Openings panel, through the same field and code-name rules as a script name (Q2, Q20). Names are unique within one owner's Openings, and two owners may share a name (Q3). A blank name shows a derived label, "Owner · Opening N", in the editor only (Q2).

This ticket owns the derived-label helper. Tickets 04, 06 and 07 import it.

Ships its own docs: the Openings section of the authoring wiki, the **Opening** glossary entry, and a changelog fragment.

## Acceptance criteria

- [x] An Opening's name saves, survives world export and import, and absent or blank both read as no name. (`openingNames.test.ts`: trim, blank stored absent, remint and `migrateWorld` keep it; character-card import carries it)
- [x] The editor refuses a name that another Opening of the same owner already has, and accepts the same name on another owner. (`OpeningsPanel.names.test.tsx` error and no write; `openingNameTaken` per-owner test; guard mutation-tested)
- [x] An unnamed Opening shows "Owner · Opening N" in the panel, and the label follows the row when the author reorders. (`OpeningsPanel.names.test.tsx` rerender with swapped rows)
- [x] The derived-label helper is exported for later tickets and covered by its own test. (`openingLabel` in `src/lib/openings.ts`, `openingNames.test.ts`)

⚠️ World `.json` shape change: `name` on Openings.

## Landed

**Not verified**
- Not seen in a browser: the Name box layout in the expanded card (no dev-router frame taken).
- The Q13 rename path and unknown-name analysis are ticket 07, per the spec session.

**For you**
- Open an opening card and look at the Name box and the error line beside the text field; both use existing field styles.
- Spec ruling from the spec session: names are trimmed, case-sensitive, unique across the owner's full list including Self rows; the header shows the name, else "Owner · Opening N" (world rows "World · Opening N"), where N is the row's place among the rows the editor shows. Character-card import also keeps the name.
