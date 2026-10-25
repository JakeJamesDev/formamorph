# 02: Requires Picker Categories

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

It maps sections the field already builds onto the tree from ticket 01. The design is settled, so Sonnet.

## Parent

`docs-internal/specs/picker-categories/spec.md`

## What to build

The Requirement Rows field turns on the drill-down from ticket 01. Every picker that adds a Condition gets it: a trait's **Requires**, an image's Visibility rules, and location rules.

The field builds the tree from the sections it builds today:

- **Traits** and **Any Trait in a Group** open an owner level: World, then each owner, split by the option's owner id (Q22). Each owner opens a flat list with group breadcrumbs (Q6).
- **Stats** opens an owner level from the existing stat sections, in today's order: the host's own first, then Global, then Persona, then each entity (Q3, Q15).
- **Time of Day** and **Playing As** are categories of their own. Time of Day has one target, so it shows as a row at the root (Q8).
- Empty categories and owners drop out, so off-world the picker shows only what has targets.
- An owner page is titled with the owner's name, or "World". Ticket 01 drops a leading breadcrumb segment that matches a page title (Q13); a world row in a group has no "World" segment, so nothing drops. Stat leaf sections keep today's headings, such as "Ash Stats", so the flat list matches today's list.

The owner choice page that opens after a target with several owners returns to the drilled page when you go back or pick (Q10). The Condition a row adds is the same as today; no world, save or export shape changes.

Ship with it: the Requires picker description on the World Editor traits wiki page, if it describes the list, and a changelog fragment.

## Acceptance criteria

- [x] In a world with more than 15 targets, the Requires picker opens on the categories with counts. (`RequirementRowsField.categories.test.tsx` "opens on the categories…"; live in Rampage: Traits 9, Any Trait in a Group 2, Stats 8)
- [x] The stats owner level lists owners in today's order. ("lists the stat owners in the order of the old sections"; Rampage: The Creature, Global, Persona)
- [x] Rows on an owner page don't repeat the owner name in their breadcrumb. ("drops the owner from the breadcrumb on its page and keeps it in root search")
- [x] Off-world, only categories with targets show. ("shows only the categories that have targets off-world")
- [x] The owner choice page returns to the drilled page. ("returns from the owner choice page to the drilled page")
- [ ] Image Visibility rules and location rules show the same drill-down. (Shared `RequirementRowsField`; no rendered test of those two hosts)
- [x] Each rule above has a rendered field test, and each test fails when its rule is broken. (Mutated the owner key and the lifted breadcrumb; both tests went red. Image and location hosts have no test of their own.)
- [x] A trait's Requires picker in a large bundled world: `.scratch/frames/requires-root.png` and `.scratch/frames/requires-stats-owner.png`, light theme, at desktop width. (Rampage; the pane clipped at 800 px, so the count column is cut off in the frames)

For you: add a few Conditions in a large world and judge whether finding a target is faster than before.

## Landed

**Not verified**
- Image Visibility rules and location rules: they share the field, but no test renders those hosts.
- Frames: the pane cut the popover at 800 px wide, so counts are off-frame.

**For you**
- Add a few Conditions in a large world and judge whether finding a target is faster than before.
- Q25 behavior change: back from the owner choice page now keeps the typed search in every Requires picker.
