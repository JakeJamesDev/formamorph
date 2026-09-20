# 11: Cutover: switch Anonymous Likes on

Status: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 12
Recommended model: N/A — human task, no code
Reasoning effort: N/A
Spec: ../spec.md (Further Notes › Rollout order)

Human-in-the-loop. No code.

## Task, in order

1. Confirm the deployed server carries ticket 12 before the privacy texts go live. The texts promise a removal that ticket 12 makes true.
1. Confirm the public privacy page shows the Anonymous Like paragraph.
2. Confirm the deployed server carries tickets 01–04 and the setting reads off.
3. Confirm the client release that carries tickets 06–08 is live on every channel you support.
4. Switch the setting on.
5. Verify on a current build while signed out: the heart fills, the count rises, and a reload keeps it.
6. Verify the website: the heart still goes to sign-in.
7. Append the changelog entry for the backend work (⚙️ bucket).

## Acceptance criteria

- [ ] Steps 5 and 6 observed and noted under Comments with the date.
- [ ] The setting stays on.

## Rollback

Switch the setting off. New Anonymous Likes stop; stored ones still count.
