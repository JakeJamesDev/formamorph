# 08: Server Autocomplete Searches

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q15, Q17); server spec: Autocomplete reads

Repo: FormamorphServer

## What to build

Two signed-in reads for the editor's autocomplete. A username prefix search that ranks the given thread's reporter and commenters first. A thread search by number prefix or title words, over threads the caller can read.

## Acceptance criteria

- [ ] The username search matches case-insensitively by prefix, ranks the thread's participants first, caps its result count and is rate-limited.
- [ ] The thread search matches number prefix or title words, returns number, title, type and status, and never returns a thread the caller cannot read.
- [ ] Both refuse a guest.
