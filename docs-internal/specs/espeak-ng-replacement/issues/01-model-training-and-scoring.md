# 01: Model Training and Scoring

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Heavy on judgment: this ticket holds the provenance record and freezes the bar. Trial scripts and weights are in `.scratch/espeak-ng-replacement/`, and they are a starting point only.

## What to build

Anyone can rebuild the phoneme model from the repo and score any pipeline against the bar, with no eSpeak installed.

- The training script lands with the pinned CMUdict revision, its license text, and the seed. It trains on primary CMUdict entries only, with the Q9 shape.
- This ticket owns the mapping from CMUdict to Kokoro notation, including flaps, as data that Ticket 03 reuses.
- A retrained model is exported to ONNX at half precision and committed, ready for Ticket 03 to load. The trial weights are not carried over.
- The frozen word sets land as words only: the 1,500 unknown words, the known-word set from bundled world prose, the 40 strange words, and the 97 fantasy words.
- eSpeak's numbers are stored as results while it is still installed, so the scoring script does not need it afterward. This includes British numbers for Ticket 05.
- The scoring script fetches WikiPron at run time. It commits nothing derived from WikiPron pronunciations.
- The rating page generator lands too: blind clips, with ratings carried for identical strings.

Ask the user for a GPU window before training. Do not start a run mid-session.

Rulings: Q5, Q6, Q9, Q11, Q13, Q16. Spec sections: Provenance, WikiPron.

## Acceptance criteria

- [ ] Training reads only the pinned CMUdict revision, and the revision and seed are recorded in the repo.
- [ ] No WikiPron pronunciation, Misaki data, or eSpeak output is committed, except eSpeak's stored scores. A search of the committed data confirms it.
- [ ] The ONNX model at half precision scores within 0.5 points of eSpeak's 16.0 phoneme error on the 1,500 unknown words. The number is quoted in the ticket.
- [ ] ONNX output is compared with the PyTorch output over the frozen sets, and the difference count is quoted.
- [ ] The committed model's size and gzip size are quoted.
- [ ] The scoring script runs with `phonemizer` absent, and it reports exact and phoneme error for a given pipeline.
- [ ] A test proves the mapping handles stress, flaps, and diphthongs against known CMUdict entries.
