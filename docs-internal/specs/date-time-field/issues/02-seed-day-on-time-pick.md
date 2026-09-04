# 02 — Seed today's date when a time is picked with no day

Status: ready-for-agent
Blocked by: 01

With no day set, time-picker clicks currently vanish (`emit` refuses a half-value). Per spec:
picking a time with an empty day seeds today's date, so the click always lands visibly. Applies
to the popover picker and to typing in the time input; `dateOnly` fields are unaffected.
