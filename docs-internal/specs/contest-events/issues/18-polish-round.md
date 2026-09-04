# 18 — Events polish round: markdown fields, themed dates, poster styling, publish fixes

Status: ready-for-agent
Type: task

Assembled 2026-08-21 from a grilling session over the first live test of the contest build
(ticket 17's build running against a real server). Six player- and organizer-facing rough edges,
one of them a live bug.

## Problem Statement

The first real contest run surfaced friction on both sides of the feature:

- An organizer writing an event gets plain text fields for Details and Rules, while every other
  prose field in the app has a markdown toolbar — and what they write displays as raw text, so
  they can't format an announcement at all.
- The start/end date pickers open the browser's native calendar popup, which ignores the app's
  theme entirely and looks foreign next to everything else.
- On the Contest tab, the contest's own banner card still shows with a "View Entries" action —
  a button that goes where the player already is.
- The contest-started poster appears before the main menu has finished presenting itself
  (it renders over the intro animation), which is disorienting. Its header band is also a fixed
  blue: an organizer has no way to give their event a color or an image, and the rules dialog —
  the other place the event is read — shares none of the poster's presentation.
- Publishing a world as a contest entry leaves the publish window open even though the publish
  and the entry both succeed and the success toast fires — normally publishing closes it.
- When updating a world that is already entered in the contest, nothing says so: the contest
  card disappears the moment an existing listing is selected as the target, and the listing's
  own row carries no indicator.

## Solution

Give event prose the same markdown treatment as world prose, on both the writing and reading
side. Replace the native date pickers with a themed calendar. Drop the redundant contest banner
on the Contest tab. Hold the poster until the intro is done, let organizers style its header
band with a color and an uploaded image, and reuse that band in the rules dialog. Fix the
publish window so a contest entry closes it like any other publish, and mark an entered listing
as entered wherever it can be selected for an update.

## User Stories

1. As an event organizer, I want a markdown toolbar on the Details field, so that I can format
   an announcement the way I format a world description.
2. As an event organizer, I want a markdown toolbar on the Rules field, so that contest rules
   can carry lists, emphasis, and headings.
3. As an event organizer, I want a preview of my markdown while writing, so that I see what
   players will read before I save.
4. As a player, I want the poster's body text rendered as markdown, so that the organizer's
   formatting reaches me.
5. As a contest entrant, I want the rules text rendered as markdown, so that structured rules
   read as structure rather than as symbols.
6. As an event organizer, I want the start and end pickers to look like the rest of the app,
   so that the admin form doesn't drop me into unthemed browser chrome.
7. As an event organizer, I want to pick both a date and a time in that themed picker, so that
   the precision the native input gave isn't lost.
8. As a player on the Contest tab, I want the contest banner card gone, so that I'm not offered
   a "View Entries" button for the place I'm standing in.
9. As a player on the Contest tab, I want announcement banner cards to keep showing, so that
   hiding the redundant card doesn't hide unrelated news.
10. As a player on any other tab, I want the contest banner card unchanged, so that the way
    into the contest is still advertised everywhere it's useful.
11. As a first-time player, I want the poster to wait until the intro animation has finished,
    so that the menu is in front of me before something asks for my attention.
12. As a returning player, I want the poster to appear as soon as the menu is up, so that
    holding it for the intro doesn't delay it when there is no intro.
13. As an event organizer, I want to pick a color for my event's poster band, so that the
    event carries its own identity instead of the app's default blue.
14. As an event organizer, I want to upload an image for the poster band, so that a themed
    contest can lead with art.
15. As an event organizer, I want readable text over whatever color I pick, so that a light
    band doesn't produce white-on-white.
16. As an event organizer, I want a live preview of the band in the event form, so that I see
    the color and image composed before saving.
17. As an event organizer, I want the band to fall back to the default look when I set nothing,
    so that styling stays optional.
18. As a player, I want the end-of-contest poster to carry the same organizer styling as the
    start poster, so that the event reads as one thing across its life.
19. As a contest entrant, I want the rules dialog to open with the poster's header band, so
    that the rules are visibly the same event I was shown the poster for.
20. As a player on an older server, I want the poster to render with the default band when the
    styling fields don't exist, so that a client update never breaks against a lagging deploy.
21. As a contest entrant, I want the publish window to close when my entry publishes
    successfully, so that a successful entry looks successful.
22. As a contest entrant updating my entered world, I want its row in the publish target list
    to say it's in the contest, so that I know which listing carries my entry.
23. As a contest entrant updating my entered world, I want the contest card to stay visible
    (read-only, no switch) while that listing is the selected target, so that the contest
    context doesn't vanish mid-flow.
24. As a server operator, I want an event's uploaded image deleted with the event, so that
    orphaned files don't accumulate.
25. As a moderator reading events in the admin tab, I want everything I could already do to
    keep working unchanged, so that this polish round costs nothing on the admin side.

## Implementation Decisions

From the grilling session (all confirmed by the user):

- **Markdown editor**: the Details and Rules fields reuse the existing prompt-field markdown
  editor in its markdown mode with no placeholder chips — the same toolbar, transforms, and
  preview tab world prose gets. No second toolbar implementation.
- **Markdown display**: the poster body and the rules text render through the app's shared
  markdown renderer. Banner text stays plain — it is single-line by construction.
- **Date pickers**: both native datetime inputs are replaced by one new `DateTimeField`
  component — a themed calendar (new dependency: react-day-picker, version confirmed live at
  install time) in a popover plus a time field. This is the only surface in the app using
  native datetime inputs, so nothing else moves.
- **Contest tab banner**: the contest's banner card is filtered out of the banner stack when
  the Contest tab is the active tab. Announcement cards are unaffected; the collapsed-chip
  state store is untouched.
- **Poster timing**: the acknowledgment poster does not render while the intro sequence is
  active. The main menu already knows whether the intro is playing; the poster is gated on
  that, with no additional settle delay.
- **Poster styling — fields**: the server event gains two optional styling fields: a free-form
  color and an uploaded image. Both sides are built now; the client tolerates their absence
  (older server ⇒ default blue band). This changes the server event shape — a FormamorphServer
  migration, not a world/save export change, so no client version bump.
- **Poster styling — color**: a free color picker. The band's foreground (text/icon color) is
  computed from the chosen color's luminance so contrast holds for any pick. Default remains
  the current info blue.
- **Poster styling — image**: the uploaded image covers the band with a scrim so the title
  stays readable; the chosen color tints the scrim and serves as the no-image fallback. The
  server stores the file with the event and deletes it with the event; upload rides the event
  create/update flow.
- **Poster styling — reach**: the styling shows on the poster (both phases) and the rules
  dialog only. The banner card and its collapsed chip keep their semantic look — they are
  system chrome, not the event's canvas.
- **Shared band**: the poster's header band (icon, eyebrow, title, date pill, now color/image)
  is extracted into one shared component consumed by the poster and the rules dialog.
- **Form preview**: the event form shows a live preview of the composed band.
- **posterStyle lib**: color validation, foreground contrast, and the image/color fallback
  logic live in one pure module both consumers read, keeping the visual components thin.
- **Publish close bug**: the wiring reads correct (the close signal and the toast share a
  success path, and the parent holds plain state), so this is a live-repro investigation
  first. Repro signature, witnessed by the user: success toast fired, world was published and
  entered, no error shown, modal stayed open. Fix follows the diagnosis; the fixed behavior is
  the spec: a successful contest-entry publish closes the window exactly like a plain publish.
- **Entered-listing indicator**: in the publish window's target list, the entered listing's
  row carries a trophy "In {contest}" badge, and the contest card stays visible in a read-only
  state (no switch, no withdraw ambiguity) whenever that listing is the selected target.
- **Server coordination**: the user coordinates the FormamorphServer prod deploy with the
  server owner; nothing client-side may hard-require the new fields.

## Testing Decisions

- Good tests here assert external behavior — what an organizer or player sees and can do —
  never the internals of the editor, calendar, or renderer.
- **Existing seams, reused**: the pure contest/event libs and their shared fixture module; the
  RTL component suites for the banner, poster, event form, publish window, and admin events
  tab (real providers, mocked services — the established pattern); the Playwright entry-flow
  E2E; FormamorphServer's own vitest suite for the server half.
- **New seams (three, user-confirmed)**:
  1. `DateTimeField` gets its own test file; the event form's tests treat it as a black box.
  2. `posterStyle` is a pure unit seam: color parsing, contrast foreground, fallback rules.
  3. The shared header band has no test file of its own — it is asserted through its two
     consumers' existing suites.
- The close bug's fix lands with a regression test at whichever seam the diagnosis names, plus
  the mutation check (reinstate the bug, watch the test fail).
- Poster gating is asserted at the poster's component seam (held while intro active, shown
  after).
- Server: event styling columns, upload, and delete-with-event covered in the server repo's
  controller tests.

## Out of Scope

- Tinting the banner card or its chip with the organizer color (explicitly declined).
- A preset color palette (free picker chosen instead).
- A third, winner-phase poster (already declined in ticket 17).
- Markdown in banner text or titles.
- Replacing any other date/time input in the app (there are none).
- Re-litigating anything ticket 17 settled (archive selector threshold, kept scope-creep
  behaviors).
- Client version bump or world/save migrations — the shape change is server-event-side only.

## Further Notes

- American English for all new coinage; the server's existing `cancelledAt` field name is
  external API spelling and stays.
- The new-dependency rule applies: confirm react-day-picker's identity and latest version from
  the live registry before installing.
- The event form is admin-only; the markdown editor it now embeds is already in the bundle for
  the world editor, so the weight cost is acceptable (settled during grilling).
