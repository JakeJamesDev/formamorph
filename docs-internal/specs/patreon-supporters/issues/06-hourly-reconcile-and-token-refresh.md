# 06: Hourly Reconcile and Token Refresh

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Staying current; Further Notes › Patreon limits)

Model rationale: a paged read plus token state that must survive a restart. Moderate logic with a few failure paths.

## What to build

Every hour the server reads the full campaign member list and corrects every link. A webhook that never arrived is repaired within the hour.

The creator token refreshes itself, and the new token pair survives a restart.

## Acceptance criteria

- [ ] A reconcile job runs once at boot and then on the existing hourly sweep.
- [ ] The job pages through the member list with the cursor until no page remains.
- [ ] Each link gets the tier and pledge start that the list gives. A link whose member is absent from the list gets no tier and stays linked.
- [ ] A failed read changes no link. The job logs the failure and waits for the next hour.
- [ ] The creator token and refresh token live in the server's settings store, seeded from the environment on first use.
- [ ] The Patreon module refreshes the token from `expires_in` before expiry, and on an authorization failure, and stores the new pair.
- [ ] Tests run the job against the fake Patreon module: a wrong tier corrected, a departed member cleared, two pages read, a failed read leaving the links unchanged, and a refresh that persists.
- [ ] The job leaves no timer or handle open in tests. The suite time is stated in the hand-over.
- [ ] Server gates green.
