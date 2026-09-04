# Hierarchical Placeholders — UI/UX Spec

Status: ready-for-agent

Backend spec: `spec.md` (tickets 01–03, resolved). This spec covers the authoring and display
surfaces deferred from it.

## Problem Statement

The backend understands structured placeholders — chip-capable values, Objects vs Wildcards,
slot paths, drilled chips — but no surface lets an author create or see any of it. Values still
enter as plain strings, chips can only target a whole placeholder, and nothing in the editor
says whether a placeholder randomizes or holds.

## Solution

The existing placeholder surfaces learn the new model; no new screens.

- The manager gains a **kind selector** — Wildcard (randomizes: picks one value) | Object
  (holds: all values apply) — with Variable shown as a state when there is one value.
- The **values input becomes chip-capable**: a value that is a lone chip renders as the chip
  pill itself, which is the entire "child" affordance.
- The **`{` typeahead drills**: placeholders with children show a `›` affordance; ArrowRight or
  click drills in, ArrowLeft backs out; a "New placeholder…" row creates inline.
- The **chip popout** gains re-pick via a drill picker showing variants, slots, and a ⚠ marker
  on slots not present in every value.
- The **list** stays flat with a hide-referenced-parts filter and "used by N" hints.
- **Trait pin pickers** render chip-bearing values through the describe pass, so pinning a
  variant is just picking that value.

## User Stories

1. As a world author, I want a Wildcard | Object selector on each placeholder, so that I say what a thing is instead of configuring a behavior flag.
2. As a world author, I want new placeholders born as Wildcards, so that the flat workflow I know has zero extra steps.
3. As a world author, I want switching kind to be one click at any time, so that building an object is not a ceremony.
4. As a world author, I want a state line ("Picks one of 3 values" / "Shows all 3 values"), so that the current behavior is readable at a glance.
5. As a world author, I want legacy placeholders to display their inferred kind until I touch the selector, so that old worlds look right without migration.
6. As a world author, I want to add a chip as a value from the values input, so that a placeholder can hold another placeholder.
7. As a world author, I want a lone-chip value to render as the chip pill, so that structure is visible in the value list without new UI.
8. As a world author, I want chips inside string values, so that a value can read "Her hair is {Brown}".
9. As a world author, I want to drill in the { typeahead with ArrowRight/click and back out with ArrowLeft, so that placing Molly › Hair is keyboard-fast.
10. As a world author, I want the typeahead filter to keep working at every drill level, so that deep structures stay searchable.
11. As a world author, I want a "New placeholder…" row in the typeahead prefilled with what I typed, so that building Molly does not mean round-tripping to the list.
12. As a world author, I want inline create from the drill picker too, so that a missing part can be made where I notice it is missing.
13. As a world author, I want the drill picker to separate variants (explicit paths) from slots (routed through the roll), so that I know which kind of reference I am placing.
14. As a world author, I want a ⚠ marker on slots not present in every value, so that I see a future slot miss before placing it.
15. As a world author, I want the chip popout to offer re-pick alongside World/Unique, so that I can re-aim a placed chip without deleting it.
16. As a world author, I want path chips to read as the full path with › separators, so that Molly's Hair and root Hair never look alike.
17. As a world author, I want a filter that hides placeholders referenced by others, so that the list shows top-level concepts by default.
18. As a world author, I want "used by N" hints on referenced placeholders, so that I know what deleting one would touch.
19. As a world author, I want trait pin pickers to describe chip-bearing values, so that pinning the isAsian variant reads like what it does.
20. As a world author, I want the palette strip unchanged (roots only), so that the common insert flow stays familiar.
21. As a mobile author, I want drill and re-pick to work by tap, so that keyboard-only affordances have touch equivalents.

## Implementation Decisions

- **Kind selector** is a two-option ToggleGroup (value picker, not Tabs, per the segmented
  control rule) labeled Wildcard | Object. It writes the explicit flag; creation writes
  Wildcard. At one value the selector stays enabled (kinds coincide; declaring Object intent
  early is allowed) and the state line reads Variable. Copy follows the two-layer rule: the
  brief line decides, the ⓘ tip defines — Wildcard "randomizes: picks one of its values",
  Object "holds: all of its values apply".
- **Values input**: the existing keyword-chips tag input gains placeholder-chip capability, the
  same extension it already received for aliases. Lone-chip values render as the pill (full
  path, › separator); mixed values render text with embedded pills; double-click in-place edit
  keeps working so a chip value's drill and mode stay reachable.
- **Typeahead**: same component, drill state added. Rows for placeholders with children get a
  `›` affordance; ArrowRight/click drills, ArrowLeft backs out, filter resets per level.
  Bottom row "New placeholder…" prefilled from the filter; creating inserts the chip and adds a
  born-Wildcard placeholder to the world list.
- **Drill picker** (opened from the chip popout's re-pick, and used by inline create): sections
  "variants" (explicit path segments) and "slots — via whichever value rolls", ⚠ on partial
  slots, plain-value count noted as not addressable. Section labels use the kind nouns.
- **Chip popout**: existing World/Unique popout gains the re-pick row. No other changes.
- **List**: flat, one filter control to hide referenced-parts (a placeholder that appears as a
  lone-chip value of another), "used by N" hint per referenced row. Derivation comes from the
  backend's collection helpers — no second scanner.
- **Trait pins**: value lists in pin pickers render through the describe pass; no new pin
  mechanism.
- **Display**: in-field chips show full path names; read-only pills keep the existing display
  matrix (values, name in tooltip). Deleted mid-path targets reuse the red-? treatment.
- Kind nouns enter UI copy: Variable / Wildcard / Object, one term per thing, used verbatim
  everywhere including the Test Bench rule wording.

## Testing Decisions

- Component tests in jsdom at the existing seams: the manager's own test file for the kind
  selector, state line, and creation default; the panels/editor harness conventions for chip
  fields. Assert rendered behavior (what the author sees and what the world data becomes),
  never internal state.
- Radix/jsdom gotchas apply as documented: portals, pointer-capture stub, ToggleGroup
  clear-on-reclick guard (re-clicking the active kind must not clear it).
- Typeahead drill gets keyboard-path tests (ArrowRight/ArrowLeft/Enter) alongside the existing
  typeahead tests.
- Live verification through the dev-router to the Placeholders tab and a chip-capable field, at
  realistic viewport size, static-frame evidence; both themes if any colors are touched.
- Per the test bar: each guard proven by reinstating its bug once (e.g. creation writing no
  flag, filter hiding an unreferenced placeholder).

## Out of Scope

- Palette strip changes, drag changes, and any tree/nested list UI.
- Weights editor redesign (percentage reveal keeps working as-is over values).
- Quick fixes for the structured-placeholder Bench rules.
- Tutorial/onboarding popovers for the new kinds.
- Version bump and changelog finalization (user-managed; entries go to In Progress as slices
  land).

## Further Notes

- The prototype (`prototype.html`) demonstrates intended resolver-facing behavior; its picker is
  directional for the drill picker but the real one follows app components and the display
  matrix, not the prototype's styling.
- Ticket order: 04 (kind selector + chip values) unlocks 05 (list) and 08 (pins/display);
  06 (typeahead + inline create) unlocks 07 (popout re-pick/drill picker).
