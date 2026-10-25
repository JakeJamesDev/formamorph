# 08: Review Tab

Status: ready-for-agent
Blocked by: 02, 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Review tab, Item detail, Reject flow, Audit log, Dev routes)

Model rationale: a new staff tab built on the Reports tab pattern; the fixed tab grid is the layout risk.

## What to build

Mods get a **Review** tab with the waiting count in its label. It lists the queue in server order. An item opens a dialog with its details and a content download. **Approve** puts it live. **Reject** runs `QuarantineDialog` for a new listing or a confirmation for a resubmission, then opens the message composer with the quarantine template. Updates in the dialog are ticket 09.

## Acceptance criteria

- [ ] The tab shows for `canModerate` users only, with the count in its label like Reports.
- [ ] The tab grid column counts change for admins and mods, and `admin-panel-widths.spec.ts` passes with the new tab.
- [ ] Queue rows show kind, name, author, age, type and a contest marker, in server order.
- [ ] Approve removes the row and drops the count.
- [ ] Rejecting a new listing goes through `QuarantineDialog`; a resubmission goes through a confirmation; both open the composer filled from the route's answer.
- [ ] A `409` shows that another mod handled the item.
- [ ] Approve and reject are hidden on items the staff ladder forbids.
- [ ] The five review audit actions get labels, a pill style, filter entries, and open the listing from `target_id`.
- [ ] The tab and the item dialog have `devRoutes` entries.
- [ ] Async writes check `useMountedRef`; a test unmounts mid-request.
- [ ] Frames: `.scratch/frames/review-tab-{light,dark}.png` and `.scratch/frames/review-item-{light,dark}.png` at desktop width.
- [ ] A changelog fragment covers the staff-facing change.
