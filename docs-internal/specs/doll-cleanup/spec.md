# Spec: Doll Cleanup

Status: ready-for-agent
Spec session: doll-cleanup — spec

## Problem Statement

The Inventory panel's doll shows long item names in small Slot Boxes, so most of them can't be read. A ring box is about 14px wide.

Unequipping takes several clicks: open the Slot Box's popover, then press the button. The doll also has no list beside it, so the player can't scan what they wear.

A Custom Image Backdrop can be too bright for the Slot Boxes and icons to read. An author must edit the image to fix it. The Map Background already has a fade for this problem.

## Solution

**Item icons.** Slot Boxes show an icon instead of the item's name. Each Item has an Icon field with three choices: Auto, a specific icon, or None. Auto is the default, and it derives the icon from the item's name. AI-created items and blank items use Auto too. Icons come from one Game Icons catalog.

**Two columns.** The doll sits at about 1/3 of the width, and an Equipped list fills the rest. Each row has a one-click unequip button. A Slot Box click still works. Wide Bodies stack.

**Backdrop Opacity.** A Custom Image Backdrop gets an opacity slider in the Body Layout editor, like the Map Background's fade.

## Rulings

Settled in the grill on 2026-11-01. A settled ruling reopens on new evidence, never on a new opinion.

### Icons

| # | Ruling |
|---|---|
| Q1 | The author picks from the same catalog that names derive from: 67 icons at the prototype's count, 53 KB gzipped. The catalog can grow. The full set of 4,133 icons (2.8 MB gzipped) is not used. |
| Q2 | The Item editor gets an Icon field that opens a searchable grid. Auto is the default and shows the icon the name derives. |
| Q3, Q9 | Auto means the derived icon. Auto beats the Item image. A specific icon also beats the Item image. Only None shows the Item image. |
| Q4 | Carried rows show icons with the same rules as the doll. |
| Q19 | After play: the entity popup's Equipped rows show icons under the same rules, and the item popup's header shows the catalog icon beside the name. Under None the header shows no icon, since the body draws the image. |
| Q6 | Auto derives at display time and nothing is stored. The AI does not pick icons. |
| Q7 | The word list is English only. A name in another language falls through to the slot icon, then the generic icon. |
| Q10 | None shows the Item image. With no image, a Slot Box is a plain filled box with the name in its tooltip, and rows show no icon. Long text never returns to the doll. |
| Q11 | An unidentified Item Copy ignores the Icon field and the Item image. It derives from its unidentified name, then its slot, then the generic icon. |
| Q13 | Game Icons is the only icon set, under CC BY 3.0. Its credit is set by Q16 and Q17. |
| Q16 | New evidence: no build shipped THIRD-PARTY-NOTICES.md, and desktop and APK players can't easily open a packaged file. Every build now ships the file, with the credit and license text, and the app also shows a short credit line that opens the full credit. The credit names the authors of the icons we ship. |
| Q17 | The credit line sits in the Main Menu footer, beside the copyright and origin credit, at the same prominence. |

### Layout

| # | Ruling |
|---|---|
| Q5 | Long Equipped names stay on one line with an ellipsis. The tooltip shows the full name. |
| Q12 | Layout C holds at every width, mobile included: the doll and list stay side by side. |
| Q15 | Replaced after play: the popover repeated the row. Pressing an Equipped row opens the item popup in one press, like Carried rows. The unequip button stays separate. The doll's Slot Box keeps its popover. |
| Q18 | After play: the default outlines sit centered on the Backdrop. Humanoid moves down 6.5 of 200 and Quadruped 1 of 125. Slot Boxes in bundled worlds and the design system's samples move with them. Stored boxes in an author's unreleased draft do not. |
| V1 | Prototype verdict: layout C. The doll takes `clamp(120px, 33%, its full width)`. A Body wider than tall always stacks, doll over list, at every width. A square Body takes columns. |

### Backdrop Opacity and effort

| # | Ruling |
|---|---|
| Q14 | Opacity applies to Custom Image Backdrops only. It is a slider in the Body Layout editor, 0 to 100 in steps of 1 like the Map Background's, default 100%. 0% is allowed. |
| Q8 | One effort. Backdrop Opacity is its own ticket. |

## User Stories

1. As a player, I want an icon in each filled Slot Box, so that I can read what I wear at a glance.
2. As a player, I want an Equipped list beside the doll, so that I can scan my gear by name.
3. As a player, I want one click to unequip from the Equipped list, so that I don't open a popover first.
4. As a player, I want to still click a Slot Box, so that the doll stays usable.
5. As a player, I want one row per Item Copy with its slot names, so that a two-slot item doesn't appear twice.
6. As a player, I want a clipped name's full text in a tooltip, so that I can read it on desktop.
7. As a mobile player, I want to tap a row's name for the same popover as the Slot Box, so that I can read the full name.
8. As a mobile player, I want the unequip button in the list, so that I don't have to hit a 14px box.
9. As a player, I want Carried rows to show icons, so that an item looks the same in every list.
10. As a player, I want an item the AI created to get a sensible icon, so that it doesn't look broken next to authored items.
11. As a player, I want an item whose name matches no word to use its slot's icon, so that a Slot Box is never blank by accident.
12. As a player, I want an unidentified item's icon to reveal nothing, so that identification still means something.
13. As an author, I want Auto as the default, so that I get icons with no work.
14. As an author, I want to see what Auto gives in the Icon field, so that I know when to override it.
15. As an author, I want to search a grid of icons, so that I can pick the right one quickly.
16. As an author, I want to choose a specific icon, so that a wrong guess doesn't force me to rename the item.
17. As an author, I want to choose None, so that my Item image shows on the doll and in rows.
18. As an author, I want an opacity slider on a Custom Image Backdrop, so that I can use a bright image without editing it.
19. As an author, I want Backdrop Opacity to default to 100%, so that my image looks as it did until I change it.
20. As an author, I want the Icon field and Backdrop Opacity to survive export and import, so that sharing a world keeps them.
21. As a player of a world in another language, I want slot icons when names don't match, so that the doll still reads.

## Implementation Decisions

- **Icon resolver.** One new deep, pure module decides what an Item Copy shows. Input: the Item (or a runtime item's name), the Item Copy's identity and its slots. Output: an icon id, the Item image, or nothing. Every surface calls it: doll, Equipped rows, Carried rows, the Here card and the editor's Auto preview.
- **Resolution order.** Unidentified: derive only. Otherwise a specific icon, then None's image or nothing, then Auto's derivation.
- **Derivation.** Take the head noun before of, from, with or for, else read from the last word back. Container words skip to the tail, so "Vial of Antidote" reads the contents. Then the slot's name, then the generic icon. This came from the prototype's `iconFromName` and `iconFromSlots`.
- **Catalog.** A generated module holds each icon's id, group, SVG body and words. Ids are our own, not Game Icons names, so an art swap never touches a world. The prototype's generated data is the starting point, and its lucide column goes.
- **Containers.** Vial, phial, bottle and flask are container words: the tail reads first, then the container's own icon. The generic icon's words are bag, sack and pouch. Every catalog icon records its author.
- **Item details.** The popup a row opens keeps the Item image under every Icon choice. Q3 and Q9 cover the doll and rows only.
- **Unknown id.** An id missing from the catalog reads as Auto.
- **Item shape.** `Item.icon?` holds an icon id or `'none'`. Absent means Auto. No migration: absent already means the right thing. **Export-shape change, additive.**
- **Backdrop shape.** The Custom Image Backdrop gets `opacity?`, 0 to 1, absent means 1. The Backdrop parser rebuilds the object on load, so it must keep and clamp this field, and replacing the image must keep it too. **Export-shape change, additive.** The save shape does not change.
- **Visibility.** The Icon field is display only. Scripts and prompts don't see it.
- **Popover.** The Slot Box popover and the row-name popover show the same content, with the full name unclipped. Row-name press and the row's buttons don't trigger each other.
- **Panel layout.** The doll takes `fit` sizing as in the prototype. The list is the existing row with the slot names, joined with ", ", as its second line. That replaces the uses line or runtime description in the Equipped list only; both stay in the popover and the popup. Tooltips for clipped names go on Equipped rows only.
- **Popover name.** The name inside the Slot Box popover wraps and still opens the item popup.
- **Icon field.** It sits on the Profile tab under Name, in Simple and Advanced, as a Select-style trigger that opens a Popover. Icon names are the first catalog word in Title Case. The Auto preview derives from Name and slots with placeholder labels, so it can differ from a rolled name in play, and it never reads the Unidentified Name. The grid is a new visual pattern, so the user approves frames before it lands, and it then gets a Design System entry.
- **Empty Slot Box.** It keeps today's behavior: a tap flashes the slot's name.
- **Copy.** Labels and hints follow the Writing Guide at build time.
- **Prototype data.** The bigger dev fixture (9 slots, worn items, a bright image) moves to the real dev route, so that later checks have it. The image Backdrop is its Humanoid default at 100%, and a dev-only `opacity=N` hash param stays for frames. The other prototype params do not move. Ticket 02 adds any `icon` values.

## Testing Decisions

A good test calls the module's public interface and checks what the player or author gets. It does not mirror the code. Each guard must fail when its bug returns.

- **Icon resolver (new seam).** Table tests: Auto, specific and None, each with and without an image. Unidentified with each choice, including a named Unidentified Name. Unknown id. Head noun, container words, slot fallback, generic fallback. A non-English name. An item with no name.
- **Catalog.** Every word maps to one icon, and every icon has a body and at least one word.
- **Inventory panel (existing tests).** Filled Slot Boxes show the resolver's result and no long text. One row per Item Copy, with an All of item once. One-click unequip. Row name and Slot Box open the same popover. Carried rows show icons. An unidentified copy shows no authored icon or image.
- **Body Layout (existing tests).** Opacity survives parse, is clamped and survives an image change. Absent reads as 100%.
- **Item editor.** Auto shows the derived preview, and picking an icon or None writes the right value. Export and import keep both shapes.
- **Verification.** DOM reads through the dev route at 375, 1366 and 1920, plus name clip counts and static frames. Both themes for the icons and the Backdrop fade.

## Out of Scope

- The AI choosing icons, or any Inventory pass prompt change.
- Other languages in the word list.
- Icons outside the Game Icons catalog, uploaded icons, or the full 4,133-icon set.
- A separate credits screen beyond what opens the full credit.
- A color tint over a Backdrop.
- Opacity on Humanoid, Quadruped or Plain Backdrops.
- Icons on other surfaces, such as narration or the Effects list. Q19 adds the entity popup's rows and the item popup's header.

## Further Notes

- ⚠️ **Effect on existing worlds:** Auto beats images, so existing Item images leave the doll and the rows by default. The author must set None to bring one back. This is the ruling (Q3, Q9), and the changelog should say so.
- **Credit:** the Game Icons entry lives in the hand-kept Bundled assets section of THIRD-PARTY-NOTICES.md, and a test fails if it leaves.
- **Measurements (layout C, 9 equipped items):**

| Width | Doll | Ring box | Names clipped |
|---|---|---|---|
| 375 | 120×240 | 14 | 6 |
| 430 | 123×246 | 15 | 1 |
| 1280 | 120×240 | 14 | 8 |
| 1366 | 120×240 | 14 | 6 |
| 1920 | 145×290 | 17 | 0 |

- **Icon sets compared** on 22 worn and fantasy items: Game Icons 22, MDI 18, Hugeicons 16, Fluent Emoji High Contrast 15, Phosphor 11. Lucide lacks most worn items.

## Prototype

- **Question:** which doll layout, which icons, and does an opacity slider fix bright images?
- **Verdict:** layout C, Game Icons, and the slider works.
- **Branch:** `prototype/doll-cleanup`, commit a04717109. It is a primary source, not code to merge.
- **Run:** `preview_start` entry `prototype-doll-cleanup` in that worktree, port 5263.
- **Route:** `#dev?view=gameViewer&tab=inventory&fixture=items`, with `variant=wrap|third|clamp|today`, `icons=game|lucide|text`, `body=hound`, `backdrop=image`, `opacity=N` and `sheet=1`.
- **Evidence:** contact sheets in the worktree's `.scratch/doll-prototype/`.
