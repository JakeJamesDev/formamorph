# Spec: Help Code Insert

Status: ready-for-agent
Spec session: help-code-insert — spec

## Problem Statement

A player asks the help window how to write stat code. The answer works when the question is specific, but it comes back as prose or a one-line fix. The player wants a code block they can take whole. Today the fence in an answer has no copy control, and getting the code into a stat's **Before the AI** or **After the AI** box means selecting text by hand, switching to the World Editor, finding the stat, and pasting. Nothing in the help prompt asks the model for code, so most answers never offer a block at all.

## Solution

A code block in the help window is a snippet: syntax highlighted, with **Copy** and **Insert** controls. Insert opens a menu that names the open stat and offers its two boxes. Picking one writes the code into that box, switches the stat panel to its Code tab, and lands on the box with the Landing Pulse. A box that already has code raises the same replace confirm the stat-code templates use.

On a code question, or when a stat's Code tab is open, the help request carries a rider that asks the model for one fenced JavaScript block per box, each fence tagged with its slot. The tag preselects the Insert menu; an untagged block stays usable. A probe holds the rider to a fence rate and a runs-in-sandbox rate on the cloud default model.

## Rulings

| # | Ruling |
|---|---|
| Q1 | With no stat panel open, Insert shows disabled with a tooltip that says to open a stat's Code tab. Copy stays |
| Q2 | Insert is one button that opens a two-item menu: **Before the AI**, **After the AI** |
| Q3 | The prompt asks the model to tag each fence with its slot. The tag is a hint: it preselects the menu item and its absence changes nothing else |
| Q4 | Copy appears on every code block in the help window: AI answers and guide pages. Narration and every other renderer stay bare |
| Q5 | The code contract is a rider only. No always-on line in the base help prompt |
| Q6 | The rider fires when a stat's Code tab is the open surface, or when the question uses code words |
| Q7 | Probe bar on the cloud default model: fence present at 90% or more, snippet runs in the sandbox at 80% or more. Tag presence is reported, not gated |
| Q8 | The probe executes each snippet in the QuickJS stat-code sandbox against a fixture stat |
| Q9 | Insert is enabled while a stat panel is open, on any of its tabs. Inserting switches the panel to its Code tab |
| Q10 | The Insert menu names the target stat as its header |
| Q11 | Stat code only. The Settings tool script editor is out of scope |
| Q12 | Take Me There for a code answer with no stat open lands on the Stats list, as today |
| Q13 | The 800-token answer cap stays on rider turns. The probe reports how often a fence truncates |
| Q14 | A flagged answer (general knowledge, not from the guide) keeps Copy and Insert. Take Me There stays hidden on it as today |
| Q15 | The rider is an editable preset text with a reset, beside the answer and lookup texts |
| Q16 | The unclosed fence at the end of the Stat Code guide is fixed in this effort, as the first ticket, before the probe's control batch |
| Q17 | After Insert, the box shows the code landing through the Landing Pulse of the Take Me There targets effort: scroll, focus, one ring. The Insert ticket is blocked by that effort's tickets 02 and 07 |
| Q18 | The Take Me There targets effort (ticket 07) owns the registry entries for the two boxes. This effort consumes the names it declares |
| Q19 | Overwrite rule: insert into an empty box at once; a box with code raises the stat-code templates' replace confirm, same title and copy |
| Q20 | Code words match in code form, so an ordinary question never rides the rider: `code`, `script`, `scripts`, `JavaScript`, `before the AI`, `after the AI` as words; a sandbox global only when a `.` or `[` follows it (`stats.Health`, `self.value`); `return` only before a number or identifier; `function` only as `function(` or `=>` |
| Q21 | The Code tab trigger reads the surface hint, which exists only while Use the Open Screen is on. With it off, an open Code tab does not fire the rider; code words still do |
| Q22 | The rider is appended verbatim, with no chip rendering, to whatever user message the turn sends, in answer, lookup and bare modes alike |

## User Stories

1. As a player, I want a code answer to come as a fenced block, so that I can take the whole script instead of reading a fix out of prose.
2. As a player, I want the block syntax highlighted like the stat-code editor, so that it reads as code.
3. As a player, I want a Copy control on the block, so that one click puts the script on my clipboard.
4. As a player, I want an Insert control on the block, so that the script lands in a stat box without a trip through the clipboard.
5. As a player, I want Insert to offer Before the AI and After the AI, so that I choose where the script runs.
6. As a player, I want the menu to preselect the box the answer meant, so that the common case is one click.
7. As a player, I want the menu to name the stat it writes to, so that I never paste into the wrong stat.
8. As a player, I want Insert on each block in a two-block answer, so that both boxes get their script.
9. As a player, I want Insert disabled with a reason when no stat is open, so that I know what to open first.
10. As a player, I want Take Me There to open the Stats list when no stat is open, so that I can pick the stat and then insert.
11. As a player, I want the panel to switch to its Code tab and land on the box after Insert, so that I see where the code went.
12. As a player, I want a confirm before Insert overwrites a box that has code, so that I never lose a script by accident.
13. As a player, I want the confirm to read like the one the templates use, so that the two paths feel like one.
14. As a player, I want the inserted code to be a draft edit, so that Discard still throws it away.
15. As a player, I want Copy on code blocks in the guide pages too, so that the guide's examples are as easy to take as an answer's.
16. As a player, I want a general-knowledge answer's code to keep Copy and Insert, so that useful code is usable wherever it came from.
17. As a player on the mobile sheet, I want Insert to close the sheet the way Take Me There does, so that I see the box it wrote.
18. As a player asking from a stat's Code tab, I want a vague question to still get code, so that I don't have to say "code" to get a script.
19. As a player asking from anywhere, I want a question with code words to get code, so that the answer form follows my question.
20. As a player, I want ordinary help answers unchanged, so that the code contract costs nothing on a how-to question.
21. As a player, I want narration code fences unchanged, so that story text never grows controls.
22. As a world author, I want the rider text editable in my help preset with a reset, so that I can tune what the model writes.
23. As a world author, I want the answer cap unchanged, so that help stays as fast as today.
24. As a guide author, I want a failing check on an unclosed fence, so that a broken example never reaches the model again.
25. As a developer, I want the fence's info string to reach the renderer, so that the slot tag can preselect the menu.
26. As a developer, I want one bridge from the open stat panel to the help window, so that Insert has a single way to find the box.
27. As a developer, I want the bridge to use the box's own write path, so that undo, diagnostics and the draft behave as they do for typing.
28. As a developer, I want the probe to run each snippet in the real sandbox, so that code that looks right but throws is counted as a miss.
29. As a developer, I want a control arm without the rider in every probe batch, so that the cloud model's drift never reads as a prompt effect.
30. As a developer, I want the two box target names declared once, by the targets effort, so that landing and insert share them.

## Implementation Decisions

### Rendering

- The shared markdown renderer gains Streamdown's fence-meta remark plugin, so the info string after the language reaches a code block renderer as its meta. Our plugin list currently drops it.
- The help window's reader components, the map that already replaces links in answers and guide pages, gain a block-code renderer. It wraps the highlighted block in a toolbar with Copy and, for AI answers, Insert. Guide pages get Copy only. Streamdown's own controls stay off everywhere.
- The slot tag is the fence meta: `before` or `after` after the language. The renderer reads it to preselect the Insert menu. Any other meta, or none, leaves the menu with no preselection.
- Copy writes the block's text to the clipboard and shows the app's standard copied state.
- Insert is a dropdown menu. Its header is the open stat's name. Its items are the two slot labels, as the Code tab writes them. It is disabled with a tooltip when no stat panel is registered.
- Copy and Insert are small toolbar controls in the block's top right, following the Design System's existing icon-button pattern. No new visual pattern is introduced.

### Insert bridge

- A module-level single slot, like the docs opener: the stat panel registers `{ statName, insert(slot, code) }` while mounted and unregisters on unmount. A subscribe function lets the help window re-render when the registration changes.
- `insert` runs in the stat panel. It writes the slot's field through the panel's draft apply, the same path a keystroke takes, then switches the panel to its Code tab and requests a landing on the slot's registered target. The landing comes from the Take Me There targets effort's hook and target names (Q17, Q18).
- The replace confirm is raised by the bridge's consumer in the stat panel, reusing the templates dialog's confirm title and copy (Q19). The help window never shows editor dialogs itself.
- On the mobile sheet layout, a successful insert closes the sheet, as Take Me There does.

### Prompt

- The help preset gains a fourth text, `code`, with a default rider and a reset. The preset editor shows it beside the answer and lookup texts. The Default preset's text follows the code of this build like the others.
- The rider is appended to the user message on code turns only. A code turn is one where the surface hint's tabs include the stat Code tab, or the question matches a small list of code words (code, script, JavaScript, return, function, before the AI, after the AI, and the sandbox globals' names). The list lives beside the rider, not in the preset.
- The rider's contract, in positive form: give the full contents of each box as one fenced JavaScript block, tag the fence with its slot, name the box in one sentence before the block, keep the numbered steps short. No example code the model could parrot.
- The language is `javascript`, as the guide writes it, so the model's fences match the examples it reads.
- The token cap stays at 800 on rider turns (Q13).

### Docs

- The Stat Code guide's last fence is closed (Q16).
- The docs checks gain a check that every fence in every bundled page is closed. It fails, like the route check.

### Probe

- A new help-code probe in the baseline harness: a case set of stat-code questions with a fixture stat, plus prose-only how-to controls. Arms: `rider` and `control` (no rider), same question set, in-batch.
- Scoring is a pure function over an answer: fence present, fence closed, slot tag present per fence, snippet runs. A snippet runs when the stat-code executor evaluates it against the fixture stat without throwing and returns a number or nothing, within the sandbox's own interrupt timeout.
- The bar is Q7, on the cloud default model, 5 to 12 runs per arm as the test-target policy says. Results are recorded in the ticket with the model's `root` name from the endpoint.

## Testing Decisions

A good test calls the public seam with real inputs and asserts what the player sees or the request carries. It never reads internal fields or mirrors the formula.

- **Help answer render (existing seam).** Render an exchange whose answer holds a tagged fence, an untagged fence and a two-fence answer. Assert Copy and Insert are present on each block, Insert is disabled with no registration and enabled with one, the menu header names the stat, and the tag preselects a slot. A guide page's fence shows Copy only. Prior art: the Answer and Take Me There tests, the guide reader tests.
- **Stat panel harness (existing seam).** With a stat open, an insert writes the slot's field in the draft, switches the panel to the Code tab, and requests the landing. A box with code raises the replace confirm; confirming writes, canceling leaves the box. Unmounting the panel unregisters the bridge. Prior art: the StatManager and StatCodeBox tests, the templates dialog tests.
- **Help request composition (existing seam).** The rider rides a question with code words, rides any question with the stat Code tab open, and is absent otherwise. The cap is 800 on rider turns. A custom preset's rider text is used verbatim. Prior art: the helpSession prompt and surface tests.
- **Docs checks (existing seam).** A page with an unclosed fence fails the new check. Guards bite: reinstate the open fence in the Stat Code guide once and the check must go red.
- **Probe scoring (new pure seam).** Fixture answers score fence present, closed, tagged and runs; a throwing snippet scores not run. Prior art: the help-baseline scoring tests.

## Out of Scope

- Insert for the Settings tool script editor (Q11).
- Deep-linking Take Me There to a stat the answer names (Q12).
- An always-on code line in the base help prompt (Q5).
- A higher token cap on code turns (Q13).
- Registering the two box targets or building the landing hook: owned by `take-me-there-targets` (Q17, Q18).
- Answer parsing beyond the fence meta.
- Lookup mode changes.

## Further Notes

- Cross-spec dependency: the Insert ticket is blocked by `take-me-there-targets` tickets 02 (Landing Pulse) and 07 (World Editor panels). The renderer, docs, prompt and probe tickets have no dependency and can start now.
- Shared files with ticket 07: the stat code box and stat panel. Edits are disjoint (attributes vs registration), but a session on either ticket should check for the other.
- Known trap: our renderer passes its own remark plugin list, which drops Streamdown's fence-meta plugin; without it the slot tag never reaches a renderer. Overriding the block `code` component replaces Streamdown's highlighter, so the toolbar wraps the default block instead.
- Every prompt change ships with probe numbers. The control batch runs after the docs fix lands so the open fence does not skew it.
- Probe result (ticket 04, 2026-10-04, cloud `default`, root `/home/fiery/gemma_deploy/model`, 8 runs per arm): Q7 met. Rider arm fence 100%, runs 86%, tags 71% of fences, 0% truncated; control 3% and 3%. Prose controls 0% fenced on both arms. The shipped rider is a tuned v3g that names the sandbox objects (the ticket holds the tuning table). A comment-only fence scores as not run.
- Open: the model sometimes puts the slot word on its own line inside the block (6 of 64 rider answers). Insert would paste it into the box.
