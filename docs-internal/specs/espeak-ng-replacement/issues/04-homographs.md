# 04: Homographs

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The license is the hard part. A tagger's lineage must be clean, and its size counts against the Text to Speech chunk.

## What to build

Words such as read, lead, wind, and wound get picked by their sentence. Our own table comes from CMUdict variants, and a small tagger with a named license picks among them. No Misaki data is used, and the `phonemize` homograph file stays out.

Ask the spec session if no tagger meets the license rule at a reasonable size. Record the candidates and the pick in the ticket.

Rulings: Q5, Q14. Spec section: Homographs.

## Acceptance criteria

- [ ] The tagger's name, license, and training data source are recorded, and it has no eSpeak or Misaki lineage.
- [ ] On the seam: each listed homograph gets the expected phonemes in two contrasting sentences, and the case fails when picks are removed.
- [ ] The known-word score is quoted, and it is not worse than Ticket 03's.
- [ ] The added size in the Text to Speech chunk is quoted.
- [ ] The notices cover the tagger.

For you: a short rating page of homograph sentences, compared with the old phoneme step.
