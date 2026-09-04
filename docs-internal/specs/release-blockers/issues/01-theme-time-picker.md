# 01 — Theme the time selection widget

Type: task
Status: done
Blocks: release

## Problem

The time selection widget is not properly themed. Raised as a release blocker 2026-08-22.

## Starting points

`DateTimeField` (`src/components/ui/date-time-field.tsx`) is half-converted: the **date** half is a
themed `DayPicker` in a Popover, but the **time** half is still a native `<input type="time">`
(`src/components/ui/date-time-field.tsx:138`), so the browser's own clock/spinner popup renders
unthemed — OS-styled in both light and dark, and it ignores the app's palette entirely.

The file's own header comment already calls out that the native `datetime-local` calendar was
replaced for exactly this reason; the time half never got the same treatment.

Consumers: `EventFormDialog` Starts/Ends fields
(`src/components/menu/EventFormDialog.tsx:309`, `src/components/menu/EventFormDialog.tsx:319`).

## Notes

- Existing coverage lives in `src/components/ui/date-time-field.test.tsx` — including an assertion
  that no `datetime-local` input survives. A time-half fix should get the twin assertion.
- Whatever replaces it has to keep `readOnly` working (the Starts field locks once an event has
  started) and keep the `${label} time` aria-label.
- UI change ⇒ both themes need verifying per the project's UI quality bar.

## Answer

Fixed by commit `4288c7d` "Rebuild The Date Field's Calendar And Clock" (before this ticket was
triaged). The native popup chrome is gone: the picker indicator is hidden
(`[&::-webkit-calendar-picker-indicator]:hidden`, rule confirmed applied in the live CSSOM) and a
themed `TimeColumns` clock in a Popover replaces it (`src/components/ui/date-time-field.tsx:329`).
The remaining `type="time"` input is a themed shadcn `Input` used only as the text field.

Verified 2026-08-23:

- **Tests**: 42/42 pass in `date-time-field.test.tsx` — in-app columns (12h + 24h locales),
  `readOnly` (disables clock button, closes open pickers), `${label} time` aria-label preserved.
  The ticket's "twin assertion" is covered by the clock-columns suite: the picker the user opens is
  asserted to be app-rendered buttons/radios, not browser chrome (indicator hiding itself is CSS,
  not assertable in jsdom).
- **Both themes**, via EventFormDialog in the live preview (computed styles, transitions flushed):
  dark — popover `rgb(29,32,37)` bg / `rgb(244,244,246)` text; light — `rgb(252,252,253)` bg /
  `rgb(26,29,35)` text. Input follows the same tokens in both.
