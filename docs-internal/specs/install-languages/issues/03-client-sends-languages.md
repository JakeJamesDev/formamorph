# 03: Client Sends The Languages

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/install-languages/spec.md` (Client)

Model rationale: a small mapping module and one body on an existing, well-tested sender.

## What to build

The Daily Send adds a JSON body `{ deviceLanguage, aiLanguage }`. The Device Language comes from `navigator.language`. The AI Language maps the setting to a code through one module beside `COMMON_LANGUAGES` in `src/lib/languages.ts`. This ticket tests against a faked fetch and needs no server.

## Acceptance criteria

- [ ] The body carries `deviceLanguage` and `aiLanguage`, and no other field. The request still carries no credential.
- [ ] `pt-BR`, `zh-Hant-TW` and `fr` send `pt-BR`, `zh-TW` and `fr`. An unparsable value sends `unknown`.
- [ ] Blank, `English` and ` english ` send `en`. `French` sends `fr`. `pirate speak` sends `other`, and the raw text appears nowhere in the request.
- [ ] Every entry in `COMMON_LANGUAGES` has a code, and a test fails when one is added without one.
- [ ] The sender reads both values at each attempt, so a changed AI Language shows in the next day's send.
