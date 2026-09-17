# Color Picker Migration — Stub

Status: needs-triage
Status note: blocked until `docs-internal/specs/quote-color/spec.md` ships the shared picker
Spec session: Quoted text color settings

## Idea

Move the three surfaces that use the browser's native color input to the shared color picker, so every
color control in the app looks and behaves the same.

## Surfaces

| Surface | Note |
| --- | --- |
| Theme preview dialog | Token list with swatch and hex. Values are HSL triples, so the conversion helpers stay. |
| Contest event form | One color field. |
| VRM customization | Drives a live 3D material. Check the update rate while the player drags. |

## Open questions

- Does any surface need alpha or preset swatches? The shared picker has neither.
- Does the VRM surface need a throttled change handler?
