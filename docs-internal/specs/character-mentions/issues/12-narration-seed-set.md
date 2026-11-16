# 12: Narration Seed Set

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

About 100 narration passages from the bundled worlds, pre-labeled by the current big model, for the user to correct. Once corrected, they become the narration dev set and join the corpus.

- **Passages:** generate them by playing bundled worlds on the cloud default endpoint. Cover several casts, same-gender pairs, descriptors and dialogue.
- **Pre-labels:** label the passages with the e120 model, in the kit's corpus format.
- **Correction view:** a static page in the kit, not the app. It shows each passage with its clusters, lets the user fix links, and saves the file.
- **Privacy:** never include personal data or real player text.

## Acceptance criteria

- [x] About 100 pre-labeled passages exist in the corpus format, each with its source world and turn recorded. 102 passages from seven worlds (cloud `default`, batch 2611151725), labeled by the e120 int8 export, in `coref/seed/dev.jsonl` of the data repo (commit 3e14bbc); each carries `source.world`, `run`, `turn` and `action`.
- [x] The correction view loads the file, edits links and saves a valid corpus file. A Playwright run loaded a file, moved a mention, added a nested one, marked it reviewed and saved; `parseFile` read the download back with no errors. `seedEditor.test.ts` covers the edit logic.
- [x] The kit scores a model against the corrected set as the narration dev set. With a copy marked reviewed, `corpus.py` wrote 102 narration-dev documents and `score.py` scored the small export (narration-dev F1 0.7354). The real file, all unreviewed, leaves narration-dev out.

For you: correct the pre-labeled passages in the correction view.

## Landed

**Not verified**

- The F1 above scores against uncorrected e120 labels. It proves the path, not a dev score.

**For you**

- Correct the pre-labeled passages in the correction view: open `testing/coref/seed-editor.html` in Chrome, then **Open** `../formamorph-training-data/coref/seed/dev.jsonl`. Mark each passage reviewed (`R`); only reviewed passages join narration-dev (Q49). Commit the file in the data repo.
- The batch leans on Emberwatch (26) and Valentines (26); Sugarscape and Veilwood give 4 each. Say if you want a different mix (`seed-worlds.ts` run counts).
