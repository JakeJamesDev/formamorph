# 14 — Client: publish entry opt-in

Type: task
Status: done
Blocked by: 12
Repo: formamorph

## Scope

Per [spec.md](../spec.md) §"Client — publish entry". Grounding:
[research/client-surfaces.md](../research/client-surfaces.md) §1 (payload path, open-effect reset
trap, gate-retry replay trap, worlds-only hiding). Visual target: publish variant B (opt-in card
with switch) in [assets/05-player-ui-prototype.html](../assets/05-player-ui-prototype.html).

- Opt-in card with switch in the publish modal: shown only when a contest is active AND the
  payload kind is world; hidden (never disabled) otherwise. Names the contest, links the rules.
- Overwrite publishes: gate the card to new publishes only (entry happens at publish time; a PUT
  carrying the flag would mean "move an existing listing in" — ruled out at charting).
- Flag as publish-time intent on the payload → top-level `contestEventId` in the request body.
  Never touches contentData (export-shape rule stays un-tripped). State resets in the modal
  open-effect and survives the upload-gate accept-and-retry replay.
- Preflight via the events/entries data: already-entered shows "you already entered <name>"
  instead of the switch; the server 409 (distinct code) surfaces as a clear inline error, not a
  toast.

## Done

Component tests per spec §Testing Decisions (visibility matrix, reset-on-reopen, gate-retry
survival, preflight, 409 rendering). Four gates green. (No world/save export-shape change —
verify and state so.)

## Outcome (2026-08-20)

Built. `ContestEntryCard` (`src/components/menu/ContestEntryCard.tsx`) is an opt-in card with a
`role="switch"` control, shown in `PublishModal` only when `activeContestOf(events)` finds a running
contest, the payload kind is `world`, and the target is a new listing — hidden, never disabled,
otherwise, and the Publish button reads "Publish & Enter" while armed. The events come from
MainMenu's existing `useActiveEvents` poll rather than a second fetch.

- **Payload:** `publishItem(payload, targetId, contestEventId)` — a third argument, sent top-level
  beside `tags` and omitted when null. `PublishPayload` and `contentData` are untouched, so the world
  export shape is unchanged.
- **State:** `enterContest` resets in the open-effect alongside the overwrite target, and the id is
  read at the upload rather than captured at the click, so it survives the upload-gate accept-and-retry
  replay (tested).
- **Preflight:** read off the overwrite list the modal already fetches — those rows carry
  `contest_event_id` (`w.*`), so an author with an entry sees "You already entered <name>" in place of
  the switch. `CONTEST_ALREADY_ENTERED` / `CONTEST_NOT_ACTIVE` are exported from `WorldStorageService`
  and rendered inside the card, not as a toast.
- The contest rules dialog was extracted to `ContestRulesDialog` and is now shared with `ContestBar`.

17 component tests in `PublishModal.contest.test.tsx` (visibility matrix, send matrix, reset-on-reopen,
gate-retry survival, preflight, both 409s, nested-dialog close) plus 4 for `activeContestOf`. The
open-effect reset and the overwrite guard were each proved red under mutation. Four gates green.

**No world/save export-shape change** — the flag is a request field only.

Dev route `#dev?view=mainMenu&modal=publish` opens the dialog on a canned world
(`devPublishSample.ts`) and a canned running contest, so the card is reachable with nothing published
and no event running; ledger and drift guard updated. Verified live at 1280 and 375 wide, both themes:
armed and unarmed track colors, the thumb travel, the "Publish & Enter" label, and the rules dialog
opening and closing over the publish dialog without stranding it. Neither line truncates — a clip on
mobile took either the contest's name or the one-entry-per-creator half.
