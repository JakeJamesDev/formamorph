# 04 — Capture and remove the prototype

Status: ready-for-agent
Blocked by: 01, 02, 03

Per the prototype skill: commit the full prototype (all variants + switcher) to a throwaway
branch off main as the primary source, then strip from main:

- `src/components/ui/date-time-field.prototype.tsx`
- The DEV swap + `PrototypeSwitcher` mount + `onInteractOutside` guard in
  `src/components/menu/EventFormDialog.tsx` (restore the plain `DateTimeField` import)
- The `DateButton` entry in `eslint.aschild-forwardref.js`

Record the verdict (variant A won; wrap-around tried and rejected) in the throwaway branch's
commit body, and leave a pointer to that branch in `../spec.md` under a Comments heading.
