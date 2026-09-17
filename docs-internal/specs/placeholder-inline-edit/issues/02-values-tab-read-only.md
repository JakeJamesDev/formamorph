# 02: Values Tab With Read-Only Open Values

Status: ready-for-human
Base: 1660dfe3
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Type: task
Spec: ../spec.md (Mechanism; Tabs, split, and mobile)

Model rationale: first use of Lexical named slots in the app, plus tab, split and swipe plumbing in a large component.

## What to build

A placeholder-capable prose field shows three tabs: **Edit | Values | Preview**. On Values the author reads
the field's text with every chip opened in place into the value the shared rolls store holds for it. Each
open value sits under a plain header that names the placeholder and the open value. Nothing is editable
inside a value yet, and the field's stored text never changes on this tab.

- The tab is the same chip editor with every chip in expanded mode. Each chip stays a decorator node and
  hosts its value in a Lexical named slot. The chip's text content stays its token, so the serializer and
  the stored token string do not change.
- The slot value is a shadow-root container so later tickets get line breaks for free.
- A chip inside a value renders as a chip, not as flat text.
- Values shares Preview's gates: present when the world has placeholders, enabled once the text holds a
  chip. When the gate closes under an active Values tab, the field lands on Edit.
- Split view lets Values take Edit's seat beside Preview, with the same shared scroll anchor.
- Mobile swipe order is Edit, Values, Preview, with three dots.
- Settings prompt fields and one-line name fields do not get the tab.
- The header in this ticket is plain inline chrome. Ticket 07 replaces its look.

The prototype beside the spec shows the slot mounting pattern: mount the slot container from a layout
effect and again from a mutation listener on the chip node. The documented slot-ref hook is not in the
0.50 package.

## Acceptance criteria

- [ ] The Values tab appears and enables under the same conditions as Preview.
- [ ] Removing the last chip while on Values lands the field on Edit.
- [ ] Every chip opens on the value Preview shows for it, and the text between chips is the field's text.
- [ ] Switching tabs never fires the field's change callback, and the stored text is identical after a round trip.
- [ ] A nested chip inside a value shows as a chip.
- [ ] Split view offers Values beside Preview; mobile shows three dots and swipes through all three.
- [ ] Settings prompt fields and name fields show no Values tab.
- [ ] Component tests cover gating, fallback to Edit, and "opens on the drawn value".
- [ ] Changelog In-Progress entry added. Four gates green.
