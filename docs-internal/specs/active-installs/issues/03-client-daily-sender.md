# 03: Client Daily Sender And Settings Switch

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/active-installs/spec.md` (Client)

Model rationale: several gates that each decide whether an id leaves the device, the age gate among them, plus a new setting.

## What to build

The app sends `POST /api/active-installs` once per UTC day, on start or when it regains focus, after the player passes the age gate. A new Settings switch, on by default, turns it off. The server half is ticket 01. This ticket tests against a faked fetch and needs no server.

## Acceptance criteria

- [ ] It sends once per UTC day by the device clock, and again after the day changes.
- [ ] A failed send is dropped silently, and the next focus that day tries again. No list of past days is kept.
- [ ] With the switch off, nothing is sent, and turning it off between two attempts stops the second.
- [ ] A build without a community server, or with guest likes off, sends nothing.
- [ ] Before the age gate is passed, and after it is failed, nothing is sent.
- [ ] When storage refuses to keep the Install id, nothing is sent.
- [ ] The request carries the Install id and client headers, and no credential or body.
- [ ] The sender mounts after the client-version gate, so the client header is always present.
- [ ] The switch is on by default, also for an existing install after the update, and its label follows the writing guide.

For you: check that the switch's label and place in Settings read clearly.
