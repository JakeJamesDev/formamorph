# DateTimeField upgrade — themed time picker + month/year caption navigation

Status: ready-for-agent

Validated 2026-08-23 via the variant prototype in `src/components/ui/date-time-field.prototype.tsx`
(variant **A — Columns** won; the user iterated its visuals to the state described here). The
prototype is the visual reference until cleanup (ticket 04) parks it on a throwaway branch.

## Scope

`src/components/ui/DateTimeField` only. The value contract is unchanged (`YYYY-MM-DDTHH:mm`, or
`YYYY-MM-DD` under `dateOnly`) — **no export-shape change**. Consumers pick it up automatically:

- `EventFormDialog` (Starts/Ends, full datetime)
- `ChangelogEntryDialog` (`dateOnly`)

## Design decisions (settled by grilling + prototype)

| Decision | Verdict |
|---|---|
| Caption navigation | `captionLayout="dropdown"` — month + year dropdowns rendered with the app's `Select` via rdp's `components.Dropdown` slot; chevrons stay |
| Year range | Rolling, current year ±10 |
| Time picker | Keep the typeable native `type="time"` input (indicator hidden); themed clock button opens a popover |
| Popover contents | Hour \| minute columns; AM/PM rail only when the locale is 12-hour (`Intl` `hour12`) |
| Minute granularity | 5-minute steps in the column; typing stays exact |
| Commit model | Live — every click writes through; popover stays open; dismissed by clicking away |
| Wrap-around scroll | **Rejected** after trying it — plain end-stop scrolling |

## Visual spec (from prototype iteration)

- One borderless surface, calendar-like: no borders on the columns, hidden scrollbars
  (`scrollbar-width: none` + webkit), AM/PM ToggleGroup with `bg-transparent p-0`.
- Cells: 40×32 (`w-12` column with `px-1`, `h-8` cells), `gap-1` rows, `tabular-nums`.
- Unselected cells force `border-transparent` — the app's `ghost` Button variant is outlined by
  default and reads as noise in a grid.
- Columns open scrolled so the selected value is centered.

## Hard-won implementation notes (each cost a bug in the prototype)

- Time popover + calendar popover need `portal={false}` (`PopoverContent`) — the modal Dialog's
  scroll lock swallows wheel events on body-portaled content.
- Cells need `shrink-0`: the column is both flex container and scroll container, and without it
  cells compress (32px → 22px) instead of overflowing into scroll.
- The AM/PM ToggleGroup needs `h-auto flex-col items-stretch` — the shared root pins the
  horizontal control's `h-10`, which crushes a stacked pair.
- The rdp `Dropdown` slot receives `{options, value, onChange}` with a `<select>`-shaped event;
  map `Select.onValueChange` to `onChange({target:{value}})`.
- Any custom trigger under Radix `asChild` must `forwardRef` (repo lint rule enforces it).

## Open finding to fix during the fold (ticket 02)

With no day picked, `emit` drops time clicks silently (a time alone is not a moment — inherited
contract). In a visual picker that reads as broken. Decision: when a time is picked with no day
set, seed today's date.

## Comments

- **2026-08-23 — the prototype is on `prototype/date-time-field` (commit `e8357ad`), not on `main`.**
  Local, throwaway, never to be merged. It holds all three variants plus the switcher, the
  EventFormDialog DEV harness and the `DateButton` lint-allowlist entry, and its commit body carries the
  verdict: A won, wrap-around scroll built and rejected, why B and C lost.
- **2026-08-23 — one deviation from the notes above.** The `DateButton` forwardRef wrapper is gone: the
  shipped field keeps its trigger as a plain `<button>` element, which Radix's `asChild` slot handles
  without a forwarded ref, so the lint allowlist needed no entry at all.
- **2026-08-23 — `readOnly` is applied to `open`, not to `onOpenChange`.** Guarding what opens a popover
  is unreachable behind a disabled trigger (proven: the mutation survived every test), and it left a live
  picker up if a field turned read-only while one was open. `open={dateOpen && !readOnly}` bites.

## Done-bar

Four gates green, `graphify update .`, changelog 👤 entry, verify-ui on both consumers (both
themes), tests per `test-bar`. No version bump (user-managed).
