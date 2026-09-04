# 08 — Assemble the spec & implementation tickets

Type: task
Status: done
Blocked by: 03, 04, 05, 06, 07

## Question

The destination: fold every resolved decision into `docs-internal/specs/contest-events/spec.md` (client + server, with a HANDOFF section for FieryLion covering compatibility and rollback) and slice implementation tickets under `issues/` per the issue-tracker conventions. The map closes when this resolves.

## Answer

Resolved 2026-08-20. [spec.md](../spec.md) written from tickets 01–07 (template: problem/solution,
39 user stories, implementation + testing decisions, out-of-scope, HANDOFF). Three residual calls
settled by the user this session:

- **Ticket 07**: FieryLion heads-up confirmed done — additive schema + boot migrations accepted;
  recorded in 07, resolved.
- **Archive browsing** (the map's last fog item): selector dropdown in the contest tab's slim bar
  once >1 ended contest exists; active contest default.
- **Test seams**: existing seams only (server supertest HTTP / client RTL component tests) **plus**
  one Playwright E2E flow (publish-with-entry → contest tab) outside the four gates.

Implementation tickets sliced, all `ready-for-agent`: [09 server events layer](09-server-events-layer.md) →
[10 admin CRUD/audit](10-server-events-admin-api.md) → [11 entry mechanics](11-server-entry-mechanics.md);
[12 client events layer](12-client-events-layer.md) → [13 contest tab](13-client-contest-tab.md) /
[14 publish entry](14-client-publish-entry.md) / [15 admin tab](15-client-admin-events-tab.md);
[16 E2E](16-e2e-entry-flow.md) last. The map is closed.
