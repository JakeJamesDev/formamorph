# 05: Privacy texts

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium
Repo: FormamorphServer and formamorph
Spec: ../spec.md (User Stories › Privacy)

Model rationale: short, but it is legal-facing text that must match what the code does. It does not go to a smaller model.

## What to build

The server's Privacy Policy source text and the public privacy page both say what liking while signed out stores. The two texts match.

## Acceptance criteria

- [ ] The text says: liking while signed out stores a random id for this copy of the app, a salted hash of the network address, and a coarse browser family.
- [ ] It says the hash is kept 90 days, then blanked, and the like stays.
- [ ] It says the hash is used only to limit and detect abuse.
- [ ] It says how to remove an Anonymous Like: press the heart again on the same copy of the app.
- [ ] It says that signing in moves those likes to the account.
- [ ] The paragraph reads the same in both places. The user reviews the wording before it goes live.
- [ ] The policy version is not bumped by the agent; whether existing users see the prompt again is the user's call. Say so in the hand-over.
