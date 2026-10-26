# 08: Review Tab

Status: done
Blocked by: 02, 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Review tab, Item detail, Reject flow, Audit log, Dev routes)

Model rationale: a new staff tab built on the Reports tab pattern; the fixed tab grid is the layout risk.

## What to build

Mods get a **Review** tab with the waiting count in its label. It lists the queue in server order. An item opens a dialog with its details and a content download. **Approve** puts it live. **Reject** runs `QuarantineDialog` for a new listing or a confirmation for a resubmission, then opens the message composer with the quarantine template. Updates in the dialog are ticket 09.

## Acceptance criteria

- [x] The tab shows for `canModerate` users only, with the count in its label like Reports. Per the rulings: one **Moderation** tab holds Reports and Review; the counts sit on the **Reports (n)** and **Review (n)** segments and the main menu badge, not the strip. Review shows only when `/api/reviews/meta` answers. `AdminPanelDialog.test.tsx` "the Moderation tab".
- [x] The tab grid column counts change for admins and mods, and `admin-panel-widths.spec.ts` passes with the new tab. Admins and mods keep 8 and 5 tabs; the cap is 1000px; admins switch at 1000px, mods at `md`. The spec now checks every label in every selectable font; a forced 12-column grid failed it in OpenDyslexic only.
- [x] Queue rows show kind, name, author, age, type and a contest marker, in server order. `ReviewTab.test.tsx` "reading the queue".
- [x] Approve removes the row and drops the count. `ReviewTab.test.tsx` "takes the item off the queue and asks for a new count".
- [x] Rejecting a new listing goes through `QuarantineDialog`; a resubmission goes through a confirmation; both open the composer filled from the route's answer. `ReviewTab.test.tsx` "rejecting"; the "another week" sentence drops when `quarantineExtended` is true (ruling 6), mutation-checked.
- [x] A `409` shows that another mod handled the item. `ReviewTab.test.tsx`, mutation-checked; a `409` on an update keeps the row and shows the server's words for ticket 09's judging case.
- [x] Approve and reject are hidden on items the staff ladder forbids. `ReviewTab.test.tsx` "the staff ladder", mutation-checked; also hidden on the viewer's own listing (ticket 03's server rule).
- [x] The five review audit actions get labels, a pill style, filter entries, and open the listing from `target_id`. `AuditLogTab.test.tsx` "review entries".
- [x] The tab and the item dialog have `devRoutes` entries. `adminPanelModeration` (`subtab=reports|review`), `fixture=review` and `pick=<id>`; `devRouter.test.ts` guards the ledger.
- [x] Async writes check `useMountedRef`; a test unmounts mid-request. `ReviewTab.test.tsx` "does nothing after the tab unmounts mid-request"; removing the guard fails it.
- [x] Frames: `.scratch/frames/review-tab-{light,dark}.png` and `.scratch/frames/review-item-{light,dark}.png` at desktop width. Playwright, 1440×900, `fixture=review`.
- [x] A changelog fragment covers the staff-facing change. `docs-internal/changelog.d/listing-review-08.md`.

## Landed

**Not verified**

- Approve, reject and download against a live server. The tests and frames use a mocked service and the `fixture=review` stub.
- The resubmission flow end to end: server ticket 03 serves `type: 'resubmitted'` and was not on main at the build.

**For you**

- Whether the Moderation tab and its Reports and Review segments read clearly. See `.scratch/listing-review-08/frames/review-tab-light.png` and `.scratch/listing-review-08/frames/review-tab-dark.png`.
- Whether the item dialog shows enough to decide on a new listing. See `.scratch/listing-review-08/frames/review-item-light.png` and `.scratch/listing-review-08/frames/review-item-dark.png`.

**For ticket 09**

- Rejecting an update already confirms first and skips the composer; ticket 09 adds the rejected-update template.
- A `409` on an update keeps the row and toasts the server's text; ticket 09 owns the judging copy.
