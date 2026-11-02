# Design System Text Roles

Status: needs-triage

The app copy sweep put text into the nearest typography role where no role fits. Each case below needs a Design System ruling: keep it, move it to another role, or add a role.

## Cases

| Case | Role today | Where |
|---|---|---|
| Empty-state sentences | `Meta` (`as="p"`) | `AiContextInstrument.tsx`, `OpeningInstrument.tsx` |
| Popover titles ("World Doctor", "History") and the lens bar's "Testing as" / "at" | `Meta` | World Editor instruments |
| A checkbox caption with its instruction | `Meta` | `PresetShareDialogs.tsx` |
| A quoted snippet in a log row | `Meta` | `AuditLogTab.tsx` |
| Send and save failures no field owns (feedback send, edit save, thread writes) | `FieldError` | Community and feedback dialogs |
| A download progress status line | `Hint` (`as="div"`) | `AiSetupGate.tsx` |

`Meta` is documented as "counts, timestamps, keyboard hints"; `FieldError` as "tied to the field above it".

## Also open

- The account site's `Field` puts its Hint under the input. The app's Field help order puts it above. The public site has its own design rules, so this needs a call.
