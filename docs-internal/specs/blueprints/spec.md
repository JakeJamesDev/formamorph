# Blueprints

Status: ready-for-agent
Spec session: blueprints — spec

## Problem Statement

Trait links let many bearers share one Paladin. Their pins break placeholder rules.

- A bearer-relative pin falls back to the world placeholder of that name. Each link then picks its own value from the world list. One World placeholder reads a different value in each bearer's text. The docs say a World placeholder reads one value everywhere, so the placeholder acts as Unique.
- The alternative in the trait-links spec is an owned placeholder of the same name on every bearer. The author makes each one by hand. Each copy drifts from the world list, and nothing records that the copies share an origin.
- A trait link overrides only default-on and pin values. Any deeper change needs Detach, which cuts the link for good.
- Custom Persona is a system node that holds links only. It cannot own traits or placeholders. Entity-owned stats will hit the same wall.

## Solution

One concept, **Blueprints**, with one behavior everywhere: **live until edited**.

- A blueprint is a world item that exists to be linked or copied. The trait Templates group becomes **Blueprints**. Placeholders get a Blueprints group too.
- A linked or copied item reads its blueprint live. Each field the author changes becomes an override. **Reset** returns one field to the blueprint. **Reset to Blueprint** returns all of them.
- An entity owns a **copy** of a blueprint placeholder. The copy appears automatically when a trait needs it.
- A trait pins a placeholder **by blueprint**. On each bearer the pin traces the blueprint to that bearer's copy.
- Blueprint chips go only in blueprint-origin text: original traits and blueprint or copy values. There they always have a bearer.
- **Custom Persona** becomes an entity mark. The marked entity owns traits, links and copies like any entity. It replaces None at Enter World.

## User Stories

### Blueprints and live-until-edited

1. As an author, I want every blueprint kind to behave the same way, so that I learn one rule for traits and placeholders.
2. As an author, I want a link or copy to read its blueprint live until I change a field, so that edits to the blueprint reach every bearer.
3. As an author, I want each field I change to become an override, so that the rest of the link still follows the blueprint.
4. As an author, I want a Reset action on each overridden field, so that I can return one field to the blueprint.
5. As an author, I want a Reset to Blueprint footer, so that I can drop every override at once.
6. As an author, I want a "Blueprint changed" marker on an overridden field when the blueprint changed that field, so that I know my override may be stale.
7. As an author, I want the stale marker only on the Details panel, so that the tree stays clean.

### Trait links

8. As an author, I want a link to override default-on, requirements, pins, Player Can Toggle and stat changes, so that Albus's Paladin can differ from mine where it matters.
9. As an author, I want a link's name and descriptions fixed to the original, so that a trait reads the same for every bearer.
10. As an author, I want requirements, pins and stat changes to override as a whole list, so that the override is easy to read and reset.
11. As an author, I want a linked group's children to stay live, so that a child added to the original reaches every link.
12. As an author, I want Detach for structural changes, so that I can make a group my own when overrides are not enough.
13. As an author, I want editing a selected link to write an override on that link, so that my change does not reach other bearers.
14. As an author, I want an Edit Blueprint action on a link, so that I can jump to the original and change it for everyone.
15. As an author, I want a detached link's blueprint chips and pins rewritten to the entity's own copies, so that the detached trait keeps reading this bearer's values.
16. As an author, I want an original dragged onto an entity as an owned trait rewritten the same way, so that a move and a Detach agree.
17. As a player, I want a link's Player Can Toggle override to apply in play, so that the author can lock a class for one persona only.
18. As a player, I want a link's stat-change override to apply when I play that persona, and to apply and reverse when I switch persona, so that a class can scale per persona.

### Placeholder blueprints

19. As an author, I want a Blueprints group in the Placeholders tab, so that I can keep blueprints apart from world placeholders.
20. As an author, I want the Blueprints group added from the + menu, at most one, so that it works like the trait Blueprints group.
21. As an author, I want a blueprint placeholder never to act as a World placeholder, so that one placeholder never reads different values in different places. Under None with no Custom Persona entity the player is the one bearer, so the blueprint reads its own values there (story 61).
22. As an author, I want a drag out of Blueprints refused while trait text or copies use the blueprint, with a notice that names the uses, so that nothing breaks silently.
23. As an author, I want an entity to get a copy of a blueprint automatically when a trait pins or places it, so that I do no per-entity setup.
24. As an author, I want copies created for the blueprints a copy's values reach, so that nested blueprint chips resolve on the same bearer.
25. As an author, I want a root trait to create copies on every Persona entity and on the Custom Persona entity, so that each playable persona can customize it.
26. As an author, I want an untouched copy removed when the last trait or chip that uses it leaves, so that the tree does not fill with dead copies.
27. As an author, I want an edited copy kept when its last use leaves, so that my work is never deleted without asking.
28. As an author, I want to override a copy's value text one value at a time, so that Albus's garb reads differently from mine.
29. As an author, I want to override a copy's value weights one value at a time, so that one bearer can favor or bench a value.
30. As an author, I want to add values of my own to a copy, so that one bearer can have an option no one else has.
31. As an author, I want to remove a blueprint value from a copy, so that one bearer never rolls an option that does not fit it.
32. As an author, I want values the blueprint adds later to reach every copy, so that copies do not drift.
33. As an author, I want a copy to keep its blueprint's value ids, so that a pin that names a value still finds it after I reword it.
34. As an author, I want a copy always named after its blueprint, as Albus.Class Garb, so that I can tell where it comes from.
35. As an author, I want one copy per blueprint per owner, so that "the bearer's Class Garb" is never ambiguous.

### Pins by blueprint

36. As an author, I want a trait to pin a blueprint placeholder, so that one pin reaches every bearer's own copy.
37. As an author, I want the pin value picked from the blueprint's values, so that I set it once on the original.
38. As an author, I want a link to override its pins list, so that one bearer can pin a different value.
39. As a player, I want a cast entity's pin to change only that entity's copy, so that Albus's class never changes my description.

### Blueprint chips

40. As an author, I want blueprint chips allowed in the text of any original trait, so that one Paladin description reads each bearer's own garb.
41. As an author, I want blueprint chips allowed in blueprint and copy values, so that blueprints can compose.
42. As an author, I want every other field to refuse a blueprint chip, so that a blueprint never resolves without a bearer.
43. As an author, I want the refusal to hold for typing, paste, palette drag, search and replace, and import, so that no path gets around it.
44. As an author, I want a blueprint chip to show a link glyph, so that I can tell it from a normal chip.
45. As an author, I want an original trait's Preview to read the blueprint's own values, so that I see sensible text without picking a bearer.
46. As an author, I want the Test Bench lens to resolve blueprint chips for a real bearer, so that I can check each bearer's text.

### Custom Persona

47. As an author, I want Custom Persona to be an entity with a mark, so that it owns traits, links and copies like any entity.
48. As an author, I want to name that entity myself, so that it fits my world.
49. As an author, I want at most one Custom Persona per world, so that the player slot is never ambiguous.
50. As an author, I want a duplicate of the marked entity to drop the mark, so that the one-per-world rule holds.
51. As an author, I want the Custom Persona entity kept at root and ordered by me, so that its slot is easy to find.
52. As an author, I want the Custom Persona entity always listed as a bearer in the Traits and Placeholders tabs, so that I can drag and link to it.
53. As an author, I want the Custom Persona mark to exclude the Persona and Persona-only marks and imply persona-only, so that it never joins the cast.
54. As an author, I want its traits to apply only when the player picks None's replacement or a library persona, so that world personas keep their own traits.
55. As a player, I want the Custom Persona entity in place of None at Enter World, so that I create my character through it.
56. As a player, I want my entered name to replace the entity's name, so that the story calls me by my name.
57. As a player, I want my written description to follow the author's, so that the author's setup and my own details both reach the AI.
58. As a player, I want the persona I pick to show in the Custom Persona's slot, so that my character is always where the author placed it.
59. As a player, I want the picked world persona removed from its own group while I play it, so that it shows once.
60. As a player, I want a library persona's own copies to win over the Custom Persona's copies, so that my imported persona keeps its identity.
61. As a player, I want the Custom Persona's copies to fill in where my library persona has none, so that the author's blueprints still read.
62. As an author, I want a world without a Custom Persona entity to keep None as today, so that simple worlds stay simple.
63. As a player in such a world, I want a blueprint chip to read the blueprint itself under None, so that the text still reads.
64. As an author, I want removing the mark to keep the entity's links, traits and copies, with a confirmation that names the counts, so that I know what changes.
65. As an author, I want deleting the entity to confirm and name the counts it removes, so that I don't lose work by accident.

### Travel and import

66. As an author, I want an entity card to carry the blueprints its copies reach, so that the copies keep their origin in another world.
67. As an author, I want a copy imported into a world without its blueprint to become a plain owned placeholder, with the card's pins rebound to it, so that its values and pins survive.
68. As an author, I want a link's overrides to travel with the link, so that a library persona keeps its customizations.

### Test Bench

69. As an author, I want a warning when a copy removes the value a pin names, so that I don't ship a pin that lays nothing.
70. As an author, I want a warning when a blueprint chip sits in a field that refuses it, so that a chip that got through is caught.
71. As an author, I want a note when an edited copy has no trait or chip that uses it, so that I can decide whether to keep it.
72. As an author, I want a warning when a bearer pins a blueprint it holds no copy of, so that a missing copy is found before play.

## Implementation Decisions

### Shared blueprint shape (Q28)

- One generic shape for every blueprint-origin record: a `blueprintId` and a sparse override map. Absent key = read the blueprint live. Trait links and placeholder copies use it now. Entity-owned stats reuse it later with no second design.
- The trait link's existing per-link default-on becomes an override in this map. Q57's rule (absent reads the original live) is the general rule.
- Each override stores the blueprint value it was made against, so the stale check is a comparison. The snapshot is part of the record and exports with it.

### Blueprints module (new, main seam)

- A pure module with two jobs:
  - **Effective record:** blueprint plus overrides gives the record a reader sees. It also reports which fields are overridden and which overrides are stale.
  - **Copy lookup:** given a bearer and a blueprint id, return the placeholder that bearer reads. Chain: the bearer's own copy; for a library persona or the player under None, the Custom Persona entity's copy; then the blueprint itself (Q9, Q10).
- Traits, placeholders, the Test Bench and later stats read blueprints only through it.

### Trait links

- Overridable fields: default-on, requirements (whole list), pins (whole list), Player Can Toggle, stat changes (whole list) (Q2, Q26, Q34). Name and both descriptions are fixed (Q26 amended, Q29).
- A linked group's structure is never overridden. Overrides are keyed by original trait id (Q3).
- Selecting a link edits overrides. **Edit Blueprint** selects the original. This replaces "Edits change every link."
- The persona switch applies and reverses the link's effective stat changes, never the original's.
- Detach, and a drag of an original onto an entity, rewrite each blueprint chip and blueprint pin to the entity's copy and create missing copies (Q17). This settles the cross-owner drag trait-links ticket 02 left open: it is a move that rewrites.
- Stale marker: a field whose override predates a blueprint change shows "Blueprint changed" on Details, beside its Reset (Q4). The module compares the stored snapshot with the blueprint's current value.

### Placeholder blueprints

- The Placeholders tab gains an optional Blueprints system group at root, at most one, from the + menu. World placeholders only, no entity owner nodes inside (Q21).
- A drag of a blueprint out of Blueprints is refused while trait text, blueprint values or copies use it. The refusal reuses the inline notice of the stat-effects refusal and names the uses (Q22).
- A copy is an entity-owned placeholder with `blueprintId`. Its name is always the blueprint's; one copy per blueprint per owner (Q23).
- Copy overrides are per value: text and weight per value id, removal per value id, plus values of the copy's own. Blueprint values added later appear in every copy. This follows the shared-row weight overlay already in the placeholder tree (Q6, Q30).
- Copies keep the blueprint's value ids. A pin by value id resolves against the copy; a removed value resolves to nothing and the Bench warns (story 69).
- **Automatic copies (Q5, Q15, Q36):** these events create the bearer's copy, and copies of every blueprint its values reach:
  - adding, linking or moving a trait that pins or places a blueprint;
  - adding a blueprint chip or pin to an original that already has bearers;
  - marking an entity Persona or Custom Persona while root traits pin or place blueprints.
  - A root trait creates copies on every Persona-marked entity and on the Custom Persona entity.
- **Cleanup (Q14, Q31):** a copy is in use while any trait pins or places its blueprint on that bearer, or any chip in that owner's own text points at the copy. When the last use leaves, an untouched copy is removed. An edited copy stays.

### Pins and resolution

- A trait pin targets a blueprint placeholder by id. The pin collector resolves it through the copy lookup for the bearer in context. The bearer context rules of trait-links (Q75, Q79) are unchanged.
- `PlaceholderPin.bearerPlaceholder` and per-link pin values keyed by name are removed. Q38, Q40, Q51 and Q76 of trait-links are replaced.
- The placeholder resolver takes the copy lookup through the same bearer context, so a blueprint chip in trait text resolves to the bearer's copy.

### Blueprint chips

- One predicate, `acceptsBlueprintChips(field)`, decides every field. True for the text of any original trait (root or Blueprints), blueprint values and copy values (Q8, Q24). False everywhere else.
- Every insert path reads it: the `{` typeahead, paste, palette drag, search and replace, and card, lorebook and dictionary import.
- A blueprint chip carries the link glyph (Q19). New visual pattern: design-system showcase entry and user approval before adoption.
- An original's Preview and Values tabs read the blueprint itself (Q18).

### Custom Persona entity

- The Custom Persona system node is removed. An entity gains an optional Custom Persona mark. At most one per world, root only, author-ordered (Q7, Q12, Q13). Duplicate drops the mark (Q35).
- The mark excludes Persona and Persona-only and implies persona-only. It is the fourth segment of the Persona control (Q16, Q41).
- Bearer resolution: the marked entity's tree is the player's tree under create-your-own and under a library persona, beside the root traits. A world persona's tree is its own.
- Enter World lists the marked entity in None's place. The picked persona renders at the marked entity's tree position and leaves its own group.
- Create-your-own: the player's name replaces the entity's name; the player's description follows the entity's (Q11).
- A world without a marked entity keeps None as today (Q9).
- Unmark keeps links, traits and copies on an ordinary entity. Delete removes them. Both confirm with counts (Q20).
- The save keys the Custom Persona bearer by the marked entity; this replaces the player's world key that the system node used.

### Export shape

All changes are unreleased (trait-links is not an ancestor of `v3.0.1`), so no compat or migration code is written. Each ticket that changes a shape states it in its response.

- Added: `blueprintId` and override maps on trait links and placeholders, each override with its blueprint snapshot; per-value removals on copies; the placeholder Blueprints group; the Custom Persona entity mark; cards carry the blueprints their copies reach (Q25).
- Removed: the Custom Persona system node; `bearerPlaceholder` on pins; per-link pin values keyed by name.
- Changed: the save's Custom Persona bearer key. The save's None persona ref gains optional `name` and `description` (Q79). The trait Templates group is stored as Blueprints (Q33).
- Import binds a copy's blueprint by id, then by unique name. With no match the copy becomes a plain owned placeholder with its resolved values, and every pin on the card that named the blueprint is rewritten to that placeholder, the same rewrite Detach uses (Q25, Q32).

## Testing Decisions

- A good test drives a public seam with a small world and asserts what the author or player sees: a bearer's effective trait, the text a chip resolves to, which copies exist, what a round-trip keeps. No private helpers, no internal order.
- **Blueprints module (main seam).** Table-driven: untouched link reads live; one override; reset; stale detection against the snapshot; copy with a reworded value, a new own value, a weight override, a removed value, and a blueprint value added later; copy lookup for a world persona, a library persona with and without its own copy, the Custom Persona entity, and None with no marked entity.
- **Bearer resolution.** Extend its cases: the Custom Persona entity under create-your-own and under a library persona; a world persona beside it; the marked entity out of the cast; effective linked traits with overrides; the persona switch reversing an overridden stat change.
- **Pin collector and resolver.** A blueprint pin on two bearers with different copies; a cast entity's pin absent from the player's text; a blueprint chip in trait text per bearer; nested blueprint chips; a pin naming a value the copy removed; None with no marked entity reading the blueprint.
- **World transforms.** Automatic copy creation on each trigger, nested copies, root-trait copies on every persona, copies on marking, cleanup of untouched copies only and never while a chip uses one, Detach rewrite, the duplicate that drops the mark, and the refused move out of Blueprints.
- **Field predicate.** Every insert path refuses a blueprint chip in a normal field.
- **Round-trips.** Cards carrying blueprints, import with and without the blueprint including the pin rewrite, link overrides with snapshots, the new save key.
- **Test Bench.** New rules with the existing pin rules as prior art. Two adjustments landed with ticket 01: the entity-nowhere rule skips the marked entity, which stands in no location, and the lens reads the marked entity's tree as part of the None player so its linked classes stay PC choices.
- **UI wiring only.** Component tests for Reset, Reset to Blueprint, the stale marker, Edit Blueprint and the Custom Persona mark switch. Logic stays in the pure modules.
- Every guard is proven to fail with its rule removed (test-bar skill).

## Out of Scope

- Entity-owned stats and stat blueprints. The shared shape is ready for them.
- Overriding a trait link's name or descriptions.
- Overriding a linked group's structure.
- Per-item overrides of requirement, pin and stat-change lists.
- Renaming a placeholder copy.
- A bearer picker on an original's Preview.
- World text that reads the played persona's copy. An opening about the player needs an entity opening read as the selected persona. Separate effort (Q74).

## Further Notes

- **Origin:** discussed and grilled on 2026-09-28. Bearer-relative pins made a World placeholder read per bearer, which breaks the documented World behavior. Reviewed the same day; the review's findings are Q30–Q36.
- **Amends trait-links:** Q23, Q38, Q40, Q51, Q52 (Player Can Toggle is now overridable), Q57 (generalized), Q66–Q69 and Q83 (Custom Persona node becomes an entity), Q76, and the Out of Scope line on link overrides. The editing model "Edits change every link" is replaced. The trait Templates group is renamed Blueprints (Q33). Ticket 02's open question on cross-owner drags is settled (Q17).
- **Emberwatch during rollout:** ticket 01 converted its Custom Persona node to a marked entity. Ticket 05 (Q68, Q74) put Class Garb and Heritage in a placeholder Blueprints group, turned Hesk's and Corvin's hand-made placeholders into copies in place (each value a text override on the value their class or race pins), gave Wanderer, Albus, Sylvie and the Custom Persona entity their copies with the personas' description chips rewritten to them, reworded the two openings without the garb chip, and reworded the readme's Blueprint pins and Custom Persona bullets. The Bench's two unused-placeholder rules read a blueprint as placed wherever a copy of it is and never list a copy. Ticket 07 makes the resolver read the copies.
- **Rollout (Q27):** the trait-links review is paused. This spec reworks that code first, and the user reviews the combined result once.
- **Glossary (Q33):** "template" stays on the *Avoid* lists of Placeholder and Original in CONTEXT.md, and Template stays the Tool Handler kind. This effort adds **Blueprint** (a world trait or placeholder that exists to be linked or copied) and **Copy** (an entity-owned placeholder that reads a Blueprint live until edited). An Original is a Blueprint trait.
- **Rulings, by grill number:**

  | # | Ruling |
  |---|---|
  | Q1 | One new Blueprints spec; it amends trait-links explicitly. |
  | Q2 | Link requirements and pins override as a whole list. |
  | Q3 | A linked group's structure stays live; Detach covers structure. |
  | Q4 | A stale override shows a "Blueprint changed" marker on Details only. |
  | Q5 | Copies are created automatically, with nested copies. |
  | Q6 | Copy overrides are per value: text, weight, own values; blueprint additions arrive. |
  | Q7 | Custom Persona is an entity with a mark. |
  | Q8 | Any original trait (root or Blueprints) holds blueprint chips and pins by blueprint. |
  | Q9 | No marked entity: None as today; blueprint chips read the blueprint. |
  | Q10 | Library persona's copy wins, then Custom Persona's, then the blueprint. |
  | Q11 | Player name replaces the entity's name; player description follows the author's. |
  | Q12 | Custom Persona entity is root only, author-ordered. |
  | Q13 | Mark label: Custom Persona. |
  | Q14 | Untouched copies are removed with their last use; edited copies stay. |
  | Q15 | A root trait creates copies on every Persona entity and the Custom Persona entity. |
  | Q16 | The mark excludes Persona and Persona-only and implies persona-only. |
  | Q17 | Detach and drag-to-entity rewrite blueprint chips and pins to the entity's copy. |
  | Q18 | An original's Preview reads the blueprint's own values. |
  | Q19 | Blueprint chips carry the link glyph, pending design approval. |
  | Q20 | Unmark keeps, delete removes; both confirm with counts. |
  | Q21 | Placeholder Blueprints mirrors the trait Blueprints group. |
  | Q22 | Moving a used blueprint out of Blueprints is refused with a notice naming the uses. |
  | Q23 | A copy's name is always the blueprint's; one copy per blueprint per owner. |
  | Q24 | Blueprint chips go in blueprint and copy values, never in world or owned values. |
  | Q25 | Cards carry reached blueprints; without the blueprint a copy imports as a plain owned placeholder. |
  | Q26 | Link overrides: default-on, requirements, pins, Player Can Toggle, stat changes. Name and descriptions fixed. |
  | Q27 | Pause the trait-links review; rework first, review once. |
  | Q28 | One generic blueprintId and override-map shape, ready for stats; each override keeps its blueprint snapshot. |
  | Q29 | Trait names stay fixed, matching Q23 for copies. |
  | Q30 | A copy can remove a blueprint value; a pin naming it lays nothing and the Bench warns. |
  | Q31 | A chip in the owner's own text counts as a use; cleanup waits for the last trait and chip. |
  | Q32 | Import without the blueprint rebinds the card's pins to the plain copy, by id. |
  | Q33 | The term is Blueprint; Template stays the Tool Handler kind; the trait group renames. |
  | Q34 | Stat changes override as a whole list, like requirements and pins. |
  | Q35 | Duplicating the Custom Persona entity drops the mark. |
  | Q36 | Marking an entity Persona or Custom Persona, and adding a chip or pin to a bearing original, create copies. |
  | Q37 | Ticket 01 removes the Custom Persona node and `bearerPlaceholder` from the types and every reader in one pass; no twin shapes live side by side. The node's UI goes with it; the mark switch, one-per-world rule and confirmations stay in 02; the pin editor's blueprint picker stays in 06. Emberwatch converts its node to a marked entity. |
  | Q38 | A trait link keeps `originalId`; it is the link's blueprint id. Overrides are keyed by original trait id, each field holding its value and blueprint snapshot. Placeholders gain `blueprintId`. |
  | Q39 | A pin by blueprint is a plain pin whose placeholder id is the blueprint's; no new pin field. The collector resolves it through the copy lookup. |
  | Q40 | Under the mark the marked entity is an ordinary entity bearer: the player under None and under a library persona, never in the cast, absent under a world persona. The root player bearer expands no node's links. A link on it that the root already offers is dropped, as a played persona's is today. Active state keys by the entity's id from 01 on; 08 owns the save-key tests and surfaces. |
  | Q41 | The mark is a fourth segment, Custom Persona, on the entity's Persona segmented control (Cast / Playable / Persona-Only / Custom Persona), World Editor Advanced only. Supersedes Q16's "switches hide": the control changed to segments in the meantime. While another entity holds the mark the segment is disabled with a hint naming that entity. |
  | Q42 | Root-only means the Traits tab tree. A drop of the marked node into a trait group is refused with the inline notice. Entities tab groups are editor folders and stay free. |
  | Q43 | Marking an entity that sits in a trait group clears its placement, so it moves to the end of the root. |
  | Q44 | Unmark counts links, owned traits and copies. Delete counts links, owned traits and owned placeholders. Groups are not counted. Delete confirms for the marked entity only; other entities keep today's delete. |
  | Q45 | Stat Availability (stat toggles) is read-only on a link, like name and descriptions. Q26's five fields are the whole list. |
  | Q46 | Reset to Blueprint on a subtree trait row drops that trait's overrides; on the link's own row, a trait link or the group row, it drops every override the link holds. |
  | Q47 | The linked group's panel keeps its per-trait default-on list as a shortcut, with a Reset on each overridden row. |
  | Q48 | The entity editor modal's Traits tab gets the full link editor without Edit Blueprint; its "Linked from" line names the original only. Ticket 03 owns the shared Reset and "Blueprint changed" component; 04 reuses it. |
  | Q49 | A trait pin counts as a use of a blueprint, beside trait-text chips, blueprint values and copies. |
  | Q50 | Removing the placeholder Blueprints group is refused with the same notice while any blueprint inside is in use; an unused group removes as today. |
  | Q51 | Folders are allowed inside Blueprints. Moving a folder out is refused when any blueprint in it is in use. |
  | Q52 | A copy stays in its owner's list: a drag to another owner, the world list or a folder is refused by the indicator with no notice; Duplicate is hidden on a copy. |
  | Q53 | Ticket 04 stores the group and the move refusals only. Insert-path refusal and per-bearer resolution are ticket 07's. |
  | Q54 | Moving a world placeholder into Blueprints is refused with the same notice while any chip or pin outside the allowed places names it: world or owned text, a location, a stat descriptor, a world or owned value. Otherwise it moves. |
  | Q55 | A removed blueprint value stays in the copy's list, dimmed and labeled Removed, with a Reset that restores it. |
  | Q56 | A copy's overridden value text and weight show "Blueprint changed" through 03's shared control. |
  | Q57 | Unmark and delete confirm only when something goes with the entity; an empty marked entity unmarks or deletes with no dialog, like a trait or placeholder today. |
  | Q58 | The empty marked entity shows as a bearer in Advanced only, like an empty Blueprints group. Basic cannot link or mark, so it hides it. |
  | Q59 | An edit that lands on the blueprint's value still makes an override. Reset is the one way back to live. |
  | Q60 | Every write takes a fresh snapshot, so editing a stale field clears "Blueprint changed". The marker means "the blueprint changed after your last edit". |
  | Q61 | A move out of Blueprints is also refused while the leaving placeholder's own values chip or pin a blueprint that stays; the notice says "its values use <blueprint>". Mirrors Q54 through Q24. |
  | Q62 | Copies leave every pin picker; a trait pins by blueprint. A pin already stored on a copy (Detach rewrite) still shows its row selected. |
  | Q63 | Pin pickers on locations, stat descriptors and world or owned values hide blueprints and copies. A blueprint's own Pins section offers only trait and blueprint- or copy-value sources. This is ticket 06's editor work, not 07's. |
  | Q64 | A pin that targets a copy offers the copy's effective values: blueprint values with the copy's rewording, removed ones left out, own values added. |
  | Q65 | The copy lookup function is named `lookupCopy`. |
  | Q66 | Drag-to-entity, both gestures: in Simple mode a world row dropped into an entity moves the original in as an owned trait with the rewrite (Advanced keeps linking, trait-links Q60); an owned trait moved between entities gets the rewrite too, since its chips and pins name the old owner's copies. |
  | Q67 | Copies come from one pure reconcile over the world, run after every editor write and at load before the dirty snapshot. A world that arrives without copies gets them on open and is not dirty. |
  | Q68 | Ticket 05 converts Emberwatch: adds the placeholder Blueprints group, moves Class Garb and Heritage in, and turns Hesk's and Corvin's hand-made placeholders into copies in place, keeping their ids so their chips still resolve; matching values become text overrides, others own values. |
  | Q69 | "Owner's own text" = the entity's fields, its owned traits' text and pins, its owned placeholders' values. "Untouched" = no value overrides and no own values. Every Persona-marked entity includes persona-only ones. A detached or moved owned trait whose pin names a copy is a use of it. |
  | Q70 | Each insert path refuses a blueprint chip in its own existing way: the typeahead hides the rows, the palette strip dims them, find/replace reuses its skipped line with a blueprint reason, paste drops the chip with a toast, import drops it and counts it in the summary toast. No single notice. |
  | Q71 | "Drop" removes the token; the text around it stays. The chip never becomes plain text. |
  | Q72 | "Text of any original trait" = every chip-bearing text field of every world trait and world trait group, root or under Blueprints. Entity-owned traits and groups refuse. |
  | Q73 | Ticket 07's import job is the predicate at adopt time. A card's copy values keep their blueprint chips; ticket 09 binds the ids. Lorebook and dictionary imports drop them. |
  | Q74 | Tabled, out of scope: world text reading the played persona's copy. The right shape is an entity opening read as the selected persona, a separate effort. Emberwatch's two openings lose their Class Garb chip for now; the readme drops the claim. |
  | Q75 | A copy's own value never pins its own blueprint: on that bearer the pin would land on the copy itself. Extends the self-pin rule. A value of a part a blueprint owns counts as blueprint-side, like the blueprint's own values. |
  | Q76 | The two unused-placeholder Bench rules read a blueprint as placed wherever a copy of it is chipped, and never list a copy: a copy exists because a trait needs it. |
  | Q77 | In Simple mode, a world row dropped into an entity is refused with a notice while any link points at it or at something in it. A move never leaves links pointing at an owned item. |
  | Q78 | Import leaves a card's owned trait and group text alone; ticket 05's rewrite turns their blueprint chips into copy chips. Import drops blueprint chips only from the entity's own fields, its non-copy placeholder values, and lorebook or dictionary entries. Paste into an owned trait field still refuses (Q72). A chip whose blueprint fails to bind on import (ticket 09) is dropped. |
  | Q79 | Create-your-own entry: the persona picker's None row becomes the marked entity's row (portrait, name, player description). Picking it shows Name and Description fields under the row, at Enter World and in the in-play Change Persona dialog. The save's persona ref carries the entered name and description. Player Name chips and the planner read the entered name. |
  | Q80 | Tree slot under a library persona: the persona's node sits at the marked entity's position and the marked entity's own node follows it directly, both marked You. Row-to-bearer mapping stays intact. |
  | Q81 | A save from the system-node era loads; its old Custom Persona pick is not held, nothing sits under the marked entity's key, and nothing migrates it. Ticket 08's "does not load" criterion reads this way. |
  | Q82 | The trait runtime treats every player entity bearer alike: the marked entity's linked stat traits apply at a new game and on a switch, and reverse on a persona change, keyed `<entity id>/<trait id>`. |
  | Q83 | The persona offer model carries the custom row; a None ref compares by its entered name and description, so Enter World remembers the entry and Change enables on a name change. |
  | Q84 | The marked entity's authored aliases stay when the player enters a name; they are the author's setup, like the description under Q11. Player names = the entered name, then the aliases. |
  | Q85 | A chip or pin at an unbound blueprint goes to the card's plain copy of it when the card holds one, and is dropped only when no copy exists. A chip in a now-plain copy's values at a blueprint that did bind is rewritten to the entity's copy of it, as Detach does. Refines Q32 and Q78. |
  | Q86 | Binding by name to another world's blueprint remaps each value override key and pin value id to the destination value with the same text, unique match; the rest are dropped. |
  | Q87 | A library persona's copies bind at play the way its links do: by id, then by unique name; no match reads as a plain placeholder. In scope for ticket 09. |
  | Q88 | The missing-copy rule reports every copy the reconcile says a bearer needs but lacks: pins, chips and nested reach. The finding says "needs a copy of X" and names the bearer and the source. Removing the reconcile makes it fire. |
  | Q89 | The refused-field rule reports blueprint pins in refused sources (a location, a stat band, a world or owned value) beside blueprint chips in refused fields. Both are the same "got through" case. |
  | Q90 | The unknown-value pin rule reads a copy's effective values; removed values belong to the new rule. |
