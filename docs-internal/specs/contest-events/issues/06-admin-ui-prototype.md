# 06 — Admin events tab prototype

Type: prototype
Status: done
Status note: reactions captured 2026-08-20
Blocked by: 03, 04

## Question

Prototype the staff/admin surface:

- Events tab in AdminPanelDialog: list of events (draft/active/ended), create/edit form (type, title, window, banner/modal/rules text), role gating (staff vs admin — who may create/end events?).
- Winner pick flow: browsing entries and marking the winner, with the auto-broadcast preview.
- Whether plain announcement events share this form or dedupe with the existing broadcast composer (resolves the fog item).

## Prototype (2026-08-20)

Asset: [assets/06-admin-ui-prototype.html](../assets/06-admin-ui-prototype.html) · published: https://claude.ai/code/artifact/a4e201b6-4612-4670-b077-bd3272939486

Standalone HTML mock (05 precedent — nothing of the surface exists in code yet). Chrome replicates
AdminPanelDialog (tab strip, 900px dialog); styling mirrors `src/index.css` tokens + type roles.
Fixtures exercise every derived state from contract 03 (active / judging / scheduled / ended /
cancelled) and the 04 winner-pick guards (own entry + quarantined entry unpickable).

Controls: floating bottom bar — screen tabs, ←/→ variant cycling (keyboard works), **admin/staff
role toggle**, theme + mobile (390px) toggles.

| Screen | A | B | C |
|---|---|---|---|
| Events tab list | Broadcasts twin (flat list + New Event) | Grouped by state (Happening Now card / Scheduled / Past) | Master-detail (list + detail pane) |
| Create form (the dedupe fog item) | One event form with a Contest/Announcement type picker; composer untouched | Announcements ride the broadcast composer via an "Also show as a timed event" switch; Events form is contest-only | Two sibling forms off a split New Contest ▾ button; slim announcement form |
| Winner pick | Gallery dialog (entry grid → broadcast preview → announce) | Two-step wizard (ranked table → review + preview) | Judging table in-tab, confirm dialog per Pick |

Every winner variant shows the auto-broadcast preview before confirming, and a picked/archived
end state (with demo reset). Role gating shown, not described: **staff** sees a 4-tab strip
(no Broadcasts/Policies), no create/edit/cancel, no cancelled rows — but keeps Pick Winner
(contract 03 gives winner pick to any staff, which forces the Events tab to be staff-visible,
contra the research §5 admin-only suggestion — a reaction to capture).

## Reactions (the answer — 2026-08-20)

- **Events tab list: B** (grouped by state — Happening Now card / Scheduled / Past).
- **Create form: A** — one event form with a Contest/Announcement type picker, **formatted like the
  Feedback tab's sub-tabs** (full-width two-column TabsList strip, not a small segmented control).
  This resolves the fog item: plain announcement events share the events form; the broadcast
  composer is untouched.
- **Winner pick: A** (gallery dialog — entry grid → broadcast preview → announce).

The mock now defaults to the picked variants (losing variants remain cyclable) and form A's type
picker uses the Feedback-style tab strip.
