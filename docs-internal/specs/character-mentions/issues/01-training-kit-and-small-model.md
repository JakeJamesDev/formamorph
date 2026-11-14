# 01: Training Kit and Small Model

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A tracked training kit that trains both architectures on one shared corpus: LingMess for the big model, FCoref for the small one. This ticket also produces the first clean small model. The scratch kit from the evaluation is the reference. Move its working parts into the repo, and leave corpora and weights untracked.

- **Corpus conversion:** LitBank (80/10/10 split) plus any number of extra corpus files in one annotation format. The seed set (ticket 12) and accepted contributions (ticket 09's export) use the same format.
- **Training and scoring:**
  - Training covers both architectures, is resumable, and keeps the GPU guard.
  - Scoring covers the LitBank dev split, the narration dev set when it exists, and our gold sets (real narration, hard set, blind set).
  - A report compares a run against the current published weights.
- **Export:** graphs follow the browser graph contract.
  - Graph A (encoder and mention logits) takes `input_ids`, `attention_mask` and `position_ids`. Graph B takes the antecedent inputs.
  - The browser fixes are mandatory: `position_ids` comes in as an input, LingMess's three-operand Einsum becomes MatMuls, and weights are weight-only int8.
  - This ticket owns the graph contract and documents it for ticket 02.
- **Manifest generation:** per model, a version, file URLs, sizes, SHA-256 hashes and the minimum host version. This ticket owns the manifest format; ticket 03 reads it.
- **Publish gate:** the kit refuses to write a manifest for a model that scores below the current published one on any dev set.
- **Small model:** train the FCoref-architecture model on LitBank. The GPU run happens only in a window the user agrees to, so ask before starting it.
- **Changelog:** no fragment, because nothing changes for the player.

## Acceptance criteria

- [ ] The kit trains, scores and exports the existing e120 checkpoint. Its exported graphs match the scratch export's outputs on the parity case.
- [ ] A small FCoref model trained on LitBank only exists, with its scores on all sets reported in the ticket.
- [ ] Exported graphs of both models pass the browser parity bench on WebGPU and WASM. The bar is top-k mention overlap 1.0 and antecedent argmax agreement 1.0 against CPU fp32.
- [ ] The manifest generator writes a manifest for both models, and the publish gate refuses a model that scores lower.
- [ ] The kit's README documents the graph contract and the manifest format.
- [ ] No OntoNotes-trained weights serve as a starting point or teacher.

For you: agree on a GPU window for the small-model training run.
