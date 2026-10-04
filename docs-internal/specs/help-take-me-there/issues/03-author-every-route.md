# 03: Author every route

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Every how-to section in the player docs names its surface, or the ticket records why it has none.

- Each of the how-to sections (about 176) gets a route line, chosen from the surface ids. A section that describes no single surface (a concept, a cross-screen flow) gets none, and the ticket's Answer lists them with the reason.
- Route lines add no text to a section, so the AI Picks list should not move. The recall probe runs once on cloud before and after, and the Answer reports the two numbers.

Spec: Implementation → Route tags in the docs; Further Notes.

Recommended model rationale: mechanical authoring across many pages with a validation test as the net.

## Acceptance criteria

- [x] Every how-to section carries a route or is listed in the Answer with a reason.
- [x] The source test passes on every page.
- [x] Recall probe before and after, both reported; a moved pick is named.
- [x] The four gates are green.

## Answer

178 how-to sections: 165 carry a route (15 from ticket 01, 150 here), 13 carry none.

**Rule.** A route names the surface where the section's steps happen. Steps that span sibling tabs of one surface take that surface (`worldEditor.entities` for a custom persona). When the surface map ties the heading to a dialog, the route is the dialog id. A "See …" cross-reference is not a step.

**No route (13):**

| Section | Reason |
|---|---|
| How to Turn On Tools | Ticket 01 left it out: spans the Output and Tools tabs of Settings |
| How to Attach Images to an Action | Steps run in Settings → Output, then on the game screen |
| How to Import a SillyTavern Card | Starts in the Library, ends in the World Editor |
| How to Install on Android | Happens before the app exists |
| How to Save an Export to a Folder | Android's picker opens from any export |
| How to Get Help for the Screen You Have Open | Its surface is whichever screen is open |
| How to Move the Help Tab | The tab lives on every screen |
| How to Put a Name in Your Text | Any prose field in any editor |
| How to Format Text with the Toolbar | Any prose field in any editor |
| How to Highlight Text | Any prose field in any editor |
| How to Add a Stat (WorldFormat) | Edits a JSON file in a text editor |
| How to Add a Trait (WorldFormat) | Edits a JSON file in a text editor |
| How to Add an Entity (WorldFormat) | Edits a JSON file in a text editor |

**Judgment calls you can change in one line:**

- "How to Turn On Tools" could take `settings`, the one surface that holds both tabs.
- "How to Turn Choices Off" routes to `settings.output`; its first steps use the in-game How to Play dialog, which has no surface id.
- "How to Ask About a Screenshot" routes to `formaquestion.ask`; its Settings step is a cross-reference.
- "How to Export an Entity or a Dictionary" and the Group, Tile and Update-a-Linked-Copy sections route to `mainMenu`, because they span or ignore the library tabs.
- "How to Pin a Value" routes to `worldEditor`; it pins from a trait, a location or a stat band.
- "How to Add a Self Opening" routes to `worldEditor.entities`; its steps use the Profile and Openings tabs. `worldEditorEntity.openings` is the other fit.
- "How to Edit a World File by Hand" routes to `mainMenu.worlds`, for its export and import steps. The three WorldFormat sections that edit the JSON have none.
- "How to Link a Copy to Your Library" routes to `worldEditor`; its steps open an entity or a dictionary.
- "How to Offer an Entity or Dictionary as an Add-on" routes to `publish`, which has no entity or dictionary tab.
- "How to Enter a Contest" routes to `publish.world`, where the contest card is. `community.contest` is the other fit.

**Recall probe** (cloud, `shipped` arm, 5 runs, 191 questions), before then after:

| Set | Recall@5 before | Recall@5 after |
|---|---|---|
| known | 84.5% (82.5–86.6) | 84.3% (82.5–85.6) |
| blind | 88.7% (87.2–89.4) | 89.8% (88.3–91.5) |

The offline keyword arm did not change (known 70.1%, blind 72.3%). The pick request is the same 506 headings, so the AI Picks list did not move. The shipped differences sit inside the cloud's run-to-run drift, and the intervals overlap. No pick is named as moved.
