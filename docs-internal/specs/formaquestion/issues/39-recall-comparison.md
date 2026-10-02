# 39: Search recall comparison

Status: ready-for-agent
Blocked by: 38, 41, 42
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

The user gets numbers to pick how the search reaches a section from the player's own words (Q67). In ticket 37, the right section reached the model for 60% of answers. The 80% bar needs about 93%, because answers are 86% correct when the section arrives. Player words often do not appear in the section: "folder" means Group, "go back three moves" means rewind. This ticket measures. It changes no shipped behavior.

**A fresh blind question set.** Ticket 26's 125 questions are now known, so a fix tuned on them proves nothing.

- Write at least 60 new English task and follow-up questions in player words, covering every guide page.
- Write each one from the page and section headings only, before reading the section text, as ticket 26 did.
- Key each question to its right sections only. Recall needs no answer facts.
- Keep the set apart from ticket 26's set. No approach may be tuned on it.

**Approaches.** Measure each on both sets:

| Approach | What it is | How to measure |
|---|---|---|
| Keyword search (control) | The shipped search, after tickets 38, 41 and 42 | Offline |
| Semantic search | Rank sections by meaning with the shipped semantic-memory embedder: section vectors built at build time, the question embedded on the device | Offline |
| Hybrid | Keyword and semantic ranks merged | Offline |
| AI picks sections | A first request sends the section headings and asks which sections answer the question; the app sends those sections | Default cloud model, 5 runs |
| Bigger word map | Authored keyword lines (Q47) grown with player synonyms, written without reading either question set | Offline |

**Report.** A table per approach and set:

- right section in the top 5 (recall@5), and right section first
- added latency, and added tokens per question
- the download size and memory cost, for any approach that needs a model on the device
- whether it works on every endpoint, and with no network

Then recommend one approach, or a mix. The user picks. Write no product ticket here.

Recommended model rationale: the blind set and a fair comparison decide whether the numbers mean anything.

## Acceptance criteria

- [ ] A blind set of at least 60 questions covers every guide page, each written from headings only and keyed to its right sections
- [ ] Every approach is measured on both sets with the same recall scorer, and the cloud one has 5 runs
- [ ] The report table holds recall@5, top-1, latency, tokens, download size and endpoint reach per approach
- [ ] No shipped behavior changes, and no approach was tuned on the blind set
- [ ] A recommendation is in the handover, and the status moves to `ready-for-human` for the user's pick
