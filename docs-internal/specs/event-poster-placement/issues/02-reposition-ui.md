# 02 — Reposition UI in the event form

Status: done
Blocked by: 01

The form's live band preview (`EventFormDialog`) becomes the crop surface.

- A **Reposition** toggle, visible only when an image is set, arms the preview band.
- Armed: pointer drag pans; wheel zooms (down = out); a slider with ± buttons sits with the band
  (avatar-parity affordances). `touch-action` suppressed on the band only while armed.
- Disarmed (default): the band is completely inert — no drag, no wheel capture, no scroll theft.
- Clamps live: cover floor (1×), 4× ceiling, pan clamped to slack mid-drag.
- Reset rules: picking a new image resets to centered (`null`); a Reset control recenters;
  clearing the image clears the placement.
- Draft: `posterPlacement` is sent independently of `imageChanged` — a placement-only edit works
  without resending the image; omitted = leave alone, `null` = clear, matching the image contract.

Tests (component, existing `EventFormDialog.test.tsx` seam): arm/disarm gating, drag/wheel/slider
writes, clamps hold, reset rules, draft payload shape on create and on placement-only edit.
Mutation-test the arming guard and each reset rule.
