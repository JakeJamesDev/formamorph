# 02: Coref Host and Mention Reading

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The two modules that turn a finished passage into a Mention Reading, with no UI yet.

- **Coref Host:** a worker built through `createWorkerClient`.
  - Input: one passage. Output: clusters as character spans.
  - It owns tokenization, the two-graph run, top-k pruning, the LingMess category masks for the big model, and cluster building. These come from the fastcoref host code that the Python evaluation used.
  - It builds against the graph contract in the scratch export. Ticket 01 keeps that contract.
- **onnxruntime-web version:** the bundled transformers.js copy is an older dev build, and 1.31.1 is the measured version. Decide between a direct dependency and moving the shared copy forward. Record the reason in the ticket.
- **Mention Reading:** a pure module, `(passage text, clusters, cast entities, scene context) → reading`.
  - The reading lists linked mentions (span, entity id) and quote speakers (quote span, entity id or none).
  - Cluster naming uses the existing entity matchers and follows the proved combination rules:
    - names come from parser hits that end a mention, distinctive head words, aliases and Stranger Name words;
    - a head that two cast members share names nobody;
    - one-word person names keep the capital guard;
    - "I'm <name>" ties to the speaker's "I".
  - Speaker attribution picks the mention at a speech verb attached to the quote. If there is none, it takes the nearest preceding subject mention in the paragraph. Otherwise the speaker is none.
- **Changelog:** no fragment, because nothing changes for the player.

## Acceptance criteria

- [ ] Host test: recorded graph outputs from the Python reference stand in for the sessions. The clusters for real passages equal the Python clusters.
- [ ] The Mention Reading tests port the gold sets. With e120 clusters, the scores match or beat the evaluation: blind set names 75/81, descriptors 24/43, pronouns 110/136, traps 34/44, presence 27/29.
- [ ] A quote-speaker gold set exists, with at least 60 quotes from real narration. The ticket reports its score.
- [ ] Each naming rule has a guard test, proved by reinstating its bug.
- [ ] A browser check outside the gates runs the host in Chrome on WebGPU and WASM with real graphs, and reports parity.
