# 04: Auto Save

Status: ready-for-human
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the core of the effort; a timed scheduler that must not disturb the History recorder's Saved marker and merge rules.

Parent: [World Editor Auto Save spec](../spec.md)

## What to build

The World Editor saves on its own, by amount of change with an idle backstop.

- **Change meter.** A pure module measures each committed world change in units: one per character changed in text, 10 per discrete action (tag, toggle, option pick, image, add, remove, reorder). It reads the same committed changes the History recorder sees.
- **Scheduler.** A save fires when the count reaches 300, or when 30 s pass with a nonzero count. The count resets on every successful save, manual or auto. Nothing fires while a save runs or while paused. Time is a parameter so tests use fake timers.
- **Preference.** **Auto Save** is one app preference for all worlds, on by default, not stored in the world file. Its toggle is a checkbox row in the Save menu. Off means today's behavior.
- **Never-saved worlds** (Q10). A world that has never been saved by hand does not auto save. The first manual save opts it in.
- **History** (Q19). An auto save does not place or move the History Saved marker and does not seal a Step. A typed run that spans an auto save stays one Step.
- **Failure** (Q11). The first failed auto save shows today's failure toast, with Export World on a full disk. The face shows Failed (ticket 03). Auto save pauses until a manual save succeeds.
- **Status.** The face walks the ticket 03 states for auto saves too.
- **In-game editor** (Q13). The same rules apply in the in-game world editor.
- Check the comment in the main menu that assumes the store matches disk when the editor closes. Auto save changes when that holds.
- A new `DEFAULT_*` with a `VITE_DEFAULT_*` twin needs a reminder to the user about `.env.local`.

Rulings: Q1, Q2, Q6, Q7, Q10, Q11, Q12, Q13, Q19, Q22.

## Acceptance criteria

- [ ] 300 units of typing saves without a pause; 30 discrete actions save without a pause; one action saves after 30 s idle.
- [ ] A never-saved world does not auto save until its first manual save.
- [ ] An auto save leaves the History Saved marker where it was, and a typed run across it undoes in one press.
- [ ] A failed auto save toasts once, shows Failed, and pauses until a manual save succeeds.
- [ ] Auto Save off restores today's behavior.
- [ ] The in-game editor auto saves under the same rules.
- [ ] Each pause (saving, failure) is proven to bite by reinstating the bug.
- [ ] Changelog fragment written.
