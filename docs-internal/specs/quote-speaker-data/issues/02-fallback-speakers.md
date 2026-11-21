# 02: Fallback Speakers for Quotes With None

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Add the spec's four fallbacks, so more quotes get their speaker's color.

Each fallback runs only when the speech-verb, beat and nearest-subject rules leave a quote with no speaker. Each records its own rule name on the quote, in list order: `own-first-person`, `earlier-quote`, `pronoun-subject`, `named-subject` (the spec's wire shape).

- **Own first-person mentions:** when the quote's own first-person mentions sit in a named cluster, the speaker is that entity.
- **Earlier quote:** when an earlier quote in the same paragraph has a speaker, the speaker is that speaker.
- **Unnamed pronoun:** when the tag, beat or subject mention is an unnamed he, she or her, the speaker is the last named clause subject before the quote in the paragraph that isn't the player.
- **Nearest subject:** nearest subject skips unnamed pronouns and takes the last named subject.

Choose the order of the four by measuring them on the fixture set described in the spec's Testing Decisions.

Two limits apply:
- No fallback runs in the speech-verb-only mode that the discovery gate uses (Q73).
- No fallback carries a speaker across paragraphs.

Raise `readingVersion`.

Changelog: add a fragment for the change players see, which is that more quotes are colored by speaker.

## Acceptance criteria

- [ ] For each fallback, a fixture passage gets the right speaker through the reading seam.
- [ ] In every fixture, a quote that a rule already named keeps that speaker.
- [ ] The speech-verb-only reading (the discovery gate) returns the same speaking clusters as before.
- [ ] A quote whose only candidate is in an earlier paragraph stays without a speaker.
- [ ] Breaking each fallback's guard (mutation check) makes a test fail.
- [ ] Fixtures hold no contributed player text. They are written for the tests or taken from the user's own saves.
