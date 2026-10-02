# 44: Switchable search sources

Status: ready-for-agent
Blocked by: 39
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A help question's sections come from up to three search sources, merged into one ranking (Q71). Each source has its own on/off constant. A later Formaquestion settings page will flip them, so nothing built here is removed later. Ticket 39 measured AI picks plus the word map at 84% blind recall@5.

**Sources.**

| Source | What it does | Default |
|---|---|---|
| Keyword | The shipped search with its keyword lines (ticket 43) | On |
| AI picks | One plain chat request before the answer: the section headings and the question, and the model names the sections that answer it. No function call, so it works on every endpoint | On |
| Semantic | Ranks sections by meaning with the shipped semantic-memory embedder. Section vectors are built with the app; the question is embedded on the device | Off |

- One named constant per source in the help session. Like lookup mode (Q53), none is a player setting yet, and none is in a preset or an export.
- The merge is reciprocal rank fusion with the method's standard constant (60), as ticket 39 measured. No number is tuned.
- The merged ranking feeds the existing docs block: the open screen's section, the follow-up rule, the floor, the budget and the cap still apply.
- AI picks:
  - pin its temperature and penalty explicitly, and send reasoning off
  - read only lines the model copies from the list; a reply with no usable line leaves the other sources' ranking alone
  - a failed pick request sends the question with the other sources' ranking; the answer request is never sent twice (ADR-0008)
- Semantic:
  - when the embedding model is not on the device, the source is skipped; it never starts a download
  - the build checks that the section vectors match the embedder's model
- The Search tab stays keyword-only.
- The request's sources still name the sections that reached the model.

**Probe.** Run ticket 39's recall probe on both sets for the shipped defaults, and ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control. Report recall, grounded-correct per kind, added time and tokens per question.

Recommended model rationale: three sources, one merge, and failure paths that must never send a request twice.

## Acceptance criteria

- [ ] Each source switches by its own constant; tests cover every on/off mix
- [ ] With the defaults, a question makes one pick request, then one answer request; a test asserts it
- [ ] A failed or unusable pick still answers from the other sources, with no second answer request; a test asserts it
- [ ] Semantic on with no model on the device is skipped and starts no download; a test asserts it
- [ ] Probe numbers for recall and grounded-correct, fixed vs current build, same batch, are in the handover
- [ ] Four gates green
