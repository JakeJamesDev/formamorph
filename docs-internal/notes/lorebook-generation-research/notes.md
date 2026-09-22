# Lorebook activation during generation

Research checked September 21, 2026. External findings below come from live primary documentation and source inspection. Implementations were not installed or benchmarked; source-confirmed behavior is distinguished from proposed adaptations.

## Main finding

Other programs have implemented same-reply lore activation. The strongest direct examples stop generation when new output activates lore, rebuild the prompt, then continue the unfinished reply. This changes the orchestration around generation rather than retroactively changing text the model already produced. [KoboldAI generation loop](https://github.com/henk717/KoboldAI/blob/0986f9149025a92f41a4fac24e095dd4923b0142/modeling/inference_model.py#L350-L486), [Oobabooga extension generation loop](https://github.com/Quiet-Joker/Lorebook-Extension-for-Oobabooga/blob/fd43054c0bf09c3f4c02ef0b744b14ec5373e479/lorebook/script.py#L831-L904)

For the red-dragon example, this can load the entry after the phrase appears and guide the rest of that narration. **Inference:** if the model already wrote “The harmless red dragon,” preserving the generated prefix also preserves “harmless.” Correcting the introduction itself requires earlier retrieval or withholding and rewriting provisional text.

## Implemented: stop, retrieve, continue

### KoboldAI United — Dynamic World Info

The current source contains a `dynamic_wi_scanner` stopper. When enabled, it decodes the generated tail, runs context calculation against that new text, subtracts already-known entries, and stops when fresh entries appear. The generation loop rebuilds context using generated text, updates the active-entry set, retains the generated tokens, and continues. Its own code comment explicitly describes stop → insert WI → continue. [Scanner](https://github.com/henk717/KoboldAI/blob/0986f9149025a92f41a4fac24e095dd4923b0142/modeling/stoppers.py#L61-L91), [generation loop](https://github.com/henk717/KoboldAI/blob/0986f9149025a92f41a4fac24e095dd4923b0142/modeling/inference_model.py#L350-L486)

This is a concrete implementation of output-triggered retrieval within one reply, separate from recursion across lore entries. A project discussion from February 2023 also describes Dynamic WI scanning after each generated token. [Project discussion](https://github.com/KoboldAI/KoboldAI-Client/discussions/223)

**Tradeoffs inferred from the code:** repeated scans and context rebuilding add work; the retained prefix cannot be repaired; backend integration matters because the implementation owns the generation loop and token IDs. No timing claim or compatibility claim for every Kobold backend was tested.

### Lorebook Extension for Oobabooga — Mid-Generation Interrupt

This third-party extension implements the same approach at the text-generation-webui generator layer. It yields streamed text, accumulates an output buffer, finds newly triggered entries, updates the world-info block, closes the current generator, and starts another using the accumulated reply as a prefix. The feature is optional; the default interrupt cap is three. Its documentation scopes mid-generation interrupts to chat mode and requires streaming; notebook mode uses the initial scan. [Pinned documentation](https://github.com/Quiet-Joker/Lorebook-Extension-for-Oobabooga/blob/fd43054c0bf09c3f4c02ef0b744b14ec5373e479/README.md#mid-generation-interrupt), [implementation](https://github.com/Quiet-Joker/Lorebook-Extension-for-Oobabooga/blob/fd43054c0bf09c3f4c02ef0b744b14ec5373e479/lorebook/script.py#L831-L904)

Two practical details are worth copying into an eventual design: retain text across chunks so multiword keys can match, and exclude a trailing incomplete word so a partial “worldview” does not prematurely match “world.” The loop also checks user cancellation before restarting. [Buffer and cancellation logic](https://github.com/Quiet-Joker/Lorebook-Extension-for-Oobabooga/blob/fd43054c0bf09c3f4c02ef0b744b14ec5373e479/lorebook/script.py#L847-L900)

**Tradeoffs inferred from the code:** the interrupt cap limits additional work but also limits retrieval opportunities; already yielded text remains visible; each restart needs a correct continuation prompt. This is implementation evidence, not a production-quality endorsement or a measured success rate.

## Implemented: the narrator asks for lore before writing

DeepLore, a SillyTavern extension, takes over generation with a bounded tool loop. The writing model can search lore, receive the results in tool messages, and make another call; a write action submits the final prose. This lets the narrator retrieve information about an intended introduction before committing it. It requires a tool-calling provider. This is model-directed lookup, not automatic detection of keywords in streamed prose. Its separate post-write gap-flagging pass does not correct that prose. [Pinned Librarian documentation](https://github.com/pixelnull/sillytavern-DeepLore/blob/dc2345afa5e580bc8a4df6a37b5774354f6c90ba/docs/librarian.md), [tool loop](https://github.com/pixelnull/sillytavern-DeepLore/blob/dc2345afa5e580bc8a4df6a37b5774354f6c90ba/src/librarian/agentic-loop.js#L246-L490)

**Inference:** this can retrieve red-dragon lore before the first description, but depends on the model choosing a useful search. Search limits bound extra calls. Neither reliability nor latency was benchmarked here.

## Research implementation: predict, retrieve, rewrite

FLARE generates a temporary upcoming sentence, uses it to retrieve supporting material, and regenerates the sentence when low-confidence tokens indicate retrieval is needed. Its instruction-based variant uses explicit search requests and stop/resume orchestration. This is a published retrieval method evaluated on factual generation tasks, not evidence of an RPG lorebook product or measured narrative-quality gains. [FLARE paper, especially section 3](https://aclanthology.org/2023.emnlp-main.495/)

**Proposed adaptation:** draft a sentence privately, scan that draft for newly activated dictionary entries, then regenerate with those entries before publishing it. The trigger would be fresh lore matches, rather than FLARE's token-confidence test. This can correct the introduction itself, including adjectives written before the trigger phrase. Expected costs are additional generation and delayed display; those are architectural inferences, not measured figures. Revised sentences could introduce further terms, so a bounded retry policy would need explicit design.

## Implemented mitigations that address a different stage

### SillyTavern — recursion and semantic activation

SillyTavern documents recursive scanning: the content of one activated entry can activate another. Its example chains a cow's entry to its dog friend's entry. This can preload related entities before they are mentioned directly. It also documents vector-based activation using chat messages as the query, with independent message-window and budget settings. [Official World Info documentation](https://docs.sillytavern.app/usage/core-concepts/worldinfo/)

These documented mechanisms broaden what is retrieved from material already available to the scan. They are not evidence of rescanning the currently streaming reply. **Inference:** linking a mountain's lore to its resident red dragons can preload dragon lore, but spontaneous unrelated introductions can still outrun retrieval. Broader activation also competes for the prompt budget.

### NovelAI — cascading activation and always-on entries

NovelAI documents activation against recent story text, an always-on option, and cascading activation that searches other context entries for keys. These provide anticipatory inclusion when relationships are authored or facts are always needed. The documentation also warns that large numbers of key-relative entries can slow context creation. [Official lorebook documentation](https://docs.novelai.net/en/text/lorebook/)

This is evidence for those specific mitigations, not a claim that every NovelAI model or scripting workflow lacks other mechanisms.

## What this suggests for Formamorph

AI Dungeon explicitly documents the same baseline limitation: a trigger in AI-generated text affects a subsequent output. That is a property of the described generation workflow; the implementations above demonstrate ways to change the workflow. [AI Dungeon Story Cards FAQ](https://help.aidungeon.com/faq/story-cards)

Our current narration prompt scans action/history and rendered location/entity material before planning, then the narration pass uses that assembled prompt. Streaming does not re-run lore selection. [Prompt construction](D:/Documents/GitHub/formamorph/src/lib/turnPipeline/narrationPrompt.ts:78), [dictionary scan](D:/Documents/GitHub/formamorph/src/lib/dictionaryScan.ts), [narration pass](D:/Documents/GitHub/formamorph/src/lib/turnPipeline/turnPasses.ts:402), [pipeline orchestration](D:/Documents/GitHub/formamorph/src/views/GameViewer.tsx:2153)

Three proposals follow, in increasing behavioral scope:

| Proposal | What it addresses | Remaining gap |
|---|---|---|
| Rescan using the existing planner's output before narration | Planned introductions can activate lore in the same turn | Prose can introduce something the plan omitted |
| Watch output, stop, rebuild, continue | Spontaneous mentions can guide the remainder of the reply | Already emitted descriptions remain unchanged |
| Hold one draft sentence, retrieve, rewrite, publish | Can correct the very sentence that introduces the term | Extra generation and a publication delay; earlier published sentences remain unchanged |

These are options for investigation, not an implementation decision. For the final option, provisional text must stay out of visible narration, TTS, and committed history. The current stream path feeds presentation and speech while output arrives, so buffering would be part of the design, not merely another dictionary scan. [Stream consumers](D:/Documents/GitHub/formamorph/src/views/GameViewer.tsx:2907)

The smallest experiment would compare the current pipeline with planner-output rescanning on cases where the player never names the entity but the plan introduces it. A separate spontaneous-introduction set would distinguish that mitigation from draft-and-rewrite. This is a proposed evaluation, not a reported test result.

## Verification scope

- Confirmed repository default branches through GitHub's API before fetching source from `raw.githubusercontent.com`.
- Inspected KoboldAI United at commit `0986f9149025a92f41a4fac24e095dd4923b0142` and the Oobabooga extension at `fd43054c0bf09c3f4c02ef0b744b14ec5373e479`.
- Source and documentation inspection only: no model calls, endpoint-compatibility tests, latency measurements, or app-code changes.
- Search results that only described memory creation, lorebook authoring, or entry regeneration were not treated as same-reply retrieval implementations.
