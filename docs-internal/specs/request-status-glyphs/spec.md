# Spec: Request Status Glyphs

Status: done
Status note: Closed on 2026-10-24. Tickets 01–04 landed; the last landing is 25ca93b1c. Review: spec text corrected (Q19–Q21 ruled at close). Gates green on 2026-10-24.
Spec session: request-status-glyphs — spec

## Problem Statement

While a turn runs, the player sees one muted line, "Generating Narration…", next to a moving bar. Every request looks the same: a 40-second narration pass, a quick choices pass, a Tool call and a memory digest all show one label and one bar. On a slow local model, the player cannot tell a working turn from a stuck one. The row also sits between the Pager and the action box, so the input jumps down when the row appears and back up when it goes.

## Solution

The status row gets a small **animated glyph** for each kind of request, in the Lucide stroke style. Narration shows a quill that writes, Plan a swinging compass needle, Stat Updates pumping bars, Choices a dot that takes a fork, and so on. After 3 seconds the row also shows how long the turn has run. The row leaves the footer flow: it becomes a full-width strip that floats above the footer on a short fade, so the Pager and the input never move.

Eight glyphs come from animate-ui's icon registry. We write three ourselves (quill, masks, split) in the same format. The **Thinking** header above a reasoning model's scratchpad also trades its pulsing dot for a rising thought cloud of ours. A standalone mock with every glyph exists in `.scratch/status-glyphs/` (start the `scratch-status-glyphs` preview). The player approved its look on 2026-10-24.

## Rulings

Settled with the user on 2026-10-23 and 2026-10-24 in the grill.

| # | Ruling |
|---|---|
| Q1 | The glyphs use **Motion** (`motion` 14) and animate-ui's icon sources, copied into our tree from its registry. We do not add the `@animate-ui/react` package |
| Q1b | We copy animate-ui's **v2** registry. Its icon wrapper calls `React.use` three times, and that needs React 19. We patch those calls to `useContext`, because we are on React 18.3. The v1 registry works on React 18 but lacks hourglass, book-open and scroll |
| Q1c | Supersedes Q1b. New evidence: the v2 wrapper needs far more than three patches for React 18 (context as provider, ref as prop, `<style precedence>`, four more `React.use` calls in its motion utils). A spike measured a React 19 upgrade: typecheck 12 errors, lint and build pass, 16 test failures and a stack-overflow crash. Ruling: the project upgrades to React 19 first, as its own effort, starting from the spike branch. Ticket 02 then uses the v2 wrapper **unpatched** |
| Q2 | Three rows get glyphs: the turn request row, the Tool status row, and the background pass row |
| Q3 | No step dots for the passes a turn will run. That is a separate effort |
| Q4 | A whole-turn elapsed timer appears after 3 s |
| Q5 | The glyph uses the muted label color. The bar stays the one accent |
| Q6 | Each glyph pauses 400 ms between loops |
| Q7 | With the OS **reduced motion** setting on, the glyph shows as a static icon. We add no app setting |
| Q8 | A glyph stays at least 300 ms before the next one replaces it. The label changes at once |
| Q9 | Our three glyphs (quill, masks, split) use animate-ui's variant format and the same wrapper. All glyphs share one loop path and one reduced-motion path (the thought cloud adds its own fully lit static frame for Q16a) |
| Q10 | In the background pass row, Summarizing, Selecting memories and Writing diary show the book. Describing character shows the masks |
| Q11 | The timer shows on the turn row and the Tool row, not on the background pass row |
| Q12 | The status row leaves the footer flow. It becomes an overlay above the footer. Nothing in the layout moves when it appears or goes |
| Q13 | The overlay is a full-width strip: glyph, label, bar and timer, on a short fade from the panel background into the narration |
| Q14 | The overlay works the same way in the Pages and Chat layouts |
| Q15 | The narration gets no reserved bottom padding. The strip can cover the last streamed line while a request runs. This is an accepted trade-off |
| Q16 | The **Thinking** header's pulsing dot becomes a **rising thought cloud** (ours): a cloud with three dots inside and two solid tail dots at the lower left. On one 2 s cycle, the small tail dot, the large tail dot, the cloud and the three inner dots each light in turn, 0.15 s apart, and stay lit. After a short hold, all six fade back together to a dim rest. The 400 ms loop pause applies |
| Q16a | Under reduced motion, the thought cloud shows fully lit and static, not its dim rest frame (answer to ticket 03, 2026-10-24) |
| Q17 | The thought cloud replaces the dot everywhere the Thinking header shows: the game's reasoning block and Formaquestion's answer header |
| Q18 | The status strip does not switch to the thought cloud during a request's reasoning phase. It keeps one glyph per request |
| Q19 | Supersedes Q13's backdrop and Q15's "can cover" (ratified at close, 2026-10-24, from c32b12f24 and faec284d0). The strip has no backdrop of its own. Instead the narration masks itself: it is clear under the strip's bottom 1rem and fades in over 2.5rem above it, at every scroll position, while the strip shows. Text under the strip is hidden, not partly visible. Still no reserved padding |
| Q20 | The Thinking header's thought cloud is 14px next to the 12px header text, the mock's size (ruled at close) |
| Q21 | A partial re-roll shows the elapsed timer too. A re-roll is a wait like a turn (ruled at close) |

Placement answers to ticket 01, 2026-10-24: the strip anchors to the top of the whole footer group (like prompt, location suggestion, Pager), overlaying the bottom of the narration frame. "Full width" is the narration frame's inner width.

### Glyph map

| Glyph | Source | Request types |
|---|---|---|
| quill (Lucide `feather`) | ours | Narration |
| rising thought cloud | ours | The Thinking header, not a request type (Q16, Q17) |
| compass (`default-loop` variant) | animate-ui | Plan (`thinking`) |
| masks (Lucide `drama`) | ours | Cast (`director`), Motivation (`character`), Character (`discoverEntity`); background Describing character |
| split, with a dot that takes the left branch, then the right | ours | Choices |
| chart-column-increasing (`default-loop`) | animate-ui | Stat Updates |
| book-open | animate-ui | Memory (`summary`), Memory Select, Diary; background Summarizing, Selecting memories, Writing diary |
| scroll | animate-ui | Storyboard |
| map-pin | animate-ui | Location, Entity Location |
| hourglass | animate-ui | Clock (`timePassed`), Opening (`openingTime`) |
| sparkles | animate-ui | Scene Tags, the editor request types, and the "Response" fallback |
| hammer | animate-ui | Tool calls |

The mock's pencil glyph is not used.

## User Stories

1. As a player, I want each request in a turn to show its own glyph, so that I can see what the AI is working on at a glance.
2. As a player, I want the Narration request to show a quill that writes, so that the longest wait reads as the story being written.
3. As a player, I want the Plan request to show a compass needle swinging, so that I know the AI is choosing a direction for the turn.
4. As a player, I want the Cast, Motivation and Character requests to show theater masks, so that I know the AI is working on characters.
5. As a player, I want the Choices request to show a path that forks, so that I know my next options are on the way.
6. As a player, I want the Stat Updates request to show moving bars, so that I know my stats are being worked out.
7. As a player, I want the Memory, Memory Select and Diary requests to show a book turning a page, so that I know the game is writing things down.
8. As a player, I want the Storyboard request to show a scroll, so that I can tell it apart from narration.
9. As a player, I want the Location and Entity Location requests to show a map pin, so that I know someone is moving.
10. As a player, I want the Clock and Opening requests to show an hourglass, so that I know story time is being worked out.
11. As a player, I want a world Tool call to show a hammer, so that I can tell a Tool round from the AI writing.
12. As a player, I want the background passes between turns to show the book or masks glyph, so that the silent work looks like the same kind of work during a turn.
13. As a player, I want a request type with no glyph of its own to show the sparkles glyph, so that the row never shows an empty slot.
14. As a player, I want the glyph to keep the label's muted color, so that the row stays quiet and the bar is still the one accent.
15. As a player, I want each glyph to pause briefly between loops, so that short gestures don't read as twitching.
16. As a player, I want a glyph to stay at least 300 ms before the next one replaces it, so that fast passes don't make the icon flicker.
17. As a player, I want the label to change the moment the request changes, so that the text is always accurate even while the glyph waits.
18. As a player, I want the glyphs to change with a short crossfade, so that the swap is smooth.
19. As a player on a slow model, I want to see how long the turn has run after 3 seconds, so that I know it is still working.
20. As a player, I want the timer to count the whole turn, not each request, so that it shows my real wait.
21. As a player, I want no timer on the background pass row, so that silent work between turns doesn't look like something I'm waiting for.
22. As a player who turned on reduced motion in my OS, I want the glyphs to hold still, so that the row doesn't animate against my setting.
23. As a player, I want the status row to float above the footer, so that the Pager and the action box never jump when a turn starts or ends.
24. As a player, I want the strip to fade into the narration behind it, so that the label stays readable over text.
25. As a player in the Chat layout, I want the same strip over the bottom of the chat, so that both layouts behave the same.
26. As a player on mobile, I want the strip to fit the narrow footer, so that the label and bar stay readable on a small screen.
27. As a player, I want the bar to keep its full width in the strip, so that the familiar busy cue stays.
28. As a player who hid silent requests, I want the Tool row and the background pass row to stay hidden, so that **Show Silent Requests** keeps working as before.
29. As a player using a screen reader, I want the glyph hidden from assistive technology and the label kept as text, so that the row reads the same as today.
30. As a player in either theme, I want the glyphs to follow the theme colors, so that they look right in light and dark.

## Implementation Decisions

- **One status-row component.** A new shared component renders the strip: glyph slot, label, the existing indeterminate bar, and an optional timer. The turn row, the Tool row and the background pass row all render through it. Its inputs are the glyph to show, the label text, and whether to show the timer with the turn's start time. It owns the 300 ms dwell, the crossfade and the timer.
- **Glyph map.** A table maps every `AIRequestType` to a glyph key. It is typed as a complete record over the request type union, so a new request type fails typecheck until it gets a glyph. The editor request types map to sparkles. The background pass kinds map through a second small table (Q10). A Tool round maps to hammer.
- **Glyph library.** A new folder holds the copied animate-ui wrapper (unpatched, on React 19; Q1c) and one file per glyph. Each glyph keeps animate-ui's variant shape: named parts, an `initial` and an `animate` variant, and the `default-loop` variant where animate-ui ships one. The wrapper's `loop` mode runs each glyph with a 400 ms `loopDelay`. Our three glyphs and the thought cloud follow the same shape. The split glyph alternates its branch on each loop.
- **Thinking header.** The shared Thinking label (used by the game's reasoning block and Formaquestion's answer header) renders the thought cloud in place of its pulsing dot while active, at 14px (Q20). The finished "Thought for Ns" line shows no glyph, as today.
- **The wrapper's dependencies come with it.** The v2 wrapper imports a Slot primitive and an in-view hook. The ticket copies what the wrapper needs, or swaps it for the project's own Radix Slot where the shapes match. It adds no other animate-ui component.
- **Reduced motion.** The glyphs honor `prefers-reduced-motion` through Motion's user setting, so a static first frame shows. No app setting.
- **Timer.** The turn's start time comes from the moment the turn's first request starts. A Tool row in the same turn shares that start. The timer appears at 3 s and counts whole seconds, with no minutes form ("75s"), after the bar. It never restarts mid-turn. A Tool row with no turn running shows no timer. The row takes an optional start time and owns its 1 s tick (answers to ticket 04, 2026-10-24).
- **Placement.** The strip is positioned over the bottom edge of the narration area, anchored to the top of the footer, in both layouts. It is out of flow, so the footer's height never changes. The strip has no backdrop; the narration masks itself under and above it while it shows (Q19). The narration gets no reserved padding.
- **Copy.** The labels stay as they are today ("Generating Narration…", "Summarizing turn…"). This effort changes no label text.
- **Third-party notice.** THIRD-PARTY-NOTICES gets an animate-ui entry with its license text (MIT plus the Commons Clause condition). The Commons Clause allows use inside a paid app. It forbids selling or redistributing the components themselves.
- **Design system.** The strip and the glyph set are a new visual pattern (ADR 0008). They get a showcase entry, and the user approves them in the app, mobile form included, before the effort closes.
- **No export-shape change.** Nothing here touches the world or save `.json`.

## Testing Decisions

- A good test drives the status-row component the way a player sees it: what label shows, which glyph is in the slot, when the timer appears, and what the row shows after the request type changes. It does not assert Motion's variants, keyframes or internal timers.
- **The one seam is the status-row component**, tested with fake timers:
  - the label for a request type, and the glyph that the map picks for it;
  - the glyph swap waits until 300 ms have passed, while the label changes at once;
  - the timer is absent before 3 s and shows whole seconds after it, and it never shows when the timer is off;
  - with reduced motion on, the glyph renders and does not animate.
- **Glyph map completeness is a type gate**, not a test: the map is a complete record over `AIRequestType`.
- **Existing integration checks stay:** the GameViewer reroll tests that assert "Generating Choices…" and "Generating Stat Updates…", and the BackgroundPassStatus tests. They must pass unchanged.
- **Placement is not a jsdom check.** The overlay position, the fade, and "nothing moves" are verified with static frames through the `verify-ui` skill: Pages and Chat layouts, desktop and mobile, light and dark. Motion claims (dwell, crossfade, loop pause) need Playwright frame sampling if a ticket claims them; the Browser pane suspends rAF.
- Prior art: BackgroundPassStatus's tests for the background row, the GameViewer reroll tests for the turn row, and existing fake-timer component tests in `src/components/game/`.

## Out of Scope

- Step dots for the passes a turn will run (Q3).
- An app setting to turn the animation off (Q7).
- Glyphs anywhere outside the three in-game status rows and the Thinking header: the rest of the Formaquestion help window, editor generate buttons, the TTS row, scene image jobs.
- A thinking glyph in the status strip (Q18).
- A reserved bottom padding in the narration (Q15).
- Any change to the label text.
- Updating Motion or animate-ui sources after the copy.
- The React 19 upgrade itself. It is its own effort, and ticket 02 waits for it (Q1c).

## Further Notes

- **Bundle cost.** Ticket 02 measured Motion and the glyphs: the main chunk grew 175.5 kB (56.9 kB gzip).
- **The Q19 cost is real.** During the Narration pass, the newest streamed line sits under the strip, masked out. If this reads badly in play, it is new evidence to reopen Q19.
- The animate-ui keyframes in the mock were ported to the Web Animations API by hand. Under Q1 the shipped glyphs use animate-ui's own sources, so motion can differ slightly from the mock. The hammer had no duration in its source; the mock used Motion's 0.8 s default.
