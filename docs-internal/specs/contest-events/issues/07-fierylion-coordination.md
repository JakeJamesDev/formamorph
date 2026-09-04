# 07 — FieryLion coordination

Type: task
Status: done

## Question

HITL task (only the user can do this): give FieryLion an early heads-up on the contest/events feature and confirm the deploy expectations before the spec is finalized:

- The planned additive schema changes (new `events` table, entry storage) and boot-migration approach.
- Whether their original client consuming `workshop.fierylion.com` tolerates the additions (should be fully additive — confirm).
- Deploy/rollback expectations and rough timing; whether they want contest admin rights (roles are mod/dev/admin — which do their staff hold?).

Record what was agreed as the answer; the spec's HANDOFF section builds on it.

## Answer

Confirmed by the user 2026-08-20 (out-of-band, recorded during spec assembly):

- Heads-up delivered; FieryLion is on board with the events/contest feature.
- **Fully additive schema confirmed tolerable** for the deployed original client — new `events` table + nullable `contest_event_id` column on `worlds`, applied via the established boot-time idempotent migration pattern.
- Deploy stays the established flow: work on the fork → HANDOFF.md-style handoff → FieryLion deploys; rollback = restore the pre-deploy backup (migrations are additive, so rolling back the code alone is also safe).
- No bespoke constraints or timing requirements were recorded. Staff-rights question resolves via the contract itself: winner pick = any staff, event CRUD = admin — their staff's existing roles map directly.
