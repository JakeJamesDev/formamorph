# Functional Writing Guide

This is Formamorph's repository reference for writing and reviewing functional English copy. It targets **full ASD-STE100**, together with our local copy conventions. It works independently of the design showcase.

The policy covers app-authored labels, settings, tooltips, instructions, status messages, errors, confirmations, and tutorials. It excludes authored worlds, community posts, and generated story prose. Interface text around that content remains in scope.

> **Evidence boundary:** This guide provides source-reviewed examples, not certification of Formamorph or a replacement for the standard. Unresolved label grammar is recorded below. A model's assurance or a passing copy test does not establish STE compliance.

## Sources and authority

Review against the [official ASD-STE100 standard](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf), both Part 1 (writing rules) and Part 2 (dictionary). The evidence here was checked on September 7, 2026 against Issue 9, dated January 15, 2025. This identifies the reviewed source; consult the [official download page](https://www.asd-ste100.org/STE_downloads.html) for subsequent revisions and recheck affected references when it changes.

Page references below are the standard's printed page identifiers. Linked `page` values are PDF page numbers. Keep the standard available during review; this guide deliberately does not reproduce its rules or dictionary.

Local copy contracts live in [settingsCopy.ts](../src/components/modals/settingsCopy.ts); the [copy tests](../src/components/modals/settingsCopy.test.ts) enforce only local guards. Product nouns also follow the [world types](../src/types/world.ts) and [gameplay types](../src/types/gameplay.ts).

## Choose the copy role first

| Role | Formamorph convention | Review route |
| --- | --- | --- |
| Label | Name the concept or action; use Title Case. Preserve official names and acronyms. No sentence-ending period. | Terminology review, then the label limits below |
| Setting description | One complete, third-person sentence, at most 12 words, ending with a period. State the effect. | Descriptive writing; explicit subject and accurate effect |
| Instruction | Tell the reader which action to perform, using the imperative. | Procedural writing |
| Status or error | State the observed result or inability. Separate any recovery instruction. | Descriptive sentence, then procedural sentence if necessary |
| Extended help | Explain a cost, tradeoff, mechanism, or prerequisite. Divide explanations from numbered steps. | Review each passage according to its role |

A tooltip inherits its purpose, not a special grammar exemption: an action tooltip is an instruction; an explanation is descriptive text. A confirmation combines a title, an explicit consequence, and identifiable action choices. Tutorials combine explanations and steps. Do not apply the setting-description voice or 12-word ceiling to all these surfaces.

Additional setting detail belongs behind the information control. Do not repeat the row description there. Required action conditions or destructive consequences must also be visible where the action occurs; do not make a procedure depend on opening optional help. Review procedural notes under rule 5.5 rather than treating every information popover as a note.

## Labels, capitalization, and complete sentences

**Capitalization:** Keep local Title Case for labels, buttons, section headings, and dialog titles; use sentence case for prose. The standard's General introduction, page ii ([PDF page 36](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=36)), assigns formatting to applicable publication/style directives. Rule 1.5's explanation on page 1-1-9 distinguishes ordinary terms from official identifiers and titles. This supports local presentation; capitalization does not approve a word's meaning or grammar.

**Existing identifiers in instructions:** Copy the visible label exactly and mark it as quoted text, for example `Select “Font”.` Rule 8.6.5–6, page 1-8-7 ([PDF page 113](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=113)), covers quoted text and references to titles/labels, including material that is not itself STE. Do not rename a control inside its instructions.

**New standalone label fragments:** `Font` is a noun identifier, not a descriptive sentence. The cited quoted-text rule does not establish a general grammar exemption for labels that we author. Rule 4.3 permits fragments in a particular vertical-list structure; a settings grid is not automatically that structure. **UNVERIFIED — standalone UI label-fragment grammar has not been confirmed with the standard's maintainers or a qualified STE reviewer.** Retain the local naming convention and mark label reviews as terminology/formatting only. Do not claim full compliance for these label examples. Resolve this applicability question before upgrading their verdict.

**Setting descriptions:** Prefer `This setting changes the font.` to the subjectless `Changes the font.` Both are short, but only the former supplies an explicit subject. The complete form preserves third-person voice and the local ceiling. An initial third-person verb alone is not evidence of a complete sentence. Keep necessary articles; consult rule 4.5, page 1-4-8. No change to production copy or its tests is implied by these examples.

If a necessary explanation cannot satisfy both the local contract and STE, record the exact text, rule, and competing rewrites for a product-owner decision. Do not remove meaning, relax the full-STE target, or silently replace a domain name to make a check pass.

## Controlled product terms

These entries preserve established concepts. Noun admission is assessed under rules 1.5–1.11, especially category 19 (computer concepts), page 1-1-8 ([PDF page 52](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=52)). A familiar word is not automatically approved in every sense.

| Term | Meaning and boundary | Evidence / classification |
| --- | --- | --- |
| Formamorph | Product name; keep this spelling. | Named application; rule 1.5 category 19 |
| world | Authored game definition, distinct from progress during play. | World types; category 19 application data concept |
| save | Stored gameplay progress; noun use is separate from the verb. | Gameplay types and settings copy; category 19 data concept |
| Autosave | Named automatic-save feature/slot. Preserve `Auto` when quoting the displayed tag. | `autosave` in settings copy; category 19 |
| narration | Story text presented during play. | Settings copy; category 19 application output |
| memory summary / Memory Summaries | Condensed earlier turns used as context; the plural title names the setting. Do not replace with internal `memoryDigests`. | `memorySummaries` in settings copy; category 19 |
| entity, location, stat, trait | Distinct authored domain concepts, with their definitions in the world types. An entity can be a person, a creature, an object, or a fixture; never write "character" for it. | Category 19 application entities; not interchangeable synonyms |
| dictionary, entry | A dictionary is a set of entries. An entry holds Trigger Keywords and a Value. | World types; category 19 |
| Trigger Keywords, Secondary Keywords, Value, Scan Depth | The entry panel's own labels. Quote them with their display casing. | [DictionaryManager.tsx](../src/managers/DictionaryManager.tsx); category 19 |
| prompt, message | The prompt is the text sent to the AI for one turn. A message is one earlier action or narration that keyword scanning reads. | Settings copy and Scan Depth; category 19 |
| activate, match, inject | Verbs for the entry mechanism. A keyword matches a message; a match activates the entry; an activated entry's Value is injected into the prompt. | [World Editor docs](WorldEditor.md); rule 1.12 technical verbs |
| setting, font, dialog, file | Respectively a configuration option, typeface choice, interface container, and stored data object. | Category 19; `font` also appears in category 15 |
| model, token, reasoning | AI system, unit used by that system, and its reasoning output/process. Do not equate reasoning visibility with reasoning effort. | Settings copy; category 19 AI concepts |
| cached images | Downloaded image copies in the remote-image cache, not embedded world images. | [remoteImageCache.ts](../src/lib/remoteImageCache.ts); category 19, two-word technical noun |
| embedded image, linked image | An embedded image is stored in the world file. A linked image is stored as its URL only. | [entityImages.ts](../src/lib/entityImages.ts); category 19 data concepts |
| publish, Publish Size, publish limit | Publishing sends a world, entity, dictionary, or avatar to Community Creations. Publish Size is the byte size of the content that publishing sends. The publish limit is the largest Publish Size the server accepts for that kind. | [publishLimits.ts](../src/lib/publishLimits.ts); category 19; `publish` is a technical verb under rule 1.12 because no approved verb names the upload-and-list operation |
| stat code, code box | Stat code is the JavaScript a stat runs each turn. A code box is one of the two editors that hold it. | [StatCodeBox.tsx](../src/managers/StatCodeBox.tsx); category 19 |
| Before the AI, After the AI | The two code boxes, named for when they run in the turn. Before the AI runs before the prompt is built. After the AI runs after the AI's changes and Regen apply. | [statCodeTiming.ts](../src/lib/statCodeTiming.ts); named controls, rule 1.5 |
| Test Code, Templates | The button under a code box that runs that box alone, and the menu that inserts a code template into it. | [StatCodeBox.tsx](../src/managers/StatCodeBox.tsx); named controls, rule 1.5 |
| pin (verb), unpin (verb) | Code or the author fixes a placeholder to one value until the pin is removed. `pin(x)` in code; Pin in the editor. | [statCodeSurface.ts](../src/lib/statCodeSurface.ts); rule 1.12 technical verb, no approved verb names the hold-one-value operation |
| switch (verb) | Code or the player turns a trait on or off through `enabled`. Only traits switch; stat fields are set. | [StatCodeGuide.md](StatCodeGuide.md); rule 1.12 technical verb, matches the trait checkbox |
| listing | One published item on Community Creations. Distinct from the local copy it was published from, and from the world or library item it holds. | [publishPayload.ts](../src/lib/publishPayload.ts); category 19 |
| source | The published listing a copy of an entity or a dictionary follows. A copy with no source is independent. | [publishLinks.ts](../src/lib/publishLinks.ts); category 19 |
| required, Include as required | A world requires a source when downloading the world also downloads and links that source. Include as required is the checkbox that declares it. | [LinkedContentSection.tsx](../src/components/menu/LinkedContentSection.tsx); category 19, named control under rule 1.5 |
| add-on, Offer as add-on | An add-on is a published entity or dictionary offered for a world, which a player installs by choice. Offer as add-on is the checkbox that declares it. Never write "add-on" for a required source. | [CompatibleWorldsSection.tsx](../src/components/menu/CompatibleWorldsSection.tsx); category 19, named control under rule 1.5 |
| Public, Unlisted | The two values of a listing's Listing choice. An unlisted listing is not in Community Creations and reaches a player only inside a world that requires it. Unlisted is not deleted and not private. | [CompatibleWorldsSection.tsx](../src/components/menu/CompatibleWorldsSection.tsx); named values under rule 1.5 |

Use the same term for the same concept in prose, accessible names, and help. Quoted labels retain their display casing; ordinary nouns use normal prose casing. Introduce unfamiliar terms in help before depending on them. This register is scoped to the listed meanings, not a blanket whitelist for all game vocabulary.

Technical verbs need a separate entry under rule 1.12; a noun entry does not authorize verb use. For example, `save` means persist application data and `open` means load/access a file. Category 2b, page 1-1-14 ([PDF page 58](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=58)), covers these computer operations. Record why an approved dictionary verb cannot convey the same operation accurately: keeping something is not necessarily persisting it; showing something is not necessarily opening/parsing it. Apply the rule's approved-word preference on page 1-1-15. Do not justify `delete` as a technical verb when approved `erase` conveys the intended data operation accurately.

For a new term, record its spelling, part of speech, exact product meaning, source location, category, and why dictionary alternatives do not fit. Preserve established names while resolving uncertain admission; flag the uncertainty instead of casually renaming them.

### The help-line test

A help line under a field, a tooltip, and a ⓘ popover are instructions, not prose. Before shipping one, check every word against two lists:

- **Every noun is a label on the same screen or a term in the register above.** "The Value is injected into the prompt" passes: Value is a label, prompt is registered. "The text goes into the AI" fails: neither noun is defined.
- **Every verb names the literal operation.** Match, activate, inject, scan, add, remove, show, hide, run, send, set, select. A verb that describes the effect by image fails: fire, drive, mute, live, stand in, appear in play, get out of the way, keep in reach.

A line that fails either list is rewritten with the defined words, even when the rewrite reads flatter. The reader of a help line is looking for which control does what, and a defined word answers that where a pretty one does not. World text, narration, and readme prose keep their own voice; this test does not apply to them.

### The technical register

Technical surfaces are instructions, not prose. This covers stat code help, the Stat Code Guide, editor warnings, Test Code output, Test Bench findings, completion info, template descriptions, and code comments. The reader is writing code and wants the exact term.

- **Defined words beat common words.** STE prefers the common word for a general reader. A technical reader needs the word that names the operation. "Overwrites" is correct; "writes over" is not a term. "Read-only" is correct; "code cannot change it" is a description of read-only.
- **One term per concept, everywhere.** The same fact reads the same in the hint, the help topic, the guide, the warning, and the comment. Pick the term once and reuse it.
- **Short declaratives.** State the fact. Drop the framing ("so", "which means", "the way it always did"). A colon introduces a list or a value, never an aside.
- **No metaphor, no image verbs.** Land, drive, show through, in force, stand, sit over, hand back, reach for: rewrite each with the operation it describes.

| Concept | Term | Not |
| --- | --- | --- |
| Replace existing code or text | overwrite | write over, replace what was there |
| Write a stat field or a value | set | move, change, push |
| Fix a placeholder to a value | pin, unpin | hold, lock, hand back |
| Turn a trait on or off | switch | drive, set, toggle |
| A write with no effect | ignored | dropped, did nothing, missed |
| A field code cannot write | read-only | frozen, cannot change |
| A name lookup | resolves to | reaches, answers, finds |
| A value that holds across runs | persists | stays, holds, carries |
| A value that stops applying | clears | goes away, is removed |
| A change takes effect | applies | lands, goes in, takes |
| A step that does not run | skipped | does nothing, does not run |
| A name the world does not have | unknown name | a name no stat has, missing |
| A member that hides a same-named part | shadows | loses the name to |
| A code path or object path | path, segment | step, walk, route |

Code comments follow the same register. A comment names the mechanism in the defined terms and stops.

## Worked review examples

These are proposed writing examples, not a record of shipped strings. Counts are ordinary space-separated words; each sentence also remains within its applicable STE limit. Quoted labels can have a different STE count under rule 8.6. Check dynamic substitutions separately.

| Role / surface | Example | Review and meaning check |
| --- | --- | --- |
| Settings label | `Font` | Product noun above. Title Case follows the local rule. Terminology/formatting reviewed; standalone-fragment grammar remains unverified. |
| Setting description | `This setting changes the font.` (5) | Explicit third-person subject, present active verb, one effect, period, under 12 words. CHANGE (verb) means alteration, not replacement. Applies to the font choice in settings copy. |
| Action tooltip | `Select a font.` (3) | SELECT is an imperative choice among alternatives; `a` introduces the object. Appropriate for the font chooser, not an unlabeled control. |
| Instruction | `Select “Font”.` (2) | Imperative SELECT; exact existing label as quoted target. Rules 5.3 and 8.6. Does not certify the target label's grammar. |
| Error plus recovery | `Formamorph cannot open the file.` (5) / `Select a file.` (3) | CANNOT states inability; `open` is the registered computer operation. Use only when a file-open failure was observed and a file chooser remains available. Do not invent the cause or promise that another selection succeeds. |
| Completion status | `Formamorph erased the cached images.` (5) | Past active ERASE. Display only after the cache-clear operation succeeds; starting the operation is insufficient evidence. |
| Confirmation consequence | `Formamorph will erase the cached images.` (6) | WILL + ERASE expresses the consequence before confirmation. Cache scope follows `clearCachedImages`, which clears only its store. Pair with the exact existing action label and a cancel choice; this sentence alone is not a complete dialog. |
| Extended information | `Formamorph saves the reasoning.` (4) | Descriptive mechanism statement for Show Reasoning: storage is distinct from visibility. `save` uses the registered persistence sense, present active form. Settings copy documents storage independently of this display option; verify the save path and handling of models without reasoning before production use. |
| Tutorial steps | `1. Select “Settings”.` / `2. Select “Font”.` / `3. Select a font.` | Three separate imperative choices. Verify that each target is visible at that step; a route with an intervening menu needs another step. The label “Settings” must match the actual entry point. This is a sequence template, not a verified navigation walkthrough. |

### Dictionary evidence for these sentences

Look up the headword and the applicable part of speech, not just the spelling. These references were checked in the official dictionary, including its approved-meaning column. Technical nouns and the technical verb `open` use the register above.

| Headword / use | Printed dictionary page | PDF page |
| --- | --- | --- |
| A — article | 2-1-A1 | [149](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=149) |
| CANNOT — modal verb | 2-1-C2 | [184](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=184) |
| CHANGE — verb, `changes` form | 2-1-C6 | [188](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=188) |
| ERASE — verb, data removal | 2-1-E8 | [234](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=234) |
| SELECT — verb, choice | 2-1-S6 | [372](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=372) |
| THE — article | 2-1-T3 | [401](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=401) |
| THIS — adjective before `setting` | 2-1-T5 | [403](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=403) |
| WILL — modal verb | 2-1-W5 | [429](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=429) |

Do not substitute dictionary alternatives mechanically. For example, `save` has a general-language alternative at page 2-1-S3, while the computer-process sense needs rule 1.12. A changed word that changes product meaning fails review even if the new word is approved.

## Review a complete change

1. **Inventory the strings.** Record the source file/key, surface, copy role, exact text, dynamic values, and the behavior each sentence claims. Include accessible labels and failure states.
2. **Check vocabulary.** Apply rules 1.1–1.14 using the dictionary and term register. Record disputed meanings, verb forms, and proposed term categories. Do not label ordinary adjectives as technical nouns to bypass the dictionary.
3. **Check grammar and structure.** Review multi-word nouns (section 2), verbs (section 3), and sentence construction (section 4). Then use section 5 for actions and section 6 for explanations. Check punctuation/counting (section 8) and writing practices (section 9), including consistent terminology.
4. **Check the whole surface.** In procedures, verify order, prerequisites, and one action per step (5.1–5.5). In explanations, review information order and paragraph structure (6.1–6.6). Assess section 7 when real safety instructions are present; record why it is not applicable to ordinary settings copy instead of silently skipping it.
5. **Check local requirements and meaning.** Count the rendered setting description separately against 12 words. Keep third person, a complete sentence, Title Case identifiers, and useful optional detail. Exercise the associated behavior before publishing a factual claim. Compare before/after meaning: object, timing, conditions, cost, persistence, failure, and recovery.
6. **Record a bounded verdict.** List the reviewed source edition, clauses and dictionary entries, technical-term decisions, local checks, behavior evidence, and every unresolved point. Use `reviewed against listed evidence`, `needs revision`, or `unverified`; explain each unverified item. Only claim full compliance after the entire applicable rule set and vocabulary have been reviewed with no unresolved items.

For this example set, sections 1–6, 8, and 9 provide the review path; section 7 has no safety procedure to assess. No example requires a long noun cluster, passive clause, complex paragraph, or conditional work step. Future help can introduce any of these and must receive the corresponding review. This is applicability assessment, not a reduced STE subset.

### Review record template

```text
Source key / surface / role:
Exact rendered text and dynamic-value cases:
Behavior claim and observed evidence:
Standard edition / date:
Dictionary headwords, meanings, forms, and page references:
Technical terms, categories, and admission rationale:
Sections 1–9: findings or reason not applicable:
Local description count / grammar / casing / information placement:
Meaning changes from the original:
Unresolved questions and who must resolve them:
Verdict and reviewer:
```

## Remaining review limits

- Standalone label-fragment grammar remains unverified. Quoting a label in an otherwise reviewed sentence does not resolve it.
- Technical-term categories here are documented project applications of the standard, not external endorsements. Review new senses and disputed entries explicitly.
- Worked examples have source-based vocabulary and grammar review. Conditional examples still need their stated behavior/navigation checks before production use.
- Existing production copy, generated substitutions, translations, and the live showcase have not received a complete STE audit through this guide. Local tests establish neither vocabulary approval nor preserved meaning.
- If a source link becomes unavailable, obtain the official copy through the download page. Keep source evidence local for review; do not commit the standard or its extracted dictionary to the repository.
