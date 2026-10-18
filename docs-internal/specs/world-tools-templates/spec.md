# Spec: World Tools Templates

Status: done
Status note: Closed on 2026-10-17. Tickets 01–07 landed; the last landing is f6269a31f. Closed without gates.
Spec session: world-tools-templates — spec

## Problem Statement

Two gaps remain after World Tools landed.

**Try It does not fit a narrow editor.** The Tool editor shows Try It in a side column on wide screens. Below that, it stacks Try It under the form at one third of the height. In a narrow editor pane, Try It is too small to use, and the side column can be cramped even on a wide screen.

**Templates know only two timings.** A stat script's **Templates** menu has a Before the AI set and an After the AI set. At Game Start, During AI Output and When a Trait Switches all show the After set. Some of those templates do nothing there: **Hourly Change** and **Regen Toward Target** read `clock.deltaHours`, which is zero outside After the AI. A value-returning template in During AI Output replaces the sentence with a number. World Tool scripts have no Templates menu at all.

## Solution

**Try It collapses into a tab.** When the Tool editor is narrow, Try It leaves its side column and becomes a fourth tab, after Definition, Parameters and Handler. The trigger is the editor's own width, not the window's. Try It keeps its inputs and last result while another tab is open. When the editor widens again while Try It is the open tab, the editor returns to the last form tab and Try It goes back to its column. The fix applies to every Tool editor, in Settings and in the World Editor.

**Templates follow every timing.** Each template lists all the timings it works in. Each script box's menu shows the templates for its own timing, so a template that fits several timings shows in each of them. At Game Start, During AI Output and When a Trait Switches get their own templates. World Tool scripts get a Templates menu with their own set, written around `args`, for On Call, During AI Output and After the AI. Authors save, edit, export and import their own World Tool templates in the same dialog and the same pack file as stat templates.

## Rulings

Settled with the user on 2026-10-17 in the grill.

| # | Ruling |
|---|---|
| Q1 | Try It collapses on the Tool editor's own width, not the viewport width |
| Q2 | When narrow, Try It is a fourth tab on the Tool Fields strip |
| Q3 | A template lists every timing it works in. One template can show in several menus |
| Q4 | Templates cover stat scripts and World Tool scripts. Settings Tools get none |
| Q5 | Saved and imported templates carry the timings list too, not only built-ins |
| Q6 | World Tools get their own built-in set, written around `args`. No stat template is reused |
| Q7 | World Tool templates use the same Templates dialog, library and pack file |
| Q8 | When the editor widens with Try It open, the editor returns to the last form tab |
| Q9 | Clean shape only: pack version 2 writes `timings`. The library and v1 imports migrate. Backward compatibility with older apps is not a goal |
| Q10 | Each template carries a `kind`: Script or World Tool |
| Q11 | The template editor's Timing field is the existing multi-select, limited to the kind's timings |
| Q12 | The spec drafts the built-in sets below. The user reviews them before the build |
| Q13 | Try It stays mounted while its tab is hidden, so its inputs and result stay |
| S1 | Test Code uses the turn-start clock for every timing that reads the turn start. Settled in the spec session for ticket 02 |
| Q14 | A Parameter slot declares its type. Insert creates the Parameter on the Tool when the Tool has none of that name. Settled 2026-10-17 after tickets 01–04 |
| Q15 | World scripts get a Templates button with their own built-in set |
| Q16 | Fix the verified picker gaps: (A) entity and persona stat slots, (B) Owner trait rows in an entity stat's box, (C) the owner-route spec's Blueprint line. The Blueprint Variable menu itself is correct |
| Q17 | The follow-ups are tickets 05 onward in this spec |

## User Stories

### Try It

1. As an author, I want Try It to become a tab when the Tool editor is narrow, so that I can use it at full size.
2. As an author, I want the trigger to be the editor's width, so that Try It still fits when the World Editor shares a wide screen with other panes.
3. As an author, I want the Try It tab next to Definition, Parameters and Handler, so that it reads as one more part of the Tool.
4. As an author, I want my Try It inputs to stay when I switch to Handler and back, so that I can edit the script and run the same call again.
5. As an author, I want the last Try It result to stay when I switch tabs, so that I can compare it with the next run.
6. As an author, I want the editor to return to the form tab I last used when the editor widens, so that I do not land on a blank tab.
7. As an author, I want Try It back in its side column when the editor is wide, so that the wide layout does not change.
8. As a player editing a Settings Tool, I want the same collapse, so that the Settings editor also works in a narrow window.
9. As an author on mobile, I want the Try It tab to show its icon when labels hide, so that the strip matches the other tabs.

### Stat script templates

10. As an author, I want each script box's Templates menu to list the templates for that box's timing, so that I only see templates that work there.
11. As an author, I want At Game Start to have its own templates, so that I can set opening values without reading the clock.
12. As an author, I want During AI Output to have templates that rewrite sentences, so that I do not insert one that replaces narration with a number.
13. As an author, I want When a Trait Switches to have templates that read `trait`, so that I can react to one trait turning on or off.
14. As an author, I want Hourly Change and Regen Toward Target only in After the AI, so that I do not insert code that does nothing.
15. As an author, I want a formula template such as Weighted Blend in every timing where it works, so that I do not need a copy per timing.
16. As an author, I want a template's detail to name every timing it runs in, so that I know where else I can use it.

### World Tool templates

17. As an author, I want a Templates button on a World Tool's Script box, so that I can start from working code.
18. As an author, I want the menu to follow the Tool's timing, so that an On Call Tool offers reply-returning code and a During AI Output Tool offers sentence filters.
19. As an author, I want a template slot that picks one of my Tool's Parameters, so that the code reads the right `args` field.
20. As an author with no Parameters yet, I want the parameter slot to tell me to add one, so that I know why I cannot fill it.
21. As an author, I want the menu to update when I change the Tool's timing, so that it never shows the old timing's set.

### Saved templates and packs

22. As an author, I want to pick several timings when I save a template, so that one saved template serves each box it fits.
23. As an author, I want to save a World Tool template from a World Tool's menu, so that I can reuse my own Tool code.
24. As an author, I want my saved stat templates to keep working after the update, so that I lose nothing.
25. As an author, I want an old template pack to import, so that packs shared before the update still work.
26. As an author, I want one exported pack to hold both stat and World Tool templates, so that I share my library in one file.
27. As an author, I want a stat template never to show in a World Tool menu, and the reverse, so that I never insert code for the wrong surface.

## Implementation Decisions

### Try It collapse

- The Tool editor measures its own width with a resize observer and derives one `narrow` flag. CSS container queries alone cannot change the tab strip or the fallback tab (Q8).
- The narrow threshold is the width below which the form and the Try It column do not both fit. The ticket picks the number and checks it at real sizes through `verify-ui`.
- The tab type gains a Try It value. The strip shows the Try It tab only when narrow.
- One Try It instance renders in both layouts and is never unmounted on a tab switch (Q13). When narrow and another tab is open, it is hidden, not removed.
- The editor remembers the last form tab. When `narrow` turns false with Try It open, the editor switches to that tab (Q8). The open tab stays with the caller, as today.
- The full-screen toggle keeps its current wide-layout behavior.

### Template shape (export shape change)

- A template becomes a union on `kind`:

  ```ts
  type CodeTemplate =
    | { kind: 'script'; timings: ScriptTiming[]; id; name; description; code }
    | { kind: 'worldTool'; timings: ToolScriptTiming[]; id; name; description; code };
  ```

- `timings` is never empty.
- **Template pack version 1 → 2.** Version 2 writes `kind` and `timings` and no `timing`. Import reads both versions. A v1 entry becomes `kind: 'script'`, with `timings: ['before']` when its `timing` was `before`, and `['after']` otherwise (Q9).
- The template library in IndexedDB migrates the same way when it reads a stored row with no `kind`. The read is idempotent.
- Old apps are not a goal (Q9). An older app files v2 templates under After the AI.

### Menus

- The menu filter takes a kind and a timing and returns the templates whose `timings` include it. It replaces the two-way filter.
- A stat script box passes its own timing, not the Before/After fold. The Test Code clock keys on whether the timing reads the turn start, so Start, Output and Switch test with zero delta, as play runs them (S1). The fold has no readers left and goes.
- The World Tool Script box gets a Templates button. It passes `worldTool` and the Tool's current timing.
- The dialog's editor shows the existing multi-select for timings, with only the kind's timings, and defaults to the box it opened from (Q11). The kind is fixed by the box that opened the dialog.
- A template's detail lists every timing it runs in.
- Templates show on stat scripts, World Tool scripts and world scripts (Q15). Trait scripts get no Templates button.

### New slot type: Parameter

- `{{name:param}}` picks one of the Tool's Parameters and fills its quoted name, as `stat` fills a stat's name. With no Parameters, the field says to add one and blocks Insert.
- The slot exists only for `worldTool` templates.

### Built-in sets (draft for review, Q12)

Each line: name: what it does. Timings in brackets.

**Stat scripts, existing templates, new timings**

| Template | Timings |
|---|---|
| Weighted Blend, Inverse of Another Stat, Threshold Flag, Daypart Modifier, Bound From Another Stat, Bonus From Persona Trait, Penalty From Entity Trait | Before, After, Start, Switch |
| Timer, Random Per-Turn Roll | Before, After |
| Hourly Change, Regen Toward Target, Dice Roll With Consequences | After |
| Placeholder by Range, Trait by Threshold | Before, After, Start |
| Opening Turn Value | Before |

**Stat scripts, new**

- **Random Starting Value** [Start]: returns a whole number between two slots, inside the stat's range.
- **Start From Persona Trait** [Start]: returns one value when the persona has a trait on, and another when it does not.
- **Change When a Trait Switches** [Switch]: adds a signed amount when a named trait turns on.
- **Mirror a Trait** [Switch]: goes to Max when a named trait turns on, and to Min when it turns off.
- **Replace a Word** [Output]: replaces one word with another in each sentence.
- **Count a Word** [Output]: adds an amount to this stat each time a sentence holds a word.
- **Bold a Word Past a Threshold** [Output]: bolds a word in the narration while this stat passes a threshold.

**World Tool scripts, new**

- **Report a Stat** [On Call]: returns a stat's value to the AI.
- **Roll Dice** [On Call]: rolls a die with the sides the AI sent, with a slot default, and returns the roll.
- **Change a Stat** [On Call, After]: adds the amount the AI sent to a stat.
- **Move to Location** [On Call, After]: moves to the location the AI named.
- **Pass Time** [On Call, After]: advances the clock by the minutes the AI sent.
- **Discover an Entity** [On Call, After]: adds the entity the AI named to the turn.
- **Pin a Memory** [On Call, After]: pins the line the AI sent as a memory.
- **Add a Diary Line** [After]: adds the AI's line to the named entity's diary.
- **Highlight a Name** [Output]: bolds the name the AI sent in each later sentence.
- **Replace a Word** [Output]: replaces the word the AI sent with a slot word in each later sentence.

On Call templates return a short reply. Code follows the house style for built-ins: each reads its bounds from the stat it writes, and no example values a small model can copy appear in the descriptions.

### Follow-ups (Q14–Q17)

**Parameter slot creates its Parameter (Q14).** The slot is `{{name:param(<type>)=<default name>}}`, with a Parameter type the Tool editor knows. The picker lists the Tool's Parameters of that type, plus a row that creates one named after the default. Insert adds every missing Parameter to the draft with that name and type, then fills the code. A plain `{{name:param}}` keeps working and creates a text Parameter. The World Tool built-ins move to the typed form. With no Parameters, the slot no longer blocks Insert.

**World script templates (Q15).** A world script's box gets the Templates button. The template kind gains `worldScript`, with Script timings. Its set reads no `self` and returns nothing. A new `location` name slot picks one of the world's locations. Draft set, for review:

- **Opening Location** [Start]: moves the opening turn to a location.
- **Advance Time While a Trait Is On** [Before, After]: advances the clock while a trait is on.
- **Leave When a Stat Runs Out** [After]: moves to a location when a stat reaches its Min.
- **Placeholder by Daypart** [Before, Start]: pins a placeholder value during one part of the day.
- **Memory When a Trait Turns On** [Switch]: pins a memory line when a named trait turns on.
- **Diary Line When a Trait Turns On** [Switch]: adds a line to an entity's diary when a named trait turns on.
- **Replace a Word** [Output]: replaces one word with another in each sentence.
- **Entity Stat Follows a Global Stat** [Before, After]: sets an entity's stat to a global stat's value. Needs slot A.

**Entity and persona stat slots (Q16 A).** `stat(<entitySlot>)` lists the stats of the entity picked in that slot, as `trait(<entitySlot>)` does. `stat(persona)` lists each persona entity's stats. They fill `entities[<entity>].stats[<stat>]` and `persona.stats[<stat>]`. A tied stat slot clears when its entity slot changes. They work in every kind.

**Owner trait rows (Q16 B).** In an entity stat's box, an untied `trait` slot lists that entity's traits first, under an Owner trail, then the world's. An Owner pick fills through `owner.traits`, the way an Owner stat pick fills through `owner.stats`. A Blueprint stat's box gets no Owner trait rows: the stat Blueprints group holds stats only, and listing every bearer's traits is the union the owner-route ruling forbids.

**Owner-route spec line (Q16 C).** That spec's ticket 04 ruling says a Blueprint box's Owner group lists "stats, and its traits and placeholders". Blueprints of each kind sit in their own system group, so the line changes to stats only, which is what the code does.

The `worldScript` kind and the `location` slot add values to the v2 pack shape. They do not change its version, since Q9 sets no older-app goal.

### Docs and glossary

- The Scripts guide's template section names the timings each menu shows and documents the World Tools Templates menu and the Parameter slot.
- CONTEXT.md gains **Template** (a code template; the current _Avoid_ entries refer to other meanings).

## Testing Decisions

- A good test drives a public seam and asserts what an author sees: the tabs on the strip, the menu entries, the code inserted, the imported library. It never asserts private state or call order.
- **ToolEditor render tests** with a stubbed resize observer width: narrow shows the Try It tab and hides the column; wide does the reverse; Try It inputs and result survive a tab switch; widening with Try It open lands on the last form tab. Prior art: the ToolsTab edit tests.
- **StatCodeTemplateDialog render tests:** each stat timing lists exactly the templates whose `timings` include it; a World Tool box lists only `worldTool` templates for its timing; the multi-select saves the picked timings; the Parameter slot lists the draft's Parameters and blocks Insert with none.
- **Pack and library migration** through `parseTemplatePack` and `listUserTemplates`: a v1 pack and a stored v1 row come back as `script` with the right one-item list; a v2 pack round-trips through export and import.
- **Every built-in runs clean:** each built-in, filled with its slot defaults against a test world, runs without error at each timing it lists and changes something: a value, a write, a sentence or a reply. It runs through the Test Code runner for stat templates and the Try It runner for World Tool templates. This test guards Q3: put Hourly Change back in Start and check that the test fails, since its value does not change.
- Each guard proves it bites: reinstate the bug and watch the test fail.
- Layout visuals and the threshold go through `verify-ui` at real sizes, not jsdom.

## Out of Scope

- Templates for Settings Tools and trait scripts.
- Owner trait rows in a Blueprint stat's box (Q16 B).
- Compatibility for older apps that read v2 packs.
- Moving existing template ids or renaming existing built-ins.

## Further Notes

- **Export shape change:** the template pack file goes to version 2 (`timing` → `timings`, new `kind`). World and save files do not change.
- The Parameter slot type (`param`) is a technical call made in this spec, not a grill ruling. The user reviews it with the built-in sets.
- The built-in sets above are drafts (Q12). The user's review edits them in place before tickets are cut.
