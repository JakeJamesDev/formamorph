# 16: Location Picker Adds Group Starts

Status: ready-for-agent
Blocked by: 13
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The location editor's Entities picker still lists Groups only. Its add and remove now work on Starts, through ticket 13's helper.

- Adding a Group to this location adds a Start with no rows here.
- Removing it deletes every Start of that Group that begins here, with its rows. One undo step restores them.
- A Group whose only Start begins here can't be removed. The picker shows why.
- The read-only "who can be here" list gives a Group's lines per Start, with the same reasons an Individual gets: begins here, or stays, wanders or patrols here with the time. A Group has no chance and no "can be led here" line.

Spec rulings: Q139, Q97, Q111.

## Acceptance criteria

- [ ] Adding a Group in the picker gives it a Start with no rows at this location.
- [ ] Removing it deletes all its Starts that begin here and leaves its other Starts unchanged; undo restores them with their rows.
- [ ] The picker refuses to remove a Group's last Start and says why.
- [ ] The read-only list shows a Group that only patrols through this location, with the row's time.
- [ ] Component tests cover add, remove with rows, the last-Start refusal and the list lines.
- [ ] The Locations wiki page describes the picker for a Group.
