# 03: Client Daily Sender And Settings Switch

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/active-installs/spec.md` (Client)

Model rationale: several gates that each decide whether an id leaves the device, the age gate among them, plus a new setting.

## What to build

The app sends `POST /api/active-installs` once per UTC day, on start or when it regains focus, after the player passes the age gate. A new Settings switch, on by default, turns it off. The server half is ticket 01. This ticket tests against a faked fetch and needs no server.

## Acceptance criteria

- [x] It sends once per UTC day by the device clock, and again after the day changes. (`activeInstalls.test.ts` "sends once per UTC day…")
- [x] A failed send is dropped silently, and the next focus that day tries again. No list of past days is kept. ("drops a failed send silently…", "keeps one day…", and the focus and visibility tests in `DailyInstallSender.test.tsx`)
- [x] With the switch off, nothing is sent, and turning it off between two attempts stops the second. (lib "sends nothing with the switch off…"; component test flips the real Settings context between two focus events)
- [x] A build without a community server, or with guest likes off, sends nothing. (lib tests for no server, shell guest likes off, and a refused Install header)
- [x] Before the age gate is passed, and after it is failed, nothing is sent. (lib and component tests with `attested` false; `AgeGateContext` reports `attested` only in its `accepted` state, so `failed` reads as false)
- [x] When storage refuses to keep the Install id, nothing is sent. ("sends nothing when storage refuses…")
- [x] The request carries the Install id and client headers, and no credential or body. (through the real `watchClientVersion` wrapper)
- [x] The sender mounts after the client-version gate, so the client header is always present. (`App.tsx` order; component test renders the same order and goes red when it is swapped)
- [x] The switch is on by default, also for an existing install after the update, and its label follows the writing guide. (component test with other settings stored; DOM read in the preview: Data → Privacy → "Daily Check-In", checked; copy tests green)

Each guard was proven by putting its bug back: 13 mutations, all red.

For you: check that the switch's label and place in Settings read clearly.

## Landed

**Not verified**

- None.

**For you**

- For you: check that the switch's label and place in Settings read clearly. Settings → Data → Privacy, "Daily Check-In" (Simple mode shows it as the last section).
- No send reaches a server until ticket 01 deploys; the client drops the refusal silently.
