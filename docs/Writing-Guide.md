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
| character, location, stat, trait | Distinct authored domain concepts, with their definitions in the world types. | Category 19 application entities; not interchangeable synonyms |
| setting, font, dialog, file | Respectively a configuration option, typeface choice, interface container, and stored data object. | Category 19; `font` also appears in category 15 |
| model, token, reasoning | AI system, unit used by that system, and its reasoning output/process. Do not equate reasoning visibility with reasoning effort. | Settings copy; category 19 AI concepts |
| cached images | Downloaded image copies in the remote-image cache, not embedded world images. | [remoteImageCache.ts](../src/lib/remoteImageCache.ts); category 19, two-word technical noun |

Use the same term for the same concept in prose, accessible names, and help. Quoted labels retain their display casing; ordinary nouns use normal prose casing. Introduce unfamiliar terms in help before depending on them. This register is scoped to the listed meanings, not a blanket whitelist for all game vocabulary.

Technical verbs need a separate entry under rule 1.12; a noun entry does not authorize verb use. For example, `save` means persist application data and `open` means load/access a file. Category 2b, page 1-1-14 ([PDF page 58](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=58)), covers these computer operations. Record why an approved dictionary verb cannot convey the same operation accurately: keeping something is not necessarily persisting it; showing something is not necessarily opening/parsing it. Apply the rule's approved-word preference on page 1-1-15. Do not justify `delete` as a technical verb when approved `erase` conveys the intended data operation accurately.

For a new term, record its spelling, part of speech, exact product meaning, source location, category, and why dictionary alternatives do not fit. Preserve established names while resolving uncertain admission; flag the uncertainty instead of casually renaming them.

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
