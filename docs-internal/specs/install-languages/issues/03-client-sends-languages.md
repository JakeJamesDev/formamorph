# 03: Client Sends The Languages

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/install-languages/spec.md` (Client)

Model rationale: a small mapping module and one body on an existing, well-tested sender.

## What to build

The Daily Send adds a JSON body `{ deviceLanguage, aiLanguage }`. The Device Language comes from `navigator.language`. The AI Language maps the setting to a code through one module beside `COMMON_LANGUAGES` in `src/lib/languages.ts`. This ticket tests against a faked fetch and needs no server.

## Acceptance criteria

- [x] The body carries `deviceLanguage` and `aiLanguage`, and no other field. The request still carries no credential. Tests `sends a body with the two languages and nothing else`, `carries the Install id and client headers, and no credential`.
- [x] `pt-BR`, `zh-Hant-TW` and `fr` send `pt-BR`, `zh-TW` and `fr`. An unparsable value sends `unknown`. `languages.test.ts`, `deviceLanguageCode` table, which also covers `und`.
- [x] Blank, `English` and ` english ` send `en`. `French` sends `fr`. `pirate speak` sends `other`, and the raw text appears nowhere in the request. `aiLanguageCode` table and `keeps typed AI Language text out of the whole request`.
- [x] Every entry in `COMMON_LANGUAGES` has a code, and a test fails when one is added without one. `has a code the server accepts for every suggestion, one each`; adding `Swahili` turned it red.
- [x] The sender reads both values at each attempt, so a changed AI Language shows in the next day's send. `reads both languages at each attempt`, and `sends the AI Language setting as it is at each attempt` through the real settings.
- [x] The Daily Check-In info text names the device language and the AI Language choice, and says typed text is never sent. `names both language values in the Daily Check-In list…`; read in the popover on the dev-router.

## Landed

**Not verified**

- Nothing is unticked. No send ran against a real server. The client codes match the server's list as read from its source.

**For you**

- Read the **Daily Check-In** info text under **Settings → Data → Privacy** and judge its wording.
