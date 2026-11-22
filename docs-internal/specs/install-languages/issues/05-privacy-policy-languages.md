# 05: Privacy Policy Names The Languages

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/install-languages/spec.md` in formamorph (Privacy policy)

Model rationale: legal text that must match what the code stores, word for word.

## What to build

The Daily Send section of `src/assets/policies/privacy-policy.md` names the two new values, and the totals sentence names the language split. The user decides whether the edit publishes as a re-accept.

## Acceptance criteria

- [ ] "The send holds three things" becomes five: the hash, the platform, the app version, the device's language, and the AI Language choice as a listed language or "other".
- [ ] It says nothing typed in the AI Language setting leaves the device.
- [ ] The totals sentence names the language split.
- [ ] The wording follows the writing guide.
- [ ] For you: decide whether this publishes as `acceptance_version=6` with a re-accept.
