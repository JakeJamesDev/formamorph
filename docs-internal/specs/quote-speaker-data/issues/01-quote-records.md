# 01: Quote Records Carry Their Rule and Mentions

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

This ticket prepares the code for the spec's speaker and contribution work. Each quote speaker that the Mention Reading returns also records how it was found:

- **The rule that fired:** `after-subject-verb`, `after-verb-subject`, `before-verb`, `beat`, `nearest-subject` or `none`.
- **The rule's mention:** the span of the mention that rule used, when there is one.
- **First-person mentions:** the spans of the quote's own I, me, my, mine and myself.

The reading module gains a `readingVersion` constant. Raise it whenever the speaker or naming rules change.

No speaker changes in this ticket. Quote colors look exactly as before.

## Acceptance criteria

- [ ] Each quote from the reading carries its rule, its rule's mention span (or none) and its first-person mention spans.
- [ ] Tests at the reading seam cover each rule, a quote with no speaker, and a quote with first-person mentions.
- [ ] Every existing reading test passes unchanged, so the speakers are the same as before.
- [ ] The reading exports a `readingVersion` constant.
