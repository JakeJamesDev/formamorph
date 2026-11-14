# Spec: Character Mentions

Status: ready-for-agent
Spec session: character-mentions — spec

Resolve every name, pronoun and descriptor in narration to the cast entity it means, with an on-device coreference model. Use the result for per-character quote colors, mention hover cards, In Scene, and memory. Players correct wrong links in place and can contribute corrections to a shared training corpus. Spans both repos: the Formamorph client and FormamorphServer.

## Problem Statement

The app knows who a turn is about only by matching names. The narrator mostly writes "she", "he", "the elder sister" and "the courier", so the app misses who acted, who spoke and who is present. The narrator LLM cannot tag its own pronouns reliably: in our probe it tagged he/she correctly 0–16% of the time.

So every quote has the same color, no matter who speaks. Nothing links a mention to its character. In Scene and the diary passes miss characters that the prose shows only through pronouns. Memory stores "she left" with no record of who "she" was.

The tested off-the-shelf coreference models were trained on OntoNotes, which cannot ship in a paid product without LDC for-profit membership. Our LitBank retrain is clean, but it is weaker on descriptors and pronouns, and nothing exists to improve it from real Formamorph narration.

## Solution

**Character Mentions** is an optional feature, off by default, for English narration. When the player turns it on, the app downloads a coreference model once and runs it on each finished narration passage, on the player's device.

- **Two models, one host.** The big model (LingMess architecture, 517 MB) runs when a WebGPU adapter exists and a one-time probe passage runs fast enough. The small model (FCoref architecture, about 143 MB) runs everywhere else. Both run through one onnxruntime-web host in a worker, in every build: web, desktop and Android.
- **Per-character quote colors.** Each quote gets its speaker's color. An author can pin a color on an entity; every other speaker gets a stable color from a theme-safe palette. A quote with no resolved speaker keeps today's single dialogue color.
- **Mention hover cards.** A resolved mention in narration links to its entity. Hovering or tapping shows a card for that character.
- **In Scene and memory.** A character that the prose shows only by pronoun or descriptor counts toward In Scene and the diary passes. Memory passes read the narration with bracketed names ("she [Mira] left"), so stored memory knows who acted.
- **Correction.** A "Wrong character?" action on a colored quote or hover card lets the player pick the right character. The fix applies to that turn at once. A signed-in player who opted in to contribute also sends the passage to a staff review queue. Accepted passages join the training corpus.
- **Model updates.** Weights live in a public R2 bucket behind a versioned manifest. The app picks up new weights without an app release. Retrains run by hand on the shared corpus, and new weights ship only when both models beat the current dev scores.

## Rulings

Settled in the grill on 2026-11-14. A ruling reopens on new evidence, never on a new opinion.

| # | Ruling |
|---|---|
| Q1 | Two models: the big LingMess-size model where WebGPU passes the probe, the small FCoref-size model everywhere else. |
| Q2 | Both models train on one shared corpus: LitBank (CC BY 4.0), the seed set, and accepted player corrections. No OntoNotes data or OntoNotes-trained teacher. |
| Q3 | One onnxruntime-web host in TypeScript for every build, desktop included. A native desktop host is a later option, not this spec. |
| Q4 | Off until the player enables it. Weights download once and are cached. |
| Q5 | The big model needs a WebGPU adapter and a one-time timing probe that passes. Otherwise the small model runs. The player can override the choice in Settings. |
| Q6 | Players contribute training labels through corrections. |
| Q7 | Weights and the manifest live in a new public R2 bucket on a custom domain. Reopened once: R2 hosted no assets when this was first decided. |
| Q8 | Correction is in place: "Wrong character?" on a colored quote or a mention hover card. |
| Q9 | A contributed correction sends the full passage with every cluster, after an explicit 18+ contribution opt-in that is off by default. |
| Q10 | Contributions land in a staff review queue. Staff accept or reject each one before it can train. |
| Q11 | A versioned manifest on R2 delivers new weights without an app release. |
| Q12 | A seed set of about 100 bundled-world passages, pre-labeled by the model and corrected by the user, joins the corpus and is the narration dev set. |
| Q13 | The user starts each retrain by hand, in an agreed window on the local GPU. New weights ship only if both models beat the current dev scores. |
| Q14 | Contributing needs a signed-in account. A correction without an account applies locally only. |
| Q15 | Accepted passages stay in the corpus after account deletion or consent withdrawal. Needs a legal check before the opt-in copy ships (see Further Notes). |
| Q16 | Players enable it in Settings and from an offer in the first-time flow. |
| Q17 | This spec covers colored quotes with correction, mention hover cards, In Scene, and memory. TTS voices per speaker are a later effort. |
| Q18 | When AI Language is not English, the feature is off: the toggle is disabled and nothing downloads. |
| Q19 | The probe limit is 300 ms for a 300-token passage. |
| Q20 | Memory passes read narration with bracketed names inline ("she [Mira] left"). Tests prove no bracket leaks to any other surface. |
| Q21 | Coref adds to the current name-based participant reading. It never replaces it. With the feature off or still loading, behavior is unchanged. |
| Q22 | Quote colors: an author can pin a color on an entity; others get a stable auto palette color. This adds an optional entity field. |

## User Stories

**Enabling and setup**

1. As a player, I want Character Mentions off by default, so that nothing large downloads unless I ask for it.
2. As a player, I want to turn Character Mentions on in Settings, so that I can opt in when I choose.
3. As a new player, I want the first-time flow to offer Character Mentions once, so that I learn it exists.
4. As a player, I want to see the download size before it starts, so that I can decide on a metered connection.
5. As a player, I want download progress in MB, so that I know how long it will take.
6. As a player, I want the download to happen once and stay cached, so that later sessions start without waiting.
7. As a player, I want a failed download to show an error and a retry, so that I am not stuck.
8. As a player with a capable GPU, I want the app to pick the big model on its own, so that I get the best accuracy without tuning.
9. As a player on a weak or GPU-less machine, I want the app to pick the small model, so that narration does not lag.
10. As a player, I want to override the model choice in Settings, so that I can trade download size and speed against accuracy.
11. As a player who plays in another language, I want the toggle disabled with a short reason, so that I don't download a model that cannot read my narration.
12. As a player, I want to turn the feature off and free the cached weights, so that I can reclaim disk space.
13. As a desktop player, I want the same feature as the web app, so that the builds behave alike.
14. As an Android player, I want the feature to work or fall back cleanly, so that the app never breaks on my device.

**Quote colors**

15. As a player, I want each character's quotes in their own color, so that I can tell who is speaking at a glance.
16. As a player, I want a character to keep the same color for the whole playthrough, so that I learn the colors.
17. As a player, I want quote colors to stay readable in light and dark themes, so that no color fades into the background.
18. As a player, I want unresolved quotes to keep today's dialogue color, so that a guess never paints a quote wrong.
19. As a player who turned quote coloring off, I want the feature to respect that, so that my display setting still wins.
20. As an author, I want to pin a quote color on an entity, so that my main characters have the colors I designed.
21. As an author, I want a pinned color checked for contrast in both themes, so that I don't ship an unreadable color.
22. As a player, I want colors to appear once a passage finishes, without the text jumping, so that reading is not disturbed.

**Hover cards**

23. As a player, I want a resolved mention to link to its character, so that I can check who "the courier" is.
24. As a player, I want a hover card on desktop and a tap card on mobile, so that it works on every device.
25. As a player, I want the card to show only what I have met, so that it never spoils an unmet stranger's true name or hidden content.
26. As a player, I want mention links to stay subtle, so that narration still reads as prose.

**In Scene, Met and memory**

27. As a player, I want a character shown only as "she" to count as In Scene, so that the stat picker, Traits tab and Give include them.
28. As a player, I want the diary passes to cover characters the prose showed by pronoun, so that their diaries stay complete.
29. As a player, I want Met to keep working as it does, so that a pronoun never reveals a stranger's true name.
30. As a player, I want memory summaries to know who acted, so that "she left" becomes a memory about the right character.
31. As a player, I want bracketed names never to appear in narration, choices, read-aloud or exports, so that the helper text stays invisible.
32. As a player, I want the game to behave exactly as before while the model loads or when it fails, so that the feature can never break a turn.

**Correction**

33. As a player, I want a "Wrong character?" action on a colored quote and on a hover card, so that I can fix a wrong link where I see it.
34. As a player, I want to pick the right character from the cast, so that the fix is one or two clicks.
35. As a player, I want "nobody in the cast" as a choice, so that I can unlink a mention that names no entity.
36. As a player, I want my fix to update colors, In Scene and links for that turn at once, so that I see it took effect.
37. As a player, I want my fix kept with the save, so that it survives a reload.
38. As a player, I want to correct without an account, so that fixing my own game never requires signing in.
39. As a signed-in adult player, I want to opt in to contribute my corrections, so that the model gets better for everyone.
40. As a player, I want the opt-in to say plainly what is sent (the whole passage) and that it is kept, so that I consent knowingly.
41. As a contributing player, I want to withdraw from contributing at any time, so that future corrections stay local.
42. As a player, I want contribution off by default, so that nothing leaves my device unless I chose it.

**Staff and training**

43. As a staff member, I want a review queue of contributed corrections, so that bad or malicious labels never train.
44. As a staff member, I want each item to show the passage, the original clusters and the correction, so that I can judge it quickly.
45. As a staff member, I want to accept or reject each item, so that the corpus holds only good labels.
46. As a staff member, I want rate limits and bans to apply to contributors, so that one account cannot flood the queue.
47. As the maintainer, I want to export the accepted corpus in the training format, so that a retrain can use it directly.
48. As the maintainer, I want a seed set of about 100 bundled-world passages, so that each retrain is scored on real narration from day one.
49. As the maintainer, I want one training kit that trains both models on the same corpus, so that each new label improves both.
50. As the maintainer, I want each retrain scored against the current weights on the dev sets, so that a worse model never ships.
51. As the maintainer, I want to publish new weights by updating the manifest, so that players get improvements without an app release.
52. As a player, I want the app to fetch updated weights in the background and switch only after they verify, so that an update never breaks the feature.

**Licensing and credits**

53. As the publisher, I want shipped weights trained only on clean data, so that the paid release carries no OntoNotes license risk.
54. As the publisher, I want LitBank credited in Credits, so that we meet CC BY 4.0.

## Implementation Decisions

**Modules**

- **Coref Model Store.** Reads the R2 manifest, downloads and caches the chosen weights, verifies each file's size and hash, and reports progress. The manifest lists each model (big, small) with a version, file URLs, sizes and hashes, and the minimum host version it needs. A new version downloads in the background and replaces the old one only after it verifies. Turning the feature off deletes the cached files. It follows the semantic-memory download pattern (toggle, progress bar with MB, error row).
- **Coref Host.** A worker built with `createWorkerClient`. Input: one passage (text plus tokens). Output: clusters as character spans. It owns tokenization, the two-graph split (graph A: encoder and mention logits; graph B: antecedent logits), top-k pruning, the LingMess category masks for the big model, and cluster building. That host logic ports the fastcoref host code that ran in the Python evaluation. It runs one passage at a time and processes finished passages only, never streaming text.
- **Model choice.** A one-time probe on enable: a WebGPU adapter must exist and a 300-token passage must run under 300 ms on the big model. The result is stored per device. A Settings override (Auto, Big, Small) beats it. The probe runs again when the player picks Auto again or the manifest's big-model version changes.
- **Mention Reading.** A pure module: `(passage text, clusters, cast entities, scene context) → Mention Reading`. The reading holds each linked mention (span, entity id) and each quote's speaker (quote span, entity id or none). It names clusters with the existing parser (`findEntityMatches` and related matchers), following the combination rules proved in the evaluation: a cluster takes a name from parser hits that end a mention, from distinctive head words, aliases and Stranger Name words; a head two cast members share names nobody; one-word person names keep the capital guard; and "I'm <name>" ties to the speaker's "I". Parser hits outside any cluster keep today's behavior. Speaker attribution picks the mention next to a speech verb attached to the quote, then the nearest preceding subject mention in the same paragraph, else none.
- **Corrections.** A correction is (turn id, mention span, entity id or none). Corrections live in the save with the turn and overlay the Mention Reading for that turn.

**Consumers**

- **Quote colors.** The quote segmenter gains an optional speaker per quoted run. The renderer adds the speaker's color through a CSS custom property on the quote span. The existing quote-color settings still gate all coloring. The color comes from the entity's pinned quote color, else a stable palette index keyed by entity id. The palette is theme-safe in both themes.
- **Hover cards.** Mention links go through the renderer's existing remark-plugin and component props, as stable references. The card content comes from the Player View, so it shows only met, player-visible facts. A hover card is a new visual pattern: it needs a design-system entry and the user's approval before it ships.
- **In Scene.** `readNarration` takes an optional Mention Reading. Entities with a linked mention in the prose (outside quoted speech) join the participant union. Met stays name-based: a pronoun or descriptor never makes an entity met.
- **Memory.** A bracketed view of the narration ("she [Mira] left") is the input to the digest, diary and milestone passes only. The display text, the narration prompt history, read-aloud, choices, exports and the Narration Stream never carry brackets.
- **Turn timing.** The reading runs after the narration finishes, as background work that a new turn does not wait for. A memory pass that runs before the reading is ready reads the plain text. A missing or failed reading leaves every consumer on today's behavior.

**Settings and first-time flow**

- New settings: feature on/off, model choice (Auto, Big, Small), and contribute corrections (on/off, needs a signed-in, age-attested account). Defaults live in the settings defaults module.
- When AI Language is not English (`isEnglishLanguage`), the toggle is disabled with a reason, and the feature does not run.
- The first-time flow gets one new offer card through the existing earned-card mechanism, with its own funnel step.

**Export shape (world and save)**

- **World:** entities gain an optional pinned quote color.
- **Save:** turns gain the player's mention corrections, and the cached Mention Reading if storing it beats recomputing it (decided in the ticket).
- Both are additive. Neither shape has shipped, so no compatibility code is written.

**Server (FormamorphServer)**

- A new table for contributed corrections: account, world id, passage text, model id and version, original clusters, the correction, created time, review state (pending, accepted, rejected), reviewed by.
- `POST` a contribution: signed-in, age-attested, rate-limited, with a size cap per passage.
- Staff routes behind the existing staff gate: queue, count, accept, reject. A staff UI tab in the admin panel, beside Review and Reports.
- A staff export of accepted contributions in the training format.
- Account deletion and consent withdrawal leave accepted rows in place (Q15). Pending rows are dropped on deletion.

**Training kit**

- A tracked training kit trains both architectures (LingMess and FCoref) on one corpus: LitBank, the seed set and accepted contributions. The kit holds data conversion, training, scoring on the dev sets and our gold sets, ONNX export with the browser fixes, weight-only int8 quantization, and manifest generation. Corpora and weights are not tracked.
- Browser export rules found in measurement: `position_ids` is a graph input (pads 1, other tokens 2, 3, … per segment); LingMess's three-operand Einsum is rewritten as MatMuls; weights are weight-only int8 (DequantizeLinear). Dynamic int8 (MatMulInteger) gives wrong results on WebGPU and is not used.
- The small model needs a first LitBank training run; no clean FCoref weights exist yet.

**Dependencies and hosting**

- The host needs an onnxruntime-web version that runs both graphs correctly on WebGPU. The measured one is 1.31.1. The transformers.js copy in the lockfile is an older dev build. The ticket decides between a direct dependency (two runtimes in the bundle) and moving the shared copy forward.
- The web app is not cross-origin isolated, so WASM runs one thread there. Desktop can isolate its own window.
- A new public R2 bucket on a custom domain hosts the manifest and the weights.

## Testing Decisions

A good test checks behavior at a seam through its public interface. It never asserts internal steps. Three seams:

1. **Coref Host.** Recorded graph outputs (from the Python reference run) stand in for onnxruntime sessions. The test feeds a real passage and asserts the clusters equal the Python clusters. A separate browser check (outside the gates) runs the real graphs in Chrome on WebGPU and WASM and checks parity, like the scratch bench.
2. **Mention Reading.** Pure tests with fixed clusters and a cast. The accuracy bar comes from the gold sets (real narration, the hard set and the blind set) ported from the evaluation: names, descriptors, pronouns, traps and presence scored against the e120 numbers. A rule change that lowers any score fails.
3. **Consumers.** Through `readNarration` and `MarkdownRenderer` with a fake Mention Reading: quote colors per speaker, unresolved quotes keep the theme color, hover cards show only Player View facts, In Scene gains pronoun-only entities, Met is unchanged, and the feature-off path matches today byte for byte. Bracket-leak tests run every non-memory surface (display, narration history prompt, read-aloud text, choices, exports) with a reading present and assert no bracket appears.

Each guard is proved by reinstating its bug once (test-bar skill). Prior art: `MarkdownRenderer.dialogue.test.tsx` and `GamePanels.quoteColor.test.tsx` for quotes, the `readNarration` tests in the turn pipeline, the embedding download tests for the Model Store, and the review and reports controller tests on the server.

## Out of Scope

- Per-speaker TTS voices (later effort, Q17).
- A native onnxruntime host on desktop (Q3).
- Narration in languages other than English (Q18).
- Coreference on streaming text before a passage finishes.
- Cross-origin isolation for the web app.
- Using coreference in planning, stat or choice prompts.
- Automatic retraining or scheduled cloud training (Q13).

## Further Notes

- **Legal check (Q15, Q9).** Contributed passages can hold personal data. Under GDPR a player can ask for erasure, and keeping accepted passages after deletion may not survive that request even with an opt-in. The opt-in copy and the retention behavior need a legal check before contribution ships.
- **OntoNotes.** The OntoNotes-trained LingMess and FCoref weights must never ship or serve as a teacher.
- **Measured numbers (2026-11-14, Chrome, RTX 4090, 32-core CPU), ms per passage at 120 / 300 / 700 tokens:**

  | Model | Download | WebGPU | WASM 4 threads | WASM 1 thread |
  |---|---|---|---|---|
  | Small (FCoref, weight-only int8) | 143 MB | 36 / 35 / 50 | 181 / 186 / 373 (dynamic int8) | 667 / 666 / 1374 (dynamic int8) |
  | Big (LitBank e120, weight-only int8) | 517 MB | 50 / 55 / 78 | 377 / 862 / 2337 (dynamic int8 A) | 1210 / 3010 / 7773 (dynamic int8 A) |

  The web app runs WASM on one thread. The small-model fallback there takes 0.7–1.4 s on a fast CPU, after the passage finishes. Integrated GPUs, Firefox, Safari and Android WebView are not measured yet.
- **Accuracy today (e120 big model, with the parser rules):** blind set names 75/81, descriptors 24/43, pronouns 110/136 (7 wrong), traps 34/44, presence 27/29. That is below the OntoNotes model (descriptors 36/43, pronouns 132/136). The seed set and contributions exist to close that gap.
- **Evaluation kit.** The scratch work (export, bench, gold sets, combo scorer) is the reference for the training kit and the Mention Reading tests.
- **UI prototype (2026-11-14).**
  - **Question:** how should speaker colors, mention links, the card and the correction look in narration?
  - **Verdict:** the user picked variant A, "Tinted quotes + hover links":
    - each quote takes its speaker's color;
    - mentions stay plain text and show a dotted underline in the character's color on hover;
    - the card opens on hover (after a short delay, on a fine pointer) or on click and tap;
    - clicking a quote opens its speaker's card;
    - the card shows an initial, the Player View name and a one-line description, with "Wrong character?" under it;
    - "Wrong character?" swaps the card for a cast pick list plus "Nobody in the cast", titled "Who said this?" or "Who is this?".
  - **Not chosen:** B (speaker chips before quotes) and C (name tags on pronouns).
  - **Source:** branch `prototype/character-mentions`, commit `a6d451129`. Run `npx vite --port 5321` in its worktree and open `/?variant=A#dev?view=gameViewer&fixture=whiteRoom`.
  - **Still needed:** the palette and the card still need design-system entries and the user's approval of the production build (tickets 04 and 07).
