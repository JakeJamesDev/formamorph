# Spec: Character Mentions

Status: done
Status note: Reopened 2026-11-15 for tickets 18–25 (Q72–Q76). Closed 2026-11-15; tickets 01–17 done, last landing 968e7f384 (server 63e9a44). Review: spec text corrected. Tests green on 2026-11-15 (36812 passed) before tickets 16–17; those two closed without a full run, on their prepare gates. Lint red only on untracked worlds-wip/ check scripts, outside this effort.
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
- **Correction.** A "Wrong character?" action on any quote or a hover card lets the player pick the right character (Q70). The fix applies to that turn at once. A signed-in player who opted in to contribute also sends the passage to a staff review queue. Accepted passages join the training corpus.
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
| Q23 | Gold sets, the seed set and the contributed corpus live in a separate private repo, `formamorph-training-data`, cloned next to this checkout (`coref/gold`, `coref/seed`, `coref/corpus`). The kit and tests find it at `../formamorph-training-data`, or through `FORMAMORPH_TRAINING_DATA`, and skip when it is missing. Ticket 01 owns the formats. No gold-set text or real narration goes into this repo. Reopened once: the sets first stayed untracked in `.scratch/`. |
| Q24 | The Mention Reading rules have one implementation, the TypeScript module (ticket 02). The training kit scores through it and keeps no Python copy. |
| Q25 | The publish gate is per model; each model publishes on its own. A model publishes only when it scores at least as well as its published version on every dev set and strictly better on at least one. The manifest carries each model's dev scores, and no manifest means the first publish passes. |
| Q26 | Export parity compares the browser run against the same weight-only int8 graph on ORT CPU, on a real passage. |
| Q27 | The small model starts as supervised FCoref on LitBank. Distillation from the clean big model is allowed if it scores higher, on narration with no real player text. |
| Q28 | `minHostVersion` is an integer graph-contract version that the Coref Host declares. |
| Q29 | The Mention Reading drops a parser hit on an everyday-word name when no cluster mention covers it (the veto). That shapes the reading's links and speakers only. Participants stay additive (Q21). |
| Q30 | The Coref Host owns a spaCy-compatible English word tokenizer in TypeScript, then BPE through the model's tokenizer.json. The training kit keeps spaCy. |
| Q31 | Per model, the manifest lists graph A, graph B, tokenizer.json and a host-config JSON (architecture, top_lambda, max_span_length, max_segment_len, graph-contract version). The host takes them from its caller. |
| Q32 | Scene context holds the player character's name only. "you", "I" and the player's name resolve to no entity. |
| Q33 | Tracked test fixtures use passages written for them, never gold or real narration. The quote-speaker gold set lives with the other gold sets in the training-data repo (Q23). |
| Q34 | Q32 applies to mention links and presence too, not only to quote speakers. A gold hit that came only through a wrong link (for example a "you" merged into a cast member's cluster) is the ruling's cost, not a failing rule change. The ticket names each such case. |
| Q35 | A contribution is one row per passage: the original clusters (char spans), the reading's entity id or null per cluster, and every correction for that turn so far as `{kind, start, end, entityId \| null}`. A new send for the same account, world and passage text replaces the pending row. The export applies mention corrections to the clusters: the span leaves its cluster, joins the clusters named that entity (merged when several) or starts a new one, and null leaves it out. Singletons drop. |
| Q36 | A quote-speaker correction is sent and stored with `kind: "quote"` and its quote span. Staff see it. The coref export skips it; it is kept for a later quote-speaker set. |
| Q37 | Account deletion removes every contribution row that is not accepted (pending and rejected). Only accepted rows stay (Q15). |
| Q38 | A corrected span removes every original span that overlaps it, not only an exact match. |
| Q39 | The server refuses a span whose start or end falls inside a word (a letter or digit on both sides of the edge). The kit's corpus build skips and reports a span off its word boundaries instead of stopping. |
| Q40 | On Auto with a WebGPU adapter, the store downloads the big model, probes it, and keeps it when the probe passes; otherwise it downloads the small model and deletes the big one. Without an adapter it downloads the small model only. The toggle's size hint shows the model Auto tries first. |
| Q41 | The toggle sits in Display › Accessibility under Quote Color and Quote Italic, in both settings modes (the user's pick once Quote Color was found there, not in Narration). The model choice (Auto, Big, Small) shows in advanced mode only. |
| Q42 | Readings live on the save envelope as a per-turn map, beside `scriptTells`, pruned on rewind and replaced when a turn's passage changes. Only newly settled turns get one; older turns are not backfilled. Corrections (ticket 08) get their own per-turn map. |
| Q43 | Weights and the manifest are hosted on `assets.formamorph.ai` (manifest at `/coref/manifest.json`), with a `VITE_COREF_MANIFEST_URL` override. |
| Q44 | Quote Color on/off gates all quote coloring. A resolved speaker's color beats the player's custom Quote Color; quotes with no resolved speaker keep the custom color, or the theme color. |
| Q45 | A speaker's palette slot is the entity's position among the world's entities that can speak, mod 8, so the first eight never share a color. Runtime characters continue the count after the world's entities, in their save order. A pure id hash is out: three speakers collide about a third of the time. |
| Q46 | A mention linked to an entity with no Player View row stays plain text: no link, no card. Cards read the Player View as it is when opened, so a past turn's card shows what the player knows now. |
| Q47 | Ticket 07's card shows "Wrong character?" only when a correction handler is passed (ticket 08 passes it). No inert control ships in between. |
| Q48 | Quote colors follow Q46: only a speaker with a Player View row gets a color or a speaker mark in the DOM. Others render as unresolved quotes. Palette slots stay by cast order (Q45), so a color never shifts when a character becomes visible. |
| Q49 | The annotation format gains an optional `reviewed` flag. Seed pre-labels start `reviewed: false`; the corpus build drops those lines and prints the count. A missing flag counts as reviewed, so accepted contributions need none. One file per set, no separate working copy. |
| Q50 | "Character Mentions" and "Wrong character?" keep the word "character". The Writing Guide's entity row names them as exceptions, beside the character pass and diary. |
| Q51 | The mention card shows the entity's image as a 48×56 rounded portrait crop (the user's pick, after ticket 07 landed); the initial is the fallback. Any entity with a Player View row shows its image when the image's `requires` gate passes. The Player View gains the image the player can see. Ticket 13. |
| Q52 | The first-time offer is due after 3 settled player turns on any AI, one card on screen at a time, yielding to a Formamorph AI card due on the same turn. Shown and accepted are recorded on the device only; no server funnel step. The card reuses the StoryCard frame with "Not Now" and "Turn On", and after accept shows the download bar until the model is ready, then closes. |
| Q53 | In Scene and the diary queue union the turn's reading at read time; stored `entities` stay name-based, so corrections (ticket 08) apply at once. The milestone pass gains names through the digests. Bracket tags the bracketed view inserted are stripped from digest and diary replies before they are stored. |
| Q54 | A memory bracket uses the name the player knows: the true name once met, else the stranger label, else no bracket. Digests reach the Memory panel, so a true name there would spoil an unmet stranger. |
| Q55 | The one card slot is first come, first served (the user's pick). A Formamorph AI card that comes due while the offer card shows waits, and shows on the first settled turn after the offer card closes. |
| Q56 | An authored quote color is a pick from a fixed, vetted palette, not a free hex (the user's pick: less customization, trusted colors). Each swatch has a light and a dark value that passes 4.5:1 on every theme's background and card in its mode. The palette is large (about 16–24 swatches) and contains ticket 04's eight. The world stores the swatch key. |
| Q57 | The Quote Color field shows in Advanced editor mode only, beside Aliases and Type; Simple mode uses Auto. A pin may match another speaker's auto slot; that is the author's choice. Character cards carry the key too. |
| Q58 | The pick list's "not anyone listed" option reads "Someone Else" (the user's pick), replacing "Nobody in the cast", which breaks the Writing Guide. It still stores entity id none. After the close, the user renamed it "Not Listed": the guide also bars "someone" for entities. |
| Q71 | A contribution also sends `entityNames`, the placeholder-resolved name of every entity it references, so the staff review tab shows names, not raw ids. The corpus export ignores them. Found by the user after the close. Tickets 16 (server, deploys first) and 17. |
| Q72 | Quote colors stream in with the Fade-in Narration reveal. Each quote is read on the passage so far once its tag sentence, the next quote or the paragraph end has arrived, and the sentence pacer slows ahead of a quote whose color is not back, so a quote shows in its color the first time it appears. The user picked the smooth pacer from a mock (`.scratch/streaming-quote-colors/`): a buffer that also covers one model run, a pace planned for every queued quote, and eased pace changes. The mock's pace floor (run time ÷ words per quote) is dropped: on the real pacer, with coalesced runs, it added up to 1.2 s of reveal time and never shortened the longest word gap (ticket 18's measurements). The user's ask was the smoothest pace, and the floor does not serve it. Measured run times on a 4090: GPU 17–119 ms, small model on one CPU thread about 1.25 s. The character crawl (Fade-in Narration off) keeps coloring after narration (the user's pick). At narration end the full-turn reading wins and recolors any quote it reads differently (the user's pick). Ticket 18. |
| Q73 | Character discovery reads the turn's coref clusters, when the turn has a reading. Today's candidate rule needs two mid-sentence uses plus a person verb next to the name, so a character the narrator never names properly can take turns to qualify (found on a real Sunmeadow session, where "the Miensao" qualified on turn 5 after appearing on turn 3). Two changes, with the user's pick of option 1: a capitalized run that shares a cluster with he, she, him, her, his, hers, himself or herself counts as a person; and the capitalized runs in one cluster pool their uses under the most-used spelling that no exclusion blocks, so a misspelled name does not split its evidence. The link holds across turns: a spelling an earlier turn's cluster pooled under a name stays linked to it, and is blocked when that name is known or suppressed, so a misspelling never becomes a second character (ticket 19's replay found one). "They" does not count (the model scores 76% on singular they). Gate (the user asked for coref to propose and code to remove false positives): a cluster gives evidence at all (pronoun and pooled spellings alike) only when the cluster speaks a quote on this turn's page that a speech verb ties to it ("she says", "says Aiko", "Aiko says, …"), not through the paragraph-subject fallback. Ticket 19's rescore of 36 real sessions, small model: no gate 27 discoveries with 3 discussed-only people (precision 0.85); the full attribution rules 25 with 1 (scare quotes fell to the fallback); speech-verb only 24 of 24 real, none of today's 23 lost, one character today's rule never finds, another found 4 turns earlier, and Sunmeadow's on its first turn. A cluster that holds a known character adds and links nothing (the model can merge the player with others). Pools use the world's own names only; discovered and deleted names are blocked by the discover pass, which treats a pool as known when any of its spellings is known. The reading is never ready when a turn commits, so the evidence applies in the discover pass, in the same turn's idle window. Without a reading, the rule is today's. The model can only make discovery earlier, never block it. Nameless characters labeled by description are a separate, open question. Ticket 19. |
| Q74 | Two follow-ups to Q72, from ticket 18's landing (the user's picks). (1) A turn whose model cannot keep up with the stream falls back to coloring after narration, as before Q72, so a fast stream on a slow device keeps today's even pace: at 100 tokens/s with a 1.25 s run the longest word gap was 264 ms against today's 68 ms. A turn may switch to the fallback once and never back. (2) A quote that is already on screen when its color arrives (after a skip, or after the 5 s hold cap) takes the color then, with the 300 ms fade, instead of waiting for narration to end. Tickets 20 (late colors) and 21 (fallback). |
| Q75 | A link to something that is not a person can be corrected, and the name matcher stops making the most common one. Found by the user in Emberwatch: "the Captain's Hall" linked to Captain Hall, because `findEntityMatches` accepts a possessive inside a multi-word name; presence reads the same matcher. (1) A possessive may close only a name's last word ("Captain Hall's sword" matches, "the Captain's Hall" does not). The partial pass follows the same rule: a word of a multi-word name that a possessive joins to another word of the same name is not a partial hit ("Emily's Mom" still reads as Emily; a name with its own apostrophe is exempt), so "Captain's" in "the Captain's Hall" links to nothing (ticket 22). (2) The "Wrong character?" pick list gets a "Not a Character" row (the user's pick, a third Writing Guide exception), below "Not Listed", for mentions only. It removes the link and the card. (3) It is stored as its own correction kind, `nonMention`, with no entity (the user's pick), so the corpus can later tell "not a mention" from "a person not listed"; the export removes its span from every cluster, as a null mention does today. Tickets 22 (matcher), 23 (server, deploys first) and 24. |
| Q76 | Found by the close review: Q73's pooling treats every capitalized name in one speaking cluster as spellings of one name. When the model merges two different unknown people into one cluster, the second is counted under the first and never discovered, though the name rule alone would find it; that breaks "never block". Pooling joins only spellings of one name, compared word by word: one name's words are a subset of the other's, with words matching within an edit distance of 1 under 5 letters and 2 from 5 up ("Miensao" ≈ "Mienshao" ⊂ "Anthro Mienshao"; "Mia" and "Max" stay apart). Spellings group in order of use, each joining the first group whose every member it spells (not only the head), so "Smith" never joins "Anna Smith" to "John Smith": the bare "Smith" counts toward the first full name, and the other starts its own group. An earlier turn's link names a group, and the discover pass counts a group as known, only under the same every-member test (ticket 25's review). Distinct names in one cluster stay separate, each judged on its own evidence. The user also left the title-word partial match ("Captain Blackwell" linking to Captain Hall) as a known edge for now. Ticket 25. |
| Q59 | A turn's saved reading also keeps the host's clusters and each cluster's entity id, so a contribution can send Q35's payload. Turns read before that have no clusters and send nothing. "Contribute Corrections" sits under the Character Mentions toggle, both modes, shown while the feature is on, disabled with a reason when signed out or not age-attested. Staff review is a "Mentions (n)" segment in the Admin Panel's Moderation tab. A contribution's world id is the open world's id; the model id and version are the reading's. |
| Q60 | The contribution opt-in belongs to the account that gave it: the setting stores that account's id, and the toggle reads on and sends go out only while that account is signed in. Another account on the same device starts off. |
| Q61 | Reverses Q32 and Q34 for display (the user's call, 2026-11-15): the played persona is a speaker and a mention target. Its quotes get a color and "Wrong character?"; "you", "I" and its name link to it with a card; it appears in the pick list. On Auto, its quote color is the player's Quote Color setting. In Scene and memory keep treating the player as today. Ticket 14. |
| Q62 | Pick-list rows show the entity's image as a square, top-aligned crop like the persona square, with the initial as fallback, under Q51's visibility rule. Ticket 14. |
| Q63 | Q48 stands and uses the one naming standard, `presence.ts`: an entity shows its name once met or when its name is not hidden, else its Stranger Name, else nothing. A speaker or mention with nothing to show stays uncolored and unlinked; one with a Stranger Name shows that label everywhere (card, pick list). Ticket 14. |
| Q64 | Contribute Corrections stays off by default (Q9; a pre-checked box is not consent) but is asked once, yes or no: in the first-time offer when the player is signed in and age-attested, else at their first correction while signed in and attested. The row shows only while Character Mentions is on and the player is signed in, in this order: the toggle, the model choice, Contribute Corrections. The user's pick after the default-on request. Ticket 15. |
| Q65 | The first-time offer card drops Morphie for a preview of the feature: a fixed, hand-made passage with three cast members and the player conversing, every quote speaker-colored, rendered through the real narration renderer with a fixed reading, never the model. A "What's this?" control opens it larger. The card stays its usual small size: a small "What's this?" control takes Morphie's place, and the passage with its colors shows only in the dialog it opens (the user's correction after reviewing ticket 15's frames). The control reads "Show Me" (the user's rename). |
| Q70 | Every quote in narration can be corrected, not only quotes with a colored speaker. A quote whose speaker is the persona or is unresolved opens "Who said this?" on click; an unresolved one opens straight to the pick list. Found by the user: purple dialogue in play could not be corrected. A new visual pattern: frames need the user's approval. Ticket 15. |
| Q66 | "Reset Size & Spacing" sits directly under Line Spacing, the rows it resets. The "gap under Mentions Model" in ticket 15 was the spec session's misreading of a cropped screenshot, not a bug. Ticket 15. |
| Q69 | In the offer, the contribution question shows after Turn On, under the download bar, and the card stays until it is answered. At the first correction, picking a row swaps the card to the question; the correction applies at once and only a yes sends it. Closing the card without answering counts as no, so the player is asked once. Asked is recorded per account on the device, and any change to the Settings row counts as the answer. The question states that the whole passage is sent and kept. "What's this?" opens the preview read-only in a dialog. Ticket 15. |
| Q67 | An unmet stranger's card shows its Stranger Description when it has one, else no description, the same as known-by-name unmet rows. A cluster the vote left unnamed whose every mention is "you", the narrator's "I" or a persona name stores the persona id (a mixed cluster stays unnamed: in ff-13 a merged "You" would otherwise label ten of Keshari's pronouns as the player), so contributions send it labeled; a cluster a cast member won keeps its vote. The persona's authored aliases resolve to it like its name, the same rule cast entities follow. Ticket 14. |
| Q68 | The persona votes on clusters by the cast's rule: a cluster it wins links its pronouns to the persona and is stored as the persona's. The pick list lists the persona, every met entity, every scene-alias row, and any entity this turn's reading links, each under its presence label. An unmet entity the turn does not link is never listed, even when its name is not hidden (the Player View's rows include those, so the list does not use them all). Ticket 14. |

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
21. As an author, I want to pin a quote color from vetted swatches that read well in both themes, so that I never ship an unreadable color (Q56).
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
35. As a player, I want "Someone Else" as a choice (Q58), so that I can unlink a mention that names no entity.
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
- **Mention Reading.** A pure module: `(passage text, clusters, cast entities, scene context) → Mention Reading`. The reading holds each linked mention (span, entity id) and each quote's speaker (quote span, entity id or none). It names clusters with the existing parser (`findEntityMatches` and related matchers), following the combination rules proved in the evaluation: a cluster takes a name from parser hits that end a mention, from distinctive head words, aliases and Stranger Name words; a head two cast members share names nobody; one-word person names keep the capital guard; and "I'm <name>" ties to the speaker's "I". Parser hits outside any cluster keep today's behavior, except a hit on an everyday-word name, which the reading drops (Q29). Speaker attribution picks the mention next to a speech verb attached to the quote, then the nearest preceding subject mention in the same paragraph, else none.
- **Corrections.** A correction is (turn id, kind, span, entity id or none), where kind is mention or quote (Q35, Q36). Corrections live in the save with the turn and overlay the Mention Reading for that turn.

**Consumers**

- **Quote colors.** The quote segmenter gains an optional speaker per quoted run. The renderer adds the speaker's color through a CSS custom property on the quote span. The existing quote-color settings still gate all coloring. The color comes from the entity's pinned quote color, else a palette slot by cast position (Q45). The palette is theme-safe in both themes.
- **Hover cards.** Mention links go through the renderer's existing remark-plugin and component props, as stable references. The card content comes from the Player View, so it shows only met, player-visible facts. A hover card is a new visual pattern: it needs a design-system entry and the user's approval before it ships.
- **In Scene.** `readNarration` takes an optional Mention Reading. Entities with a linked mention in the prose (outside quoted speech) join the participant union. Met stays name-based: a pronoun or descriptor never makes an entity met.
- **Memory.** A bracketed view of the narration ("she [Mira] left") is the input to the digest, diary and milestone passes only. The display text, the narration prompt history, read-aloud, choices, exports and the Narration Stream never carry brackets.
- **Turn timing.** The reading runs after the narration finishes, as background work that a new turn does not wait for. A memory pass that runs before the reading is ready reads the plain text. A missing or failed reading leaves every consumer on today's behavior.

**Settings and first-time flow**

- New settings: feature on/off, model choice (Auto, Big, Small), and contribute corrections (an opt-in that stores the account that gave it, needs a signed-in, age-attested account; Q60, Q64). Defaults live in the settings defaults module.
- When AI Language is not English (`isEnglishLanguage`), the toggle is disabled with a reason, and the feature does not run.
- The first-time flow gets one new offer card through the existing earned-card mechanism; shown and accepted are recorded on the device only (Q52).

**Export shape (world and save)**

- **World:** entities gain an optional pinned quote color.
- **Save:** turns gain the player's mention corrections, and the cached Mention Reading if storing it beats recomputing it (decided in the ticket).
- Both are additive. Neither shape has shipped, so no compatibility code is written.

**Server (FormamorphServer)**

- A new table for contributed corrections, one row per passage (Q35): account, world id, passage text, model id and version, original clusters with their entity ids, the corrections, created time, review state (pending, accepted, rejected), reviewed by.
- `POST` a contribution: signed-in, age-attested, rate-limited, with a size cap per passage.
- Staff routes behind the existing staff gate: queue, count, accept, reject. A staff UI tab in the admin panel, beside Review and Reports.
- A staff export of accepted contributions in the training format.
- Account deletion and consent withdrawal leave accepted rows in place (Q15). Pending and rejected rows are dropped on deletion (Q37).

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
2. **Mention Reading.** Pure tests with fixed clusters and a cast. The accuracy bar comes from the gold sets (real narration, the hard set and the blind set) ported from the evaluation: names, descriptors, pronouns, traps and presence scored against the e120 numbers. A rule change that lowers any score fails, except a hit lost only because it came through a wrong link (Q34).
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
