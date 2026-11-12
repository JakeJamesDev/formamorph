# Spec: Appearance Preview

Status: ready-for-agent
Spec session: appearance-preview — spec

Second of two specs from one grill. It builds on Avatar Pick Rules: the Preview opens the Avatar that spec's resolver gives a row.

## Problem Statement

An author sets a stat's or trait's sliders and colors as numbers and swatches in the Appearance tab. To see the result, the author must save the world, start a game, and reach the state that applies them. A wrong Change By or Set To value costs a full round trip.

The Avatar viewers have a revert button on color rows only. It is always enabled, even when there is nothing to revert, and sliders have none.

The themed color picker replaced the browser's own picker, which had an eyedropper. An author who wants a color from a reference image or from the Avatar itself now copies a hex code by hand.

A player choosing traits can't tell which ones change how the Avatar looks. Avatar Customization locks those controls afterward with "Set by Elf", which is the first the player hears of it.

## Solution

- **Preview.** The Appearance tab of a stat and of a trait has a Preview button. It opens the row's Avatar with the row's sliders and colors applied. The author changes sliders and colors there, on the Avatar, and Save writes them back to the stat or trait.
- **Undo.** Every slider and color in an Avatar viewer has an undo button in its label row. It returns the control to the value it started with, and it is disabled when the control already has that value.
- **Eyedropper.** The themed color picker has an eyedropper where the browser has one. One click picks a color from anywhere on the screen.
- **Avatar icon.** A trait or stat that changes the Avatar shows an Avatar icon where the player sees it. Hovering the icon names what it changes, not the values.

## User Stories

1. As a world author, I want a Preview button in a trait's Appearance tab, so that I see the trait's look without starting a game.
2. As a world author, I want the same Preview on a stat, so that I see what the stat does to the Avatar.
3. As a world author, I want the Preview to open the Avatar this row plays on, so that I see the right model.
4. As a world author whose world has several playable Avatars, I want to choose which one the Preview shows, so that I can check each.
5. As a world author, I want to drag a slider on the Avatar and have Save write it to the trait as its Set To value, so that I set a look by eye.
6. As a world author, I want to pick a color on the Avatar and have Save write it to the trait or stat, so that I match a color by eye.
7. As a world author, I want a stat's Preview to show the look at Max, so that a drag means "this is how it looks when the stat is full".
8. As a world author, I want a scrubber from Min to Max in a stat's Preview, so that I see the path the stat takes.
9. As a world author, I want a note that the stat's change adds to the player's own value, so that I'm not surprised by a player who starts higher.
10. As a world author, I want a slider or color I change in the Preview to become a new row on Save, so that I don't have to add it in the tab first.
11. As a world author, I want a control I never touched to add no row, so that Save writes only what I chose.
12. As a world author, I want Save to be one step in the editor's history, so that one Undo in the editor takes the whole Preview edit back.
13. As a world author, I want to be asked before I lose unsaved Preview changes, so that a stray close costs nothing.
14. As a world author, I want the Preview to show only this stat's or trait's changes, so that I see exactly what it does.
15. As a world author with no Avatar on the row, I want the Preview button disabled beside the hint, so that I know what to do first.
16. As a world author, I want an undo button on each control in the Preview, so that I can take back one change and keep the rest.
17. As a world author, I want that undo to return to the value the stat or trait already has, not to the model's own, so that I get back to where I started.
18. As a world author, I want the undo button disabled when there is nothing to undo, so that it tells me what I changed.
19. As a player in Avatar Customization, I want an undo button on every slider, so that I can put one slider back.
20. As a player, I want the undo buttons disabled on controls I haven't changed, so that I see at a glance what I changed.
21. As a Model Library user, I want the same undo rules in the model details panel, so that every Avatar viewer works one way.
22. As a player, I want a control a trait holds to have its undo disabled, so that a locked control offers nothing.
23. As a world author, I want an eyedropper in the color picker, so that I take a color from a reference image.
24. As a player on the desktop app, I want the same eyedropper in Avatar Customization, so that I can match my hair to my eyes.
25. As a user on a browser with no eyedropper, I want no dead button, so that the picker shows only what works.
26. As a user, I want Escape to cancel a pick and leave my color alone.
27. As a user, I want a picked color to be one undo step, as a typed hex is.
28. As a player choosing traits for a new game, I want an Avatar icon on traits that change my Avatar, so that I know before I check them.
29. As a player, I want the icon's hover text to name what changes, such as Ear Shape and Skin Color, so that I know which controls will lock.
30. As a player in a game, I want the same icon on the Traits tab and on stats, so that I know why my Avatar changed.
31. As a player with no Avatar, I want no icons, so that the lists carry no noise.
32. As a player, I want a long list of changes shortened to a few names and a count, so that the hover text stays small.

## Implementation Decisions

### Rulings

Q-numbers are from the grill of 2026-11-11. Q1–Q6 and Q19 belong to the Avatar Pick Rules spec.

- **Q7.** A drag in a stat's Preview sets the look at Max on an untouched Avatar. A scrubber shows the path from Min. Settled with a prototype (`.scratch/stat-preview-reading`).
- **Q8.** A control changed in the Preview that has no row adds a row on Save.
- **Q9.** Closing the Preview with unsaved changes asks to discard.
- **Q10.** The eyedropper button shows only where the browser has a native one.
- **Q11.** The Avatar icon shows on traits and on stats, in new-game trait selection and in play, only when an Avatar is in use.
- **Q12.** Slider and color rows count for the icon. A Body pick alone does not.
- **Q13.** With no Avatar, the Preview button is disabled beside the hint.
- **Q14.** The stat Preview has a note about the player's own value, and no control to test one.
- **Q15.** The Preview applies only the open stat's or trait's rows.
- **Q16.** The Preview shows the Avatar only, never an entity's 3D model.
- **Q17.** The hover text lists up to four names, then the rest as a count.
- **From the request.** Undo returns to the value the stat or trait already has. It is disabled at that value. The same rule holds in every Avatar viewer against its base value. Slider undo sits in the label row. The eyedropper mirrors the native one where that costs no performance.

### The Preview

- A Preview button sits at the top of the Appearance tab of a stat and of a trait. It opens a dialog that holds the Avatar viewer and the controls.
- The Avatar is the one the row resolves to under Avatar Pick Rules. When a world row resolves to several, the dialog offers a choice between them and opens on the first.
- The controls are the ones a row can hold: the Avatar's Body Sliders, Head Features, and its skin, eye and hair colors. Hair style, hair length and other colors are absent.
- The controls reuse the Avatar viewers' customization surface, so the sliders, the color rows and the undo buttons are the same components.
- With no Avatar the button is disabled. Where the tab already shows its hint for a row with no model, the button sits beside that hint. An entity with only a 3D model gets a short hint of its own that says to set an Avatar. A world row with no Avatar has no model, so it shows the existing hint.
- The viewer mounts only while the dialog is open.
- The dialog has a dev-route entry.

**Trait.** A slider shows its Set To value, or the model's own value when the trait has no row for it. A color shows its Set To color, or the model's own. A drag or a pick is the new Set To.

**Stat.** The rule from the prototype:

```
shown slider  = model's own value + progress × Change By
a drag writes   Change By = dragged value − model's own value
```

- `progress` is the scrubber's position from Min (0) to Max (1). The dialog opens at Max.
- A drag or a color pick moves the scrubber to Max first, so the control always edits the look at Max.
- A color shows the blend from the model's own color toward the Target Color at `progress`. A pick is the new Target Color.
- A Change By outside the slider's range shows the slider at its end with the number beside it. It changes only if the author drags it.
- One line of text says the change adds to the player's own value in play.
- A stat whose Max is not above its Min never changes the Avatar in play. Its Preview button is disabled with a hint to set a Max above Min.

**Save.**

- A row that exists keeps its place and takes the control's value.
- A control with no row adds a row only when the author changed it in the Preview.
- The Preview never removes a row. Rows are removed in the tab.
- Save writes the stat or trait once, as one step in the editor's history, and closes the dialog.
- Save is disabled when nothing is changed.
- Closing with changes asks to discard them.

### Undo in Avatar viewers

- Each slider and each color row has an undo button in its label row.
- The button returns the control to its base and is disabled when the control is at its base.
- The base in the Preview is the value the dialog opened with: the row's saved value, or the model's own where there is no row.
- The base in Avatar Customization and in the Model Library details panel is the model's own value. For a Body Slider, a Head Feature and Hair Length that is 0. For a color it is the model's color for the channel.
- The Other Colors row follows the same rule. Its base is the material's calculated color. Its undo is enabled only while the selected material has an applied color, and it removes that color.
- A control a trait holds has its undo disabled.
- The existing color revert becomes this button. Its always-enabled state goes.

### Eyedropper

- The themed color picker shows an eyedropper button when the browser has the native `EyeDropper` interface. It is absent elsewhere, with no fallback of our own.
- A pick goes through the picker's existing commit path: one change, one history step.
- A canceled pick changes nothing.
- The picker stays open through a pick.
- The picker keeps no game dependency. An Avatar viewer that wants a still target passes callbacks for pick start and pick end, and pauses its animation between them.
- No live magnifier and no hover preview of our own. The picked color is the pixel on screen, lighting included.

### Avatar icon

- One pure function reads a trait's or stat's slider and color rows and returns the names of what it changes: cleaned slider names in row order, then Skin Color, Eye Color and Hair Color.
- A cleaned slider name is the label Avatar Customization shows for that slider, from the same shared function. Names that clean to the same text show once.
- The hover text opens with one line that says it changes the Avatar's appearance, then the names. Past four names it gives the rest as a count. It never gives a value. The Writing Guide governs the words.
- The icon is the Avatar element icon.
- It shows on traits in new-game trait selection and on the Traits tab in play, and on stats in the Stats tab in play.
- It shows only when the owner's Avatar is in use: the played persona's for the player's traits and stats, the entity's own for an entity's.
- The World Editor's lists do not show it.

### Export shape

No world or save field changes. The Preview writes the row shapes that exist today.

## Testing Decisions

A good test here drives a control and reads what was written or shown. It does not assert internal state.

- **The Preview's draft logic** is a pure module: rows in, control values out, a drag or pick in, rows out on Save. Table tests cover a trait and a stat, an existing row and a new one, an untouched control, and a Change By outside the range. The prototype's walkthroughs are the cases.
- **The Preview dialog** is tested through the stat and trait editors with the viewer mocked, as the existing picker tests do: open, change, Save, and read the write. One test covers the discard question.
- **Undo** is tested through the customization surface: disabled at base, enabled after a change, back to base on click, disabled on a held control.
- **The eyedropper** is tested on the color picker with the browser interface stubbed: present and absent, a pick, a cancel.
- **The icon text** is a pure function with table tests: sliders only, colors only, both, more than four, a Body pick only.
- **The icon's placement** is tested in the trait selection and the play tabs: shown with an Avatar, hidden without.
- Each guard gets a mutation check.

## Out of Scope

- Previewing an entity's 3D model.
- Showing other stats' and traits' effects together in the Preview.
- A control to test a player's own slider value.
- An eyedropper on Android, Firefox or Safari.
- The icon in the World Editor's lists.
- Removing rows from inside the Preview.

## Further Notes

- The eyedropper is confirmed for desktop Chrome and Edge from MDN's compatibility data. Ticket 02 confirmed it in the desktop app (Electron 42.5, Chromium 148) on the `app://` scheme. It needs a secure context.
- Tickets for this spec start after Avatar Pick Rules tickets 04 and 05 land, because the Preview reads their lookup of the Avatars a row plays on. The eyedropper, the undo rules in the existing viewers, and the icon do not depend on it.
