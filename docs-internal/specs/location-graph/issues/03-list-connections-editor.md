# 03 — List-based Connections editor

**What to build:** Authors create and manage Connections from the existing Locations list UI, making the feature fully authorable before the canvas exists: on a location, add a Connection (pick target location, defaults two-way), toggle one-way/two-way, flip one-way orientation, edit the travel hint, delete. The end-to-end demo: author a one-way portal in the editor, enter the world, walk through it, and confirm the return trip is never offered.

**Blocked by:** 02 — Connection records and effective navigation.

Status: ready-for-human

- [x] Connections listed on each location's editor panel, showing the pair partner and direction at a glance
- [x] Add: target picker; new Connection defaults two-way
- [x] Edit: direction toggle, one-way orientation flip, hint field; delete
- [x] The UI word is "Connection" everywhere (never edge/path/route); title-case labels
- [x] Edits write through the standard editor path (authored world), never runtime state
- [x] A Connection renders identically from either end's panel (one record, two views)
- [x] Verified in the live preview via the dev-router with static evidence
- [x] Four gates green; changelog In-Progress entry appended

## Comments

**Direction is one control, not two.** The panel offers Two-Way / Outgoing / Incoming from the end being
edited, so toggling one-way and flipping its orientation are the same gesture rather than a toggle plus a
hidden swap button. `lib/connectionEditing` holds that translation as pure functions (`directionFrom`,
`withDirection`), which is also what makes the two panels agree: Outgoing at one end *is* Incoming at the
other, off the same record.

**A pair gets at most one Connection.** The target picker leaves out partners already connected — two
records for one pair would each claim to be that pair's whole travel rule.

**The one-way play half rides on ticket 02's tests** (`locationContext.test.ts` asymmetry cases and the
turnRunner fake-adapter router test); the editor evidence here is the mirrored panels in the live preview.
