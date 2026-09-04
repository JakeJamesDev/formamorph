# Request Anatomy Settings Fidelity

Status: ready-for-agent

*Follow-up to the Request Anatomy feature (`.scratch/anatomy-view/`). The shipped Settings anatomy view
pins every generation setting — Thinking mode, section style, markdown output, paragraph limit, language,
memory settings, the in-world clock — while the sibling Preview panes in the same modal read the live
values, and the modal itself already hides editor surfaces under exactly the conditions the pins ignore.*

## Problem Statement

The Request Anatomy view in Settings claims to show "the request the game sends," but it shows the request
a *pinned configuration* sends. A player running any Thinking mode other than Off sees a User Message run
and a Direction rider their requests never contain — surfaces whose editors the same modal is currently
hiding from them. A player using the XML section style sees markdown headers. A player with Memory
Summaries disabled can toggle a recap exchange their game can never produce. The view contradicts both the
player's real requests and the modal's own surface-availability logic, in the one place whose entire
purpose is "what I see is true."

## Solution

The anatomy preview reads the player's actual settings — the same live values the modal already holds and
its sibling Preview panes already use — and builds the request *this* configuration sends. Surfaces the
player's mode disables are absent as runs, exactly as their editors are absent from the modal. The
condition toggles shrink to genuinely situational things (condensing has happened, a recall hit, a
bracketed action), each hidden entirely when the settings that enable it are off — strictly mirroring how
the modal hides the corresponding editor surfaces. Only what is per-save or per-run stays canned: the
playthrough, notes, dictionary matches, and a canned turn plan for the planning modes.

## User Stories

1. As a player, I want the anatomy drawn with my actual Thinking mode, so that the final user turn I see is the one my requests really send.
2. As a player in a non-Off Thinking mode, I want no User Message or Direction runs in the anatomy, so that the view agrees with the modal hiding those editors from me.
3. As a player in Inline mode, I want the inline thinking directive shown as a context run in the final turn, so that I can see what my mode appends.
4. As a player in Precall or Staged mode, I want the turn-plan directive shown as a context run (from a canned plan), so that the planning modes' extra payload is visible in shape.
5. As a player using the XML or Simple section style, I want the system prompt in the anatomy rendered in that style, so that the anatomy matches the editor Preview beside it.
6. As a player, I want my markdown-output, paragraph-limit, language, and reply-length settings reflected in the anatomy's system prompt, so that no directive I see is one I didn't configure.
7. As a player with Memory Summaries disabled, I want no recap toggle and no recap exchange in the anatomy, so that the view never demonstrates a state my game cannot reach.
8. As a player without Scene Recall (Memory Summaries, semantic memory, or rehydration off), I want no recall toggle and no recall exchange, so that the gating matches the Recall editor's own availability.
9. As a player with the in-world clock stamping memories, I want the condensed band in the anatomy stamped with canned in-world times, so that the stamp shape my requests carry is visible.
10. As a player, I want a bracketed-action toggle in every mode, so that I can see the bracket ride my action — and see that the Direction rider answers it only in Off mode.
11. As a player, I want changing a setting in Options and returning to Anatomy to redraw the preview, so that the view always shows my current configuration, not a stale one.
12. As a player, I want the toggles that remain to be only situational conditions of the playthrough, so that nothing in the toggle bar duplicates a setting I chose elsewhere.
13. As a world author, I want my loaded world's chip data in the anatomy under my real settings, so that the preview is my world under my configuration, not a sample under someone else's.
14. As a player, I want the sent bytes untouched by any of this, so that inspection still never changes behavior.
15. As a developer, I want the preview builder to take the settings as plain data, so that its output stays unit-testable for every settings combination without rendering the app.
16. As a developer, I want each mode's anatomy asserted by slicing real offsets, so that a mode-shaped run can never point at the wrong text.
17. As a developer, I want the toggle-gating conditions expressed once and shared with the builder's assumptions, so that the panel cannot show a toggle the builder would ignore.

## Implementation Decisions

- **The preview builder gains a settings argument** — a plain-data snapshot of the player's live
  generation settings, passed down from the modal (which already destructures every needed value). No new
  context reads inside the builder; it stays pure.
- **Settings read live**: Thinking mode, section style, markdown output, paragraph limit, language, reply
  max tokens — the same set the sibling editor Preview panes already pass — plus Memory Summaries,
  semantic memory, semantic rehydration, and the in-world clock settings for gating and stamping.
- **Stays canned** (per-save or per-run, like the fixture playthrough itself): the playthrough, player
  notes, dictionary/embedding matches, and the turn plan. Precall and Staged append a plan directive built
  from a **canned turn plan** consistent with the fixture story — the plan is runtime AI output, exactly
  like the canned narrations.
- **Context window stays pinned outsized** so the four-turn fixture never trims: the toggles decide what
  rides, not a budget the player can't see. This pin is documented and deliberate.
- **The recap toggle keeps overriding the verbatim floor** (condense almost everything vs. nothing) rather
  than reading the player's verbatim-turns setting: the toggle simulates *game length* — a four-turn
  fixture would sit under any realistic floor and the condensed band would never appear.
- **Toggle gating hides entirely** (user decision): a toggle whose enabling settings are off is not
  rendered, strictly mirroring how the modal hides the Recap/Recall/User/Direction editor surfaces.
  Recap requires Memory Summaries; Recall requires Memory Summaries + semantic memory + semantic
  rehydration, and additionally the recap toggle on (unchanged). The brackets toggle is never gated: the
  bracket rides the action in every mode, and the Direction rider appearing only in Off mode is itself the
  honest demonstration.
- **Clock stamping**: when the player's time settings would stamp the condensed band in a real turn, the
  fixture supplies a canned position-to-label stamp resolver so the band renders stamped; gating mirrors
  the real turn's condition.
- **Reactivity**: the panel recomputes when any consumed setting changes, so switching modes in Options
  and returning shows the new shape.
- **No change to what any real turn sends**; no export-shape change; the anatomy sidecar model, labels,
  and both rendering surfaces are untouched.

## Testing Decisions

- Same bar as the parent feature: external behavior only, offset truth (every run assertion slices the
  actual content by the run's offsets), and the generic tiling invariant across all settings/toggle
  combinations.
- **The preview builder is the seam** (user-confirmed): feed it settings variants and assert the runs —
  Off mode has User Message and Direction runs; Inline has neither but has the mode directive; Precall and
  Staged carry the plan directive from the canned plan; XML section style shows in the system prompt
  content; Memory Summaries off leaves no recap trace even with the toggle forced on; rehydration off
  leaves no recall trace; clock on stamps the band. Determinism across repeated builds stays asserted.
- **Panel component tests cover gating only** (user-confirmed): gated toggles absent from the DOM when
  their settings are off, present when on.
- Prior art: the existing preview-builder tests, the anatomy view component tests, and the sent-when
  on/off pair pattern from the banding and turn-pass anatomy tests.

## Out of Scope

- Anatomy for the Staged mode's other passes (director, character, storyboard) — the view shows the
  narration request only, as before.
- Reading the real verbatim-turns setting into the fixture (see the game-length decision above).
- Any copy or availability changes to the editor surfaces themselves.
- Changes to the in-game AI Context anatomy (already honest per mode).
- Persisting anything; export shapes untouched.

## Further Notes

- Root cause worth recording: the original implementation pinned Thinking mode Off with the rationale
  "other modes would leave surfaces with nothing to show" — but the modal already *hides* those editors in
  other modes, so blank-in-other-modes was the correct behavior all along, and the availability conditions
  needed were already expressed in the same file the panel was added to.
- The changelog entry is a user-facing fix folded into the existing In-Progress "Request Anatomy" grouping
  (the feature has not shipped, so this is a fold, not a new bug entry).
