# 02: Mascot switch and the minimal chrome

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The player opens Formaquestion and sees the character beside a bare chat column.

- The help settings value gains the mascot switch (default on) and the rig, parsed through the mascot codec. The question carries the switch.
- With the switch on, the window renders the minimal chrome: the chat column from the window prototype branch (pill with drag grip, Clear and Close; conversation; ask field), with the frame, title bar, tabs and resize grip gone. The port takes the prototype's layout, not its mock data. Sources show as names in this ticket.
- The mascot piece stands left of the column at the base's aspect, scaled to the column's height, drawing the Idle composition. The pieces share one window box; the stored box is the column's. On mobile the sheet shows the column alone; the head comes in ticket 09.
- Turning the switch off or on with the window open swaps the chrome in place; the conversation carries over. Off is unchanged from today.
- The open and close motion plays as before.
- A temporary switch row on the General tab until the Mascot tab (ticket 07) takes it.

Spec: Q5, Q14, Q15, Q28; Implementation → Help settings, Window.

Recommended model rationale: a port from a prototype branch into the shipped window, where the box, the shielded layer and the mobile sheet all interact.

## Acceptance criteria

- [ ] With the mascot on, the window shows the column, the pill and the mascot piece drawing the Idle look; with it off, the window is today's.
- [ ] The switch swaps the chrome in place and keeps the conversation.
- [ ] The settings codec reads the switch and the rig, and a missing value reads as on with the default rig.
- [ ] Dragging by the pill moves both pieces; the stored box survives a remount.
- [ ] Playwright: the two pieces side by side, and the open motion with the mascot on.
- [ ] The four gates are green.
