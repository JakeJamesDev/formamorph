# 03 — Tests for the new picker

Status: ready-for-agent
Blocked by: 01, 02

Per the test-bar skill (mutation-proven guards, no scenario rigging). Cover at least:

- 12h/24h hour mapping (display hour ↔ stored hour, meridiem flip at 12 AM / 12 PM edges)
- Live commit: hour click, minute click, AM/PM click each write through; popover stays open
- Day-seeding from ticket 02 (time picked first → today + time emitted)
- Caption dropdown: year/month change navigates the shown month; range is current ±10
- Existing `date-time-field.test.tsx` contract cases still pass unchanged

Radix-in-jsdom gotchas are documented in memory (`radix-jsdom-testing`) and the existing test file.
