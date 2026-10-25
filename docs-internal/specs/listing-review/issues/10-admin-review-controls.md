# 10: Admin Review Controls

Status: ready-for-agent
Blocked by: 04, 08
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Admin controls, Review tab, Audit log)

Model rationale: a toggle, a switch and a list view on existing surfaces; little new logic.

## What to build

Admins toggle **Trusted** on an account in the Users tab and see a trusted marker in the list. The server settings tab gets a **Listing Review** switch. The Review tab gains an **Auto-Approved** view that lists recent auto-approvals and opens each listing.

## Acceptance criteria

- [ ] The Trusted toggle and marker show for admins only; mods never see the toggle.
- [ ] The toggle calls the trust routes and reflects the answer.
- [ ] The Listing Review switch writes `listing_review`; its help line says pending items stay in the queue when it is off.
- [ ] The Auto-Approved view lists `/api/reviews/auto` newest first; each row opens its listing.
- [ ] The trust audit actions get labels, a pill style and filter entries.
- [ ] The Auto-Approved view has a `devRoutes` entry.
- [ ] Frames: `.scratch/frames/trusted-toggle-{light,dark}.png` and `.scratch/frames/auto-approved-{light,dark}.png` at desktop width.
