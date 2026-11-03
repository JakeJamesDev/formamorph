# Spec: eSpeak NG Replacement

Status: ready-for-agent
Spec session: espeak-ng-replacement — spec

This spec records a reading of the licenses, not legal advice.

## Problem Statement

Text to Speech turns text into phonemes with eSpeak NG, which is GPL-3.0. It reaches us through `phonemizer`, which `kokoro-js` depends on and inlines, and it ships in the Text to Speech chunk of every build.

Formamorph is heading to a paid Steam release under its own EULA, and the public repo is PolyForm NC. GPL code in that build conflicts with both. The Credits effort named eSpeak NG and its license text in the notices, which is honest but does not resolve the conflict.

The obvious replacements carry the same problem:

- **Misaki's silver lexicon** is `espeak-ng` output run over a word list, by its owner's statement. Its gold source is unnamed.
- **The Misaki fallback model** was trained on gold plus 90% of silver.
- **`phonemize`'s homograph table** is imported from Misaki gold and silver.

Players must also not lose anything they can hear. eSpeak said Emberwatch correctly when three replacement candidates did not, and many fantasy words are absent from every open dictionary.

## Solution

Text to Speech keeps its voices, settings, and behavior. Only the step that turns text into phonemes changes, and no GPL or eSpeak-derived code or data stays in any build.

Each word takes the first source that has it:

| Order | Source | What it covers |
|---|---|---|
| 1 | Word table | Hand-checked words, accepted by ear. Beats every other source. |
| 2 | CMUdict | General English, with our own homograph picks. |
| 3 | Compound split | Two known words, such as Emberwatch. |
| 4 | Regular ending | A regular -s or -'s on a word from the sources above, such as wyverns. |
| 5 | Our model | Everything else. Trained only on CMUdict. |

British voices keep British pronunciation, through rules applied to this American result.

## Rulings

| # | Ruling |
|---|---|
| Q1 | Replace eSpeak NG. Remove `phonemizer` and `kokoro-js`. |
| Q2 | Replace it in every build, not only the Steam build. |
| Q3 | This blocks the Steam release only. It does not block other releases. |
| Q4 | No legal counsel, because no GPL or eSpeak-derived code or data stays. |
| Q5 | CMUdict is the only dictionary and the only training source. No Misaki data. |
| Q6, Q11 | The bar has three parts: phoneme error at most 0.5 points above eSpeak on the frozen word sets, the owner's blind listening pass, and at least 30 of 40 strange words. The strange-words set grows with words from world text. |
| Q7 | The eight British voices stay, using rules over the American result. The same bar applies. |
| Q8 | Old builds get replaced at the next release. No early takedown. |
| Q9 | The model is 256 wide with 2 layers, 4 heads, and dropout 0.3, stored at half precision, with compound splits. |
| Q12 | The model ships in each build and loads on first Text to Speech use. |
| Q13 | The training script, pinned CMUdict revision, and scoring test stay in the repo. |
| Q14 | Homographs use our own table from CMUdict variants, plus a small tagger with a named license. |
| Q15 | A hand-checked word table comes before CMUdict. It starts with the 20 accepted entries in the ear test record. |
| Q16 | The bar adds at least 80 of 97 fantasy words, and no fewer than eSpeak's 76. The set grows as words are added. |
| Q17 | Compound parts come from CMUdict with at least 4 letters, plus a short reviewed list of common 3-letter CMUdict words. Rejects arc + hon, hald + ren, tia + mat, and nyx + ara. |
| Q18 | A short plain-data list of function words takes a weak CMUdict form or loses its stress, unless the word ends the phrase. It lands with the American pipeline. The rating page adds sentence clips, with no numeric bar. "have" and "had" have no weak CMUdict form, so they take our own schwa, after the owner rejected the full vowel by ear. |
| Q19 | Before the model, a regular -s or -'s on a table, CMUdict, or split word takes that word's phonemes plus the regular ending. |
| Q20 | The phoneme error bars gate landing. The listening bars are the owner's step after landing, on a page the ticket builds. The ticket stays `ready-for-human` until the owner reports. |
| Q21 | British rules may use a small plain-data list for words no rule can derive. We write each string and accept it by ear. Word table entries stay American and take the rules. |
| Q22 | The owner accepted a 24-word sample for the British fantasy bar, at 22 of 24, because 97 clips are too many to rate. The final pass at Ticket 06 stays. |
| Q23 | Spoken numbers follow the owner's ear: tens and ones run together, -teen words take one main stress, and "ninety" takes a soft t in American. |
| Q24 | "they" and lowercase "will" join the weak forms. "will" stays strong after a determiner, a possessive, or words such as "free", because there it is the noun. |
| Q25 | By the owner's ear: "I" never reduces, "you" stays strong at the start of a phrase, and "with" reduces inside one. |
| Q26 | A passage from play read stranger than eSpeak, because word-by-word scoring cannot see sentence stress. More small words take weak forms, "it" and "them" stay light at a phrase end, and an ending on a listed word comes before a split. |
| Q27 | Dashes reach the engine with spaces around them, because the owner picked that form by ear over no spaces, a comma, and an ellipsis. |

## Measurements

The per-word ratings are in [ear-test-strange-words.md](ear-test-strange-words.md).

**By ear, blind, rated by the owner:**

| Test | eSpeak NG | Without word table | With word table |
|---|---|---|---|
| Fantasy words | 76 of 97 | 80 of 97 | 97 of 97 |
| Strange words | 33 of 40 | 35 of 40 | 39 of 40 |

The word table entries were written for the words that failed. So the last column shows coverage, and new words will score closer to the middle column.

**Unknown words:** 1,500 words that are in WikiPron US and absent from CMUdict, `ipa-dict`, and Misaki.

| Engine | Exact | Phoneme error |
|---|---|---|
| eSpeak NG | 35.8% | 16.0 |
| Misaki fallback model | 39.4% | 15.4 |
| Chosen model, no splits | 40.1% | 14.9 |
| Chosen model, with splits | 38.8% | 15.3 |
| Landed American pipeline | 38.6% | 14.9 |

Compound splits cost a little here, and they win by ear on names: 13 of 13 against eSpeak's 11 of 13.

**Known words:** 77% of the tokens in bundled world prose, scored against WikiPron US.

| Engine | Exact | Phoneme error |
|---|---|---|
| eSpeak NG | 92.6% | 1.9 |
| CMUdict, with `phonemize` for gaps | 92.5% | 1.9 |
| Landed American pipeline | 92.6% | 1.9 |

**British voices:** scored against WikiPron UK. The rules were written while reading misses on the unknown set, so 13.6 is not fully held out.

| Set | eSpeak NG exact / error | Landed pipeline exact / error |
|---|---|---|
| Unknown | 42.4% / 14.4 | 44.4% / 13.6 |
| Known | 91.7% / 2.2 | 94.8% / 1.4 |

**Size:** the shipped model is 7.99 MB in two files and 6.96 MB gzipped. The dictionary adds 3.62 MB. The first trial reached about 72% on its CMUdict validation split, and dropout moved held-out accuracy more than extra epochs did.

**Speed:** in headless Chromium over a production build, the model loads and answers its first word in 541 ms. An unknown word then takes 21 ms at the median and 33 ms at most. Electron measures 570, 23, and 39 ms.

**Why half the fantasy list needs help:** 49 of the 97 words are not in CMUdict, wyvern among them. Six CMUdict entries also failed by ear: chimera, valkyrie, seraphim, alchemist, liege, and Asgard.

### Not Measured Yet

- The Android build and a packaged desktop build. Both ship the same `dist` files.

## User Stories

1. As a player, I want Text to Speech to keep working with the voices I already picked, so that this change costs me nothing.
2. As a player, I want common fantasy words said correctly, so that wyvern does not break the scene.
3. As a player, I want place names built from common words said naturally, so that Emberwatch sounds like a place.
4. As a player, I want invented names said plausibly, so that a new world still sounds right.
5. As a player using a British voice, I want British pronunciation, so that the voice does not change character.
6. As a player, I want Text to Speech to work offline after its voice model downloads, so that the desktop and Steam builds need no extra service.
7. As a player who never opens Text to Speech, I want the game to start as fast as before, so that I pay only install size for a feature I skip.
8. As a player, I want words such as read, lead, and wound picked by their sentence, so that the narration makes sense.
9. As a player, I want numbers and common abbreviations spoken, so that narration does not skip them.
10. As a player reading the Licenses tab, I want the notices to match what ships, so that the list is honest.
11. As the project owner, I want no GPL or eSpeak-derived code or data in any build, so that the Steam EULA holds.
12. As the project owner, I want a build check that fails if eSpeak returns, so that a dependency update cannot bring it back silently.
13. As the project owner, I want anyone to rebuild the model from the repo, so that its source can be shown.
14. As the project owner, I want the bar recorded as stored numbers, so that it still works after eSpeak leaves the project.
15. As the project owner, I want to add a word to the table after a bad clip, so that a miss gets a direct fix.
16. As the project owner, I want the listening sets to grow with real world text, so that the bar follows what players hear.
17. As a developer, I want Text to Speech to call one small client, so that the view does not know how phonemes are made.
18. As a developer, I want the word table to be plain reviewed data, so that an entry needs no retraining.

## Implementation Decisions

**Kokoro client.** A small client of our own, built on `@huggingface/transformers`, replaces `kokoro-js`. It keeps the two calls Text to Speech uses: load the model, and generate from text with a voice and speed. `kokoro-js` inlines `phonemizer`, so a package alias cannot remove eSpeak. Anything adapted from `kokoro-js` keeps its Apache-2.0 notice, in the source and in the notices after the package leaves. Parity with `kokoro-js` is a one-time check quoted in the ticket. No eSpeak output is committed as a test snapshot.

**Text to phonemes.** One deep module takes text and a voice's accent and returns the phoneme string for Kokoro. It owns text cleanup, word lookup in the order above, homograph picks, stress handling, and British rules. It holds the Kokoro notation mapping, including flaps, which CMUdict does not mark. Function words take weak forms in a phrase (Q18), because eSpeak reduced them and players would hear the loss.

**Text cleanup.** eSpeak handled numbers, abbreviations, and initialisms itself. The new module must handle them too, and the known-word scoring run covers this.

**Compound split.** A word splits into two parts when both are in CMUdict and each has at least 4 letters or is on a short reviewed list of common 3-letter words (Q17). The second part takes secondary stress. CMUdict has no frequency data and holds many surnames, so a false split that remains gets a word table entry.

**Regular ending.** A regular -s or -'s on a known word takes that word's phonemes plus the ending, voiced to match the last sound (Q19). This step needs its own check for false stems, the same as compound splits.

**Model.** A from-scratch BART grapheme-to-phoneme model with the Q9 shape, exported to ONNX as an encoder file and a decoder file, about 7 MB in total. It trains on primary CMUdict entries only. A model loads once and is released with the rest of Text to Speech.

**Word table.** Plain data in this repo: word and phoneme string. We write each entry and accept it by ear. Entries are never copied from Wiktionary, WikiPron, or Misaki.

**British rules.** Our own rules over the American result. `phonemize` is MIT and ships such rules, so we may adapt them with its notice. Its data stays out, and `ipa-dict` `en_UK` stays out because it is GPL-derived. The British word list (Q21) follows the same rule as the word table: we write each string, and none is copied from another source. Words are chosen because they are common and no rule reaches them, never because they miss on a scored set.

**Homographs.** Q14's own table comes from CMUdict variants. The tagger must have a named license and no eSpeak or Misaki lineage. Ticket 04 picked `compromise`: MIT, rule-based, with no training corpus.

**Loading.** The text-to-phoneme code and the model stay in a lazy chunk, loaded on first Text to Speech use, the same as today. The model file ships inside web, desktop, and Android builds.

**Build check.** A check over `dist` fails on eSpeak NG and `phonemizer` markers. It runs where the build gate runs.

**Notices.** The generator drops `phonemizer` and `kokoro-js` when they leave the dependencies. The hand-kept Bundled assets section drops eSpeak NG and its GPL text, and adds CMUdict's BSD-style license and the model.

**Provenance.** The repo holds the training script, the pinned CMUdict file, its license text and hash, and the seed. The mapping to Kokoro notation has one implementation, in TypeScript, and the trainer reads pairs it writes. The shipped model comes from that pinned revision, so it is retrained and rechecked rather than carried from the trial.

**WikiPron.** Its data is CC BY-SA. The scoring script fetches it at run time and nothing derived from its pronunciations is committed. The scoring source is `CUNY-CL/wikipron`, pinned by commit, and the US file at `d282e848` is the same blob the trial used, so the 16.0 stands. The committed sets hold words only, plus token counts for the known-word set, so 1.9 stays comparable. The eSpeak reference numbers are stored as aggregates with their method, and the script that made them does not land. The ear test record keeps its third-party strings as this spec's history.

**Export shape.** World and save files do not change.

## Testing Decisions

A good test here calls the text-to-phoneme module or the client through its public call and checks what comes out. It does not check which internal source answered, except where the order is the behavior.

**One seam.** Text in, phoneme string out, on the text-to-phoneme module. Text to Speech keeps its existing test seam, with the client in place of `kokoro-js`.

| What | How | When |
|---|---|---|
| Lookup order, including a table entry beating CMUdict | Unit test on the seam | Gates |
| Compound split, including words that must not split | Unit test on the seam | Gates |
| Cleanup of numbers and abbreviations | Unit test on the seam | Gates |
| Word table entries are valid Kokoro notation | Unit test over the data | Gates |
| No eSpeak in the build | Build check that must fail when `phonemizer` is put back | Build gate |
| Phoneme error bar | Scoring script against stored reference numbers | By hand, on model or lookup changes |
| Listening bars | Blind rating page, with ratings carried for identical strings | By hand, by the owner, after landing (Q20) |

The scoring script fetches WikiPron, so it stays outside the gates. Prior art is the probe harness and the Credits drift guard.

The fantasy and strange-word bars do not count a table entry written for a failure as proof of the model. The record keeps both columns.

## Out of Scope

- Per-world pronunciation overrides, where authors set how their own names sound. This would change the world export shape, so it is a separate effort.
- New voices, a new Kokoro version, or a different speech engine.
- Taking down old builds (Q8).
- Moving other languages' Text to Speech to this pipeline. Kokoro's voices in the app are American and British today.

## Further Notes

- **Trial artifacts:** the chosen trial model and scripts are in `.scratch/espeak-ng-replacement/`, which is gitignored and is a handoff only. The first ticket moves what must last into the repo.
- **Listening pages:** the rated pages are in `.scratch/phonemizer-listening-test/`.
- **Upstream dispute:** `phonemizer.js` issue 6 disputes that package's Apache label, and no eSpeak revision or build record exists for it. This supports removing it over relabeling it.
- **Remaining ear miss:** Kaelith is the one strange word left. It is invented, so it stays with the model.
