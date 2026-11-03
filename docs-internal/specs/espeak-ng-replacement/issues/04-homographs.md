# 04: Homographs

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The license is the hard part. A tagger's lineage must be clean, and its size counts against the Text to Speech chunk.

## What to build

Words such as read, lead, wind, and wound get picked by their sentence. Our own table comes from CMUdict variants, and a small tagger with a named license picks among them. No Misaki data is used, and the `phonemize` homograph file stays out.

Ask the spec session if no tagger meets the license rule at a reasonable size. Record the candidates and the pick in the ticket.

Rulings: Q5, Q14. Spec section: Homographs.

## Acceptance criteria

- [x] The tagger's name, license, and training data source are recorded, and it has no eSpeak or Misaki lineage. `compromise` 14.19.0, MIT, rule-based with no training corpus. See "Tagger" below, including one WordNet note and what could not be checked.
- [x] On the seam: each listed homograph gets the expected phonemes in two contrasting sentences, and the case fails when picks are removed. `homographs.test.ts`: 51 words. Ignoring picks and each of the other mutations failed a test, and a comment-only control failed 0.
- [x] The known-word score is quoted, and it is not worse than Ticket 03's. `scoreCli.mjs --module testing/g2p/pipeline.ts`: **known 92.6% exact, 1.9 error; unknown 38.6% exact, 14.9 error**, equal to Ticket 03.
- [x] The added size in the Text to Speech chunk is quoted. `TTSModal` chunk, app build against one with the tagger stubbed: **278,099 bytes, 123,509 gzipped**. The tagger appears in no other chunk.
- [x] The notices cover the tagger. `THIRD-PARTY-NOTICES.md` lists `compromise`, `efrt`, and `suffix-thumb`, all MIT.

For you: a short rating page of homograph sentences, compared with the old phoneme step.

## Tagger

| Candidate | License | Data source | Result |
|---|---|---|---|
| **`compromise` 14.19.0, picked** | MIT | Rule-based, with a lexicon in the package. No training corpus. | Most contrasts right. 127 KB gzipped alone. |
| `wink-pos-tagger` 2.2.2 | MIT | `wink-lexicon` says it holds data derived from WordNet and fnTBL. | Missed "He wound the rope" and "She gave him a present". Its lexicon package is 12.6 MB unpacked. |
| `en-pos` 1.0.16 | MIT | `en-lexicon` starts from Eric Brill's lexicon. Scored on Penn Treebank. | Tagged every "wound" as a past verb. Pulls 7 MB of name and city lists. |
| `pos` 0.4.2 | LGPL | Not read. | Out: its license is LGPL. |

**Lineage of `compromise`.** A search of its `src`, `efrt`, and `suffix-thumb` finds no eSpeak, Misaki, or CMUdict. It returns tags and no phonemes.

- One suffix list, `src/2-two/preTagger/model/patterns/endsWith.js`, says "built using wordnet". WordNet has its own permissive license.
- Upstream names no other source for its lexicon. That part rests on the package contents, not on a statement from the author.

## Landed

Our table is `src/lib/tts/g2p/homographs.json`: word, sense, and CMUdict variant number. The tagger gives the sense, and `homographs.ts` corrects its common misses by context: a determiner before the word, a subject pronoun before it, and past tense after a singular subject.

- `parseDictionary` keeps `word(n)` entries for table words only, and the word table still beats a pick.
- A bare "read" now says "reed", because the tagger reads it as a verb. The Ticket 03 test that pinned first-variant "read" now pins "either", which has no table row.
- The `kokoro-js` notice stays in the generated list by hand. The generator drops it, because Ticket 02 took the package out of the module graph, and we still ship adapted code. Ticket 06 moves it to the hand-kept section. Until then, any `gen-notices` run removes it again, so restore it from git.
- Coverage: `homographs.ts` 100% of lines, 93.1% of branches.

**Not verified**

- Nothing in the criteria. The modal was not opened, because the seam tests and the build read cover this change.

**Known limits**

- A sense the part of speech cannot tell apart stays on its noun row: "took a bow" says "boh", "a tear in the cloth" says "teer", and "A lead weight" says "leed".
- A word named in quotes can read as a verb: "They called it 'wind'" says "wined".
- A bare "read" after "I", "they", or a plural noun with no other clue reads as present: "The boys read."
- A possessive skips the pick and takes the first variant: "The wound's edge" says "wownd's". "Well-read" says "reed".
- The tagger can miss a bare plural or a capital at the start of a sentence: "Records burned" takes the verb form, and "Polish knights rode" says "pollish".
- Words with no second CMUdict entry for the other sense have no row, such as house, row, and sewer. "minute" has no row because the tagger always calls it a noun.

**For you**

- Rate `.scratch/espeak-ng-replacement-04/frames/rating-homographs/index.html`. It compares our picks with the old phoneme step on 20 sentences, blind. No bar applies.

## Owner's Ratings

Our picks 18 of 20, against the old phoneme step's 15 of 20, rated blind. No bar applies.
