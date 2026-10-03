# 06: Formamorph Implement Protocol

Status: ready-for-human
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Rulings Q2, Q3, Q15; Implementation Decisions › Project side)

Model rationale: doc and config edits that follow the global doc from ticket 05.

## What to build

Formamorph's Implement protocol uses the worktree flow:

- Rewrite steps 4–7 around the review in the worktree, prepare, and exit. The guarded amend stays only for main-checkout work.
- Keep the FormamorphServer copy of the protocol doc identical.
- Add a gate config file that lists the four gates.
- Set the `union` merge driver for the changelog in `.gitattributes`.
- Draft the text for the project CLAUDE.md "Parallel sessions" and "Commits" sections in chat, for the user to apply. Only the user edits that file.

## Acceptance criteria

- [ ] The Implement protocol describes the worktree flow and matches the FormamorphServer copy.
- [ ] Prepare in a Formamorph ticket worktree runs typecheck, lint, test, and build from the gate config.
- [ ] `git check-attr merge docs/Changelog.md` reports `union`.
- [ ] The CLAUDE.md draft text is in the final reply, and the file itself is unchanged.
