# 03: Text to Phonemes

Status: ready-for-agent
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The core of the effort and the one test seam. Browser model load and per-word speed are unmeasured, so measure them early.

## What to build

American voices speak through the new pipeline. One deep module takes text and a voice's accent and returns the phoneme string. Each word takes the first source that has it: word table, CMUdict, compound split, then the model.

- The word table starts with the 20 accepted entries in the ear test record. It is plain data.
- A compound splits into two parts of at least 3 letters, both in CMUdict, and the second part takes secondary stress. The common-word list comes from CMUdict, because the trial's WikiPron list cannot ship. Check this list for false splits: the trial split Archon as arc + hon, and it passed by chance.
- Text cleanup handles numbers, abbreviations, and initialisms, which eSpeak did on its own.
- The model file ships in web, desktop, and Android builds, and it loads on first Text to Speech use.
- For a word with several CMUdict variants, use the first one here. Ticket 04 adds the picks.
- British voices keep using the old phoneme step here. Ticket 05 moves them.

Rulings: Q5, Q9, Q12, Q15. Spec sections: Text to phonemes, Text cleanup, Compound split, Model, Word table, Loading.

## Acceptance criteria

- [ ] On the seam: a word table entry beats CMUdict, CMUdict beats a split, and a split beats the model. Each case fails when its branch is removed.
- [ ] On the seam: words that must not split stay whole, and Emberwatch splits.
- [ ] On the seam: numbers, common abbreviations, and initialisms produce spoken phonemes.
- [ ] A test proves every word table entry uses only symbols Kokoro accepts.
- [ ] The known-word and unknown-word scores are quoted, each within 0.5 points of eSpeak's 1.9 and 16.0.
- [ ] Model load time and time per unknown word are measured in the preview and quoted.
- [ ] The model file loads with no network in the desktop build's file layout. How it was checked is quoted.
- [ ] The main bundle does not contain the module or model. A build output read confirms it.
- [ ] A changelog fragment is added.

For you: a rating page for clips whose phoneme string changed since your last pass. The strange words must reach at least 30 of 40 and the fantasy words at least 80 of 97.
