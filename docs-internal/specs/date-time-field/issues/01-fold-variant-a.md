# 01 — Fold variant A into the real DateTimeField

Status: ready-for-agent

Rewrite `src/components/ui/date-time-field.tsx` to the winning design in `../spec.md`: dropdown
caption (themed Select, ±10y) and the clock-button time popover (columns, live commit, locale
12/24h). Written fresh under production standards — the prototype
(`src/components/ui/date-time-field.prototype.tsx`, variant A) is the visual reference, not a
source to copy-paste. Honor every note under "Hard-won implementation notes". `dateOnly` and
`readOnly` behavior unchanged (`readOnly` also blocks the time popover).
