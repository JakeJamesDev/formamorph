# Stat Code v5: Every Turn, Before And After The AI

Status: ready-for-agent
Status note: Tickets 01–04 cut 2026-09-12 under `issues/`. Frontier at start: 01.

## Problem Statement

Stat code runs only on turns where the AI asks for a stat change, or in a world where some stat's code reads a clock variable. Every author asked assumed it runs every turn. A stat that should tick, decay, or react on a quiet turn does nothing, and the author cannot tell why. Code also runs at one point only, after the AI's changes land. An author who wants to set a stat, pin a placeholder, or switch a trait so the AI sees it on this turn has no place to put that code.

## Solution

Stat code runs on every turn, opening turn included, with no gate. Each stat gets two code boxes. The box labeled Before The AI runs at the start of the turn, before the prompt builds, so its writes shape what the AI sees. The box labeled After The AI is today's box: it runs after the AI's asks and regen land. An author uses either box, both, or neither by putting code in it. There are no switches.

## User Stories

1. As a world author, I want stat code to run on every turn, so that a stat ticks even when the AI reports no change.
2. As a world author, I want code to run on the opening turn, so that I can set up a stat before the first narration.
3. As a world author, I want code to run on a turn where the stat request is off or failed, so that my logic does not depend on the AI's answer.
4. As a world author, I want a box that runs before the AI, so that a value I set is in the prompt on the same turn.
5. As a world author, I want to pin a placeholder before the AI, so that the narration uses the pinned text on this turn, not the next one.
6. As a world author, I want to switch a trait before the AI, so that the trait's text is in the prompt on this turn.
7. As a world author, I want a box that runs after the AI, so that I can react to what the AI asked, as today.
8. As a world author, I want an empty box to mean "does not run", so that I do not manage a checkbox beside each one.
9. As a world author, I want the two boxes to share one surface, so that what I learned in one box holds in the other.
10. As a world author, I want `delta` in the before box to read zeros, so that the word keeps one meaning: this turn's changes.
11. As a world author, I want the Test Bench to warn when before-the-AI code reads `delta`, so that I learn it reads zeros before I ship.
12. As a world author, I want code bounds set in one box to stay in force when the other box does not touch them, so that a max set before the AI survives the after box.
13. As a world author, I want clearing both boxes to clear the stat's code bounds, so that removed code leaves nothing behind.
14. As a world author, I want two stacked editors on the stat's Code tab, labeled by timing, so that I see at a glance which boxes hold code.
15. As a world author, I want Test Code on each box, so that I test what that box does on its own.
16. As a world author, I want a template menu on each box that fits its timing, so that a regen template is not offered where regen has not happened.
17. As a world author, I want completions, diagnostics, and the rename offer to cover both boxes, so that a rename does not strand code in one of them.
18. As a world author, I want the Test Bench rules to cover both boxes and name the box in each report, so that I know where to look.
19. As a world author, I want a save to run the world's current before-the-AI code, so that a box I fill in the editor takes effect on the next turn of an existing save.
20. As a player, I want a stat the before box moves to show on the bar at once, so that the change is visible while the AI thinks.
21. As a player, I want a failed or stopped turn to put stats, pins, and traits back, so that half a turn leaves no trace.
22. As a player, I want a re-roll to replay the whole turn from where it started, so that a re-rolled turn is a fair second draw of the same turn.
23. As a player, I want undo to work as it does today, so that a turn with two code runs is still one step back.
24. As a world author, I want existing code to keep its meaning in the after box, so that a world I shipped does not need edits.
25. As a world author, I want the guide and the help to show both boxes and the turn order, so that I can see where each box sits.

## Implementation Decisions

**1. Every turn runs code.**

- The gate on AI asks and the clock-variable gate are removed, along with the clock-only run branch and the "runs only on turns the AI changed a stat" bench rule. The clock-variable detector that fed the gate goes with it unless another surface reads it.
- Both boxes run on the opening turn, on a turn where the stat request is off or failed, and on every re-roll.
- Regen still ticks once per turn, tied to time passing, after the AI's asks and before the after box. This is unchanged.

**2. Two boxes on the stat.**

- The stat gains one optional text field for the before-the-AI code. The existing code field is the after-the-AI box. Existing worlds keep their meaning without a migration. This is an additive change to the world export shape.
- The save-side refresh that reads a stat's code from the world by id reads the new field the same way.
- A box with only whitespace does not run.

**3. Turn order.**

- Last snapshot, before box, prompt and AI calls, AI asks, regen, after box, new snapshot.
- The before box runs on the turn's starting state. Its writes feed the prompt builders directly, so the prompt reads post-box stats, pins, and traits on the same turn. The same writes go to live state, so the bar and the panel show them at once.
- The after box runs where today's code runs, reading the asks, the regen, and the state the before box left.
- Each box runs in parallel across stats over one snapshot, as today. A stat's before box does not see another stat's before-box write on the same run.

**4. What the before box reads.**

- Same surface as the after box: `self`, `stats`, `previous`, `delta`, `placeholders`, `traits`, and the clock variables. One surface list, one drift guard.
- `delta.ai`, `delta.regen`, `delta.total`, and `delta.actual` all read zeros. `previous` equals `self`.
- The clock is the clock at turn start. There are no turn hours yet, so nothing in the before box reads elapsed time for this turn.
- A new Test Bench rule reports before-the-AI code that reads `delta`, as a warning: it reads zeros there.

**5. Code bounds across boxes.**

- Bounds persist. A box that writes none keeps the ones the stat has. A box that writes some lays them over the existing ones.
- The stat's code bounds clear only when both boxes are empty.

**6. Rollback.**

- A turn that does not commit, whether it failed or the player stopped it, restores stats, Code Pins, and traits from the last snapshot on the same path that discards the turn's unpaired message. The opening turn restores to the pre-game state it already records.
- Trait switches from the before box write the same turn log line as today. The log does not name the box.

**7. Re-roll.**

- Both re-rolls replay the whole turn from the last snapshot: before box, asks, regen, after box. Nothing about the before box's result is stored in the turn record.
- The stats-only re-roll therefore runs the before box again. Before-box code that uses randomness can land differently from the run the narration saw. That is accepted.

**8. Editor.**

- The Code tab shows two stacked editors, always visible, labeled Before The AI and After The AI, in turn order.
- Each editor has its own Test Code button and result area. Test Code on the before box runs it with `delta` at zeros; Test Code on the after box runs as today.
- Each editor has its own template menu. Templates carry a timing. The before menu offers setup templates: pin a placeholder, switch a trait, set a value on the opening turn. The after menu keeps the regen, clamp, and react-to-the-AI templates.
- Completions, the name checks, the reserved-name warnings, and the rename offer run over both boxes. The rename offer counts and rewrites references in both.
- Bench rules that read a stat's code read both boxes, and each finding names the box.
- The code-name drift guard, the surface drift guard, and the templates' own tests cover both boxes.

**9. Docs.**

- The guide and the in-app help show the turn order once and describe each box beside it.

## Testing Decisions

A good test drives a turn and reads what came out: the stats, the pins, the traits, the prompt, the log. It never reads the prelude text or an editor's internal state.

- **Primary seam: the per-turn run.** The turn module gains a timing. Given a stat with code in both boxes, assert the before run reads zeros for `delta` and `self` for `previous`, the after run reads the asks and regen, bounds set before survive an after box that writes none, and both empty clears them. Prior art: the per-turn tests beside the turn module.
- **Play seam.** A turn where the AI asks nothing still runs both boxes. The before box's pin is in that turn's prompt. A failed turn and a stopped turn restore stats, pins, and traits. Both re-rolls run the before box again. Prior art: the turn commit tests and the GameViewer stat-code tests.
- **Editor seam.** Two editors render with their labels; Test Code on each runs that box only; the before menu and the after menu list different templates; a rename rewrites references in both boxes. Prior art: the stat panel and Test Code tests.
- **Bench seam.** The `delta`-before-the-AI rule fires on the before box and not the after box; the unknown-stat rule reports each box by name; the never-ticks rule is gone. Prior art: the rules tests.
- **Save round trip.** A world with a before box loads into an existing save and runs it on the next turn. Prior art: the saved-stats refresh tests.
- **Live check.** The e2e stat-code spec gains one case where the before box pins a placeholder and the same turn's prompt carries the pinned text, and one case where a turn with no AI stat change moves a stat through the after box.

## Out of Scope

- A third timing, such as after regen but before the AI, or per AI call.
- Letting the before box read the previous turn's `delta`. The after box covers that.
- Storing the before box's result in the turn record for a deterministic re-roll.
- Running code on any event other than a turn.
- Any change to the sandbox surface beyond the zero reads in the before box.

## Further Notes

- **Export-shape reminder.** The stat gains one optional text field for the before-the-AI code. Additive, but a change to the world export shape, so it needs the user's version call.
- **Behavior change for shipped worlds.** Code that ran only on AI-change turns now runs every turn. The user has ruled this in: the workaround use was rare and the every-turn behavior is what authors assumed.
- The prompt builders read pins and traits through context today. Feeding the before box's writes into the prompt build directly, rather than through a state round trip, is the one piece of plumbing this spec relies on. The working-copy pipeline, where nothing commits until the turn does, was considered and set aside as three times the work for the same visible result.
