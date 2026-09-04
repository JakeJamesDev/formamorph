# Event poster placement — zoom/pan the banner artwork

Status: done
Grilled 2026-08-23; every decision below is settled with the user.

## Problem Statement

An organizer uploads artwork for an event's poster band and gets whatever `bg-cover bg-center`
happens to show. The band is variable-aspect — its height follows the title, the pill, and the
viewport — so the interesting part of the picture is routinely cropped away, and the organizer has
no way to say which part matters. The profile flow already solves this for avatars (zoom + drag
into the circle); events deserve the same control.

## Solution

The event form's live poster preview becomes the crop surface. A **Reposition** toggle arms the
band: drag to pan, wheel/slider/± to zoom, exactly the avatar dialog's affordances. Unlike the
avatar, nothing is baked — the original upload is kept and the chosen placement is stored on the
event as a small transform, so the focal point the organizer picked holds at every aspect the band
is ever rendered at. Every surface that shows the poster (ack modal, form preview) inherits the
placement automatically because they all render through the same band composer.

## User Stories

1. As an event organizer, I want to drag the poster artwork inside the live band preview, so that the part of the picture I care about is what players see.
2. As an event organizer, I want to zoom into a detail of the artwork, so that a small element can carry the whole band.
3. As an event organizer, I want the preview to be the exact render players get, so that there is nothing to discover after saving.
4. As an event organizer, I want a Reposition toggle that arms the drag, so that scrolling the form never moves my artwork by accident.
5. As an event organizer, I want the wheel, a slider, and ± buttons for zoom while armed, so that the controls match the profile-avatar muscle memory.
6. As an event organizer, I want the pan clamped so blank space can never show, so that I cannot accidentally ship a broken-looking band.
7. As an event organizer, I want picking a new image to reset the placement to centered, so that a placement chosen for one picture never mangles another.
8. As an event organizer, I want a Reset control, so that I can return to the centered default without re-picking the file.
9. As an event organizer, I want to adjust the placement later when editing the event without re-uploading the image, so that a bad crop is a ten-second fix.
10. As an event organizer, I want the placement to survive with no quality loss, so that the server keeps my original upload untouched.
11. As a player, I want the organizer's chosen framing on the ack-modal poster, so that the event looks the way its organizer intended.
12. As a player on mobile, I want the same focal point centered in the narrower, taller band, so that the subject is not cropped out on a small screen.
13. As a player, I want events without a chosen placement to render exactly as before (centered cover), so that nothing existing changes underneath me.
14. As a touch-device organizer, I want scrolling past the preview to keep working when it is not armed, so that the form stays usable on mobile.
15. As a server operator, I want the placement stored as one nullable field and validated on write, so that a hand-crafted request cannot store garbage that breaks rendering.
16. As a server operator, I want clearing the image to clear its placement, so that no orphaned transform lingers to misplace a future upload.

## Implementation Decisions

- **Placement is stored, never baked.** The original upload and its 2MB limit are unchanged. The
  event gains one nullable field, `posterPlacement: { zoom, x, y } | null`; `null` means today's
  centered cover. Server-side it is one nullable JSON column, validated (finite numbers, zoom
  within bounds, x/y within 0–1) on create and edit.
- **Aspect-independent encoding.** `x`/`y` are the focal point — the fraction of the source image
  (0–1 each) that sits at the band's center; `zoom` is a multiplier over the cover scale of
  whatever frame is rendering. Rendering at any aspect: scale = cover × zoom, position the focal
  point at center, clamp to the image's slack. This is what makes one stored value correct in the
  wide desktop band, the tall mobile band, and the form preview alike.
- **Rendering goes through the existing band composer.** `posterBand()` (the pure poster-style
  composer) grows placement awareness and hands the band component what it needs to position the
  artwork layer; the artwork stays a decorative background layer, not an `img` a screen reader
  stops on. All poster surfaces inherit with no per-surface work.
- **The crop math generalizes the avatar helpers.** `coverScale`/`clampCrop` in the avatar-crop
  module generalize from a square frame to a w×h rect; the avatar callers keep passing squares.
  No duplicated clamp logic.
- **Edit surface is a dedicated positioning dialog** (REVISED 2026-08-23, superseding the original
  armed-preview decision: a crop surface inside a scrolling modal selected the band's own text and
  scrolled the form mid-drag). Avatar parity: picking an image opens the dialog immediately; a
  Reposition button (visible only when an image is set) reopens it. Its body is the real band
  composed from the form's values; drag pans, wheel zooms (down = out), a slider with ± sits under
  it, Save commits and Cancel discards. The form's own preview is inert and shows only the
  committed framing.
- **Zoom bounds are the avatar contract**: cover is the floor (1×), 4× the ceiling, pan clamped to
  slack so empty space can never show.
- **Reset rules**: picking a different file resets to centered; a Reset control recenters on
  demand. Clearing the image clears the placement (client and server).
- **Draft semantics**: `posterPlacement` rides the draft independently of the image-changed flag —
  an edit that only nudges the placement sends it without resending the image. The server treats
  an omitted key as "leave alone", `null` as "clear to centered", matching the image's own
  omit/null contract.
- **No migration.** The events feature has never shipped; absent placement renders as today.
- **Both repos.** The client half lands here; the storage/validation half lands in FormamorphServer
  (live collaboration — same two-repo pattern as the listing changelog).
- **No world/save export shape is touched** — this is server API shape only; no version bump.

## Testing Decisions

Tests assert external behavior per the test-bar skill: what renders, what the draft carries, what
the server round-trips — never internal state. Mutation-test each new guard (clamp bounds, reset
rules, arm/disarm gating).

- **Pure math** — the generalized rect crop helpers: cover at both orientations, clamp at the
  bounds, focal-point encode/decode round-trip at multiple aspects (the same stored value must
  center the same source pixel in a wide and a tall frame). Prior art: the avatar-crop module's
  own test suite.
- **Band composition** — `posterBand()` with and without placement: null preserves today's output
  byte-for-byte; a placement produces the expected layer positioning. Prior art: the poster-style
  test suite.
- **Form interaction** — component tests: toggle arms/disarms, drag writes pan, wheel/slider/±
  write zoom, clamps hold, new image resets, Reset recenters, the saved draft carries the
  placement (and omits/nulls correctly on edit). Prior art: the event-form dialog's existing
  component tests.
- **Server round-trip** — create/edit with placement, fetch returns it, invalid shapes rejected,
  clearing the image clears it. Prior art: FormamorphServer's events admin and poster test suites.

## Out of Scope

- Artwork on the main-menu event banner cards (they stay icon-only).
- Pinch-to-zoom gestures.
- Any change to the avatar flow's own behavior (it only lends its generalized helpers).
- Baking, re-encoding, or resizing the uploaded image.

## Further Notes

- The done-bar: four gates green in this repo, FormamorphServer's suite green, `graphify update .`,
  changelog 👤 entry, verify-ui on the form + ack modal (both themes, desktop + mobile widths).
- The reposition control's exact chrome (button placement, slider styling) follows the avatar
  dialog's look; it is implementation detail, not spec.
