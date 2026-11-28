# 05: Privacy Policy Names The Languages

Status: done
Base: 36797a5
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/install-languages/spec.md` in formamorph (Privacy policy)

Model rationale: legal text that must match what the code stores, word for word.

## What to build

The Daily Send section of `src/assets/policies/privacy-policy.md` names the two new values, and the totals sentence names the language split. It publishes as `acceptance_version=6` with re-accept, right after the server deploy that carries tickets 01 and 02 (user ruling, 2026-11-27).

## Acceptance criteria

- [x] "The send holds three things" becomes five: the hash, the platform, the app version, the device's language, and the AI Language choice as a listed language or "other". (Read the policy text; checked against `AI_LANGUAGES` and the Device Language regex in `src/config/activeInstalls.js`.)
- [x] It says nothing typed in the AI Language setting leaves the device. (Bold sentence in Counting active installs.)
- [x] The totals sentence names the language split. ("A second set of totals splits the same count by device language and by AI Language.")
- [x] The wording follows the writing guide. (Standards review against `docs/Writing-Guide.md`: no violations; AI Language bold on first mention.)
- [x] The deploy notes in `docs-internal/server.md` say to publish with `requireReaccept: true` right after the deploy, and to turn on `active_installs` only after that. (New "Install Languages deploy (once)" section; `--reaccept` and the `published acceptance_version=6` line checked in `src/utils/runPublishPolicy.js`.)

## Landed

**Not verified**

- None. `npm test` passed (67.1 s, exit 0) with the `Last updated: 27 November 2026` seed assertion in `tests/bootSchema.test.js`.

**For you**

- Read the new Counting active installs paragraph in `src/assets/policies/privacy-policy.md` before you publish it.
- The date line says 27 November 2026. Change it if you publish on a later day.
- After the deploy, run the dry run and the `--write --reaccept` publish from `docs-internal/server.md`, "Install Languages deploy (once)". Expect `published acceptance_version=6`. Then turn on `active_installs`.
- The policy does not say that a send with no language (an older app) counts as `unknown`. The review judged it a precision gap, not a missing disclosure.
