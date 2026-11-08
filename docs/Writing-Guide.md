# Functional Writing Guide

This is Formamorph's reference for writing and reviewing functional copy. It builds on plain technical English: one topic per sentence, about 20 words at most, active voice, common words, no metaphor, and no em-dash asides. Help lines, tooltips, and ⓘ popovers follow Google's Material pattern instead, as the help-line test sets out. Where the two differ, the help-line test wins.

The policy covers app-authored labels, settings, tooltips, instructions, status messages, errors, confirmations, tutorials, docs, and marketing and landing-page copy. It excludes authored worlds, community posts, and generated story prose. Interface text around that content remains in scope.

Local copy contracts live in [settingsCopy.ts](../src/components/modals/settingsCopy.ts); the [copy tests](../src/components/modals/settingsCopy.test.ts) enforce only local guards. Product nouns also follow the [world types](../src/types/world.ts) and [gameplay types](../src/types/gameplay.ts).

## Choose the copy role first

| Role | Formamorph convention | Review route |
| --- | --- | --- |
| Label | Name the concept or action; use Title Case. Preserve official names and acronyms. No sentence-ending period. | Terminology review, then the label limits below |
| Setting description | Verb-first or second person, at most 12 words. One sentence takes no period; two or more end with one. State the effect once, then the trade-off. | The help-line test below; accurate effect |
| Instruction | Tell the reader which action to perform, using the imperative. | Procedural writing |
| Status or error | State the observed result or inability. Separate any recovery instruction. | Descriptive sentence, then procedural sentence if necessary |
| Extended help | Explain a cost, tradeoff, mechanism, or prerequisite. Divide explanations from numbered steps. | Review each passage according to its role |

A tooltip inherits its purpose, not a special grammar exemption: an action tooltip is an instruction; an explanation follows the help-line test. A confirmation combines a title, an explicit consequence, and identifiable action choices. Tutorials combine explanations and steps. Do not apply the 12-word ceiling to all these surfaces.

Additional setting detail belongs behind the information control. Do not repeat the row description there. Required action conditions or destructive consequences must also be visible where the action occurs; do not make a procedure depend on opening optional help.

## Before you write

Copy takes on the words and the order of whatever its writer read last. A spec, a glossary, or the code gives copy that explains the design, not the screen.

1. **List the facts in the user's words first.** Write what the user sees, clicks, and fills in. Then write the copy from that list, not from the spec, `CONTEXT.md`, or the code.
2. **Glossary words aren't UI words.** A `CONTEXT.md` term goes into copy only when a visible label uses it, or when the copy defines it first. Pipeline words (planner, cast, pass) never go in.
3. **Read it aloud. Would you say this?** A line that no one would say to a colleague fails, however well it scores on the other rules.
4. **Natural means plain, not colorful.** A changelog or list lead names the feature: `Money and items`, not `Things to buy`. Say what changes and what drives it; don't give a mechanic intent (`Descriptions change with stats`, not `A world that notices`). Vary the shape of the leads; one template on every bullet reads as a formula.

## Labels, capitalization, and complete sentences

**Capitalization:** Keep local Title Case for labels, buttons, section headings, and dialog titles; use sentence case for prose.

**Existing identifiers in instructions:** Copy the visible label exactly. Do not rename a control inside its instructions. Mark it as the help-line test says: bold where bold renders, quotation marks in a plain-text slot.

**Setting descriptions:** Prefer `Changes the font` to `This setting changes the font.` The line beside a control reads as its caption: verb-first, no subject, and no period on one sentence. Full sentences with an explicit subject are for status, error, and confirmation text. The [copy tests](../src/components/modals/settingsCopy.test.ts) enforce the period rule and the 12-word ceiling; the [prompt description tests](../src/lib/promptGroups.test.ts) and the [Anatomy hint tests](../src/lib/requestAnatomy.test.ts) share the period check through [copyShape.ts](../src/test/copyShape.ts).

## Controlled product terms

These entries preserve established concepts. A familiar word is not automatically approved in every sense.

| Term | Meaning and boundary | Source |
| --- | --- | --- |
| Formamorph | Product name; keep this spelling. | Named application |
| world | Authored game definition, distinct from progress during the game. | World types |
| save | Stored gameplay progress; noun use is separate from the verb. | Gameplay types and settings copy |
| Autosave | Named automatic-save feature/slot. Preserve `Auto` when quoting the displayed tag. | `autosave` in settings copy |
| narration | Story text presented during the game. | Settings copy |
| memory summary / Memory Summaries | Condensed earlier turns used as context; the plural title names the setting. Do not replace with internal `memoryDigests`. | `memorySummaries` in settings copy |
| entity, location, stat, trait | Distinct authored domain concepts, with their definitions in the world types. An entity can be a person, a creature, an object, or a fixture; never write "character" for it. The AI pipeline's character pass and character diary keep their names, because they are about people in the story. | World types |
| dictionary, entry | A dictionary is a set of entries. An entry holds Trigger Keywords and a Value. | World types |
| Trigger Keywords, Secondary Keywords, Value, Scan Depth | The entry panel's own labels. Quote them with their display casing. | [DictionaryManager.tsx](../src/managers/DictionaryManager.tsx) |
| prompt, message | The prompt is the text sent to the AI for one turn. A message is one earlier action or narration that keyword scanning reads. | Settings copy and Scan Depth |
| activate, match, inject | Verbs for the entry mechanism. A keyword matches a message; a match activates the entry; an activated entry's Value is injected into the prompt. | [World Editor docs](WorldEditor) |
| setting, font, dialog, file | Respectively a configuration option, typeface choice, interface container, and stored data object. | Settings copy |
| model, token, reasoning | AI system, unit used by that system, and its reasoning output/process. Do not equate reasoning visibility with reasoning effort. | Settings copy |
| cached images | Downloaded image copies in the remote-image cache, not embedded world images. | [remoteImageCache.ts](../src/lib/remoteImageCache.ts) |
| embedded image, linked image | An embedded image is stored in the world file. A linked image is stored as its URL only. | [entityImages.ts](../src/lib/entityImages.ts) |
| publish, Publish Size, publish limit | Publishing sends a world, entity, dictionary, or avatar to Community Creations. Publish Size is the byte size of the content that publishing sends. The publish limit is the largest Publish Size the server accepts for that kind. | [publishLimits.ts](../src/lib/publishLimits.ts) |
| script, code box | A script is one box of JavaScript with a timing, on a stat, a trait or the world. A code box is the editor that holds it. Never write "stat code" for it: that was the old name. | [ScriptBox.tsx](../src/managers/ScriptBox.tsx) |
| timing, Before the AI, After the AI, During AI Output, At Game Start, When a Trait Switches | A script's timing is when it runs. Before the AI runs before the prompt is built. After the AI runs after the AI's changes and Regen apply. During AI Output runs on each completed narration sentence. At Game Start runs once on a new game's opening turn. When a Trait Switches runs when a trait turns on or off during the game. | [scripts.ts](../src/lib/scripts.ts) |
| narration, player (in a script) | `narration` is the sentence and its context in a During AI Output script. `player` is the human who plays, with the calls `tell`, `toast`, `confirm`, `ask` and `input`. `persona` stays the entity the player plays. | [statCodeSurface.ts](../src/lib/statCodeSurface.ts) |
| Test Code, Templates | The button under a code box that runs that box alone, and the menu that inserts a code template into it. | [ScriptBox.tsx](../src/managers/ScriptBox.tsx) |
| pin (verb), unpin (verb) | Code or the author fixes a placeholder to one value until the pin is removed. `pin(x)` in code; Pin in the editor. | [statCodeSurface.ts](../src/lib/statCodeSurface.ts) |
| switch (verb) | Code or the player turns a trait on or off through `enabled`. Only traits switch; stat fields are set. | [Scripts-Reference](Scripts-Reference) |
| listing | One published item on Community Creations. Distinct from the local copy it was published from, and from the world or library item it holds. | [publishPayload.ts](../src/lib/publishPayload.ts) |
| source | The published listing a copy of an entity or a dictionary follows. A copy with no source is independent. | [publishLinks.ts](../src/lib/publishLinks.ts) |
| required, Include as required | A world requires a source when downloading the world also downloads and links that source. Include as required is the checkbox that declares it. | [LinkedContentSection.tsx](../src/components/menu/LinkedContentSection.tsx) |
| add-on, Offer as add-on | An add-on is a published entity or dictionary offered for a world, which a player downloads by choice. Offer as add-on is the checkbox that declares it. Never write "add-on" for a required source. | [CompatibleWorldsSection.tsx](../src/components/menu/CompatibleWorldsSection.tsx) |
| Public, Unlisted | The two values of a listing's Listing choice. An unlisted listing is not in Community Creations and reaches a player only inside a world that requires it. Unlisted is not deleted and not private. | [CompatibleWorldsSection.tsx](../src/components/menu/CompatibleWorldsSection.tsx) |
| library, library item | The library is the player's own stored entities, dictionaries, and avatars. A library item is one of them. A world's copy follows a library item or a listing, never the library. | [librarySources.ts](../src/lib/librarySources.ts) |
| linked copy, independent copy | A linked copy is a world's entity or dictionary that follows a library item or a source. An independent copy follows nothing. Unlink turns a linked copy into an independent copy. | [linkedContent.ts](../src/lib/linkedContent.ts) |
| bundled content | The entities and dictionaries an imported world file carries whose library items are not on this machine. The Link bundled content to my library choice saves them as library items. | [worldBundle.ts](../src/lib/worldBundle.ts) |
| image | A picture an entity, location, or world carries. Never "picture". | [entityImages.ts](../src/lib/entityImages.ts) |
| mobile | The small-screen layout. Never "phone", which leaves out tablets and narrow windows. Name a phone only as a real device in an example. | `useIsMobile` |

Use the same term for the same concept in prose, accessible names, and help. One fact reads the same on every surface: the hint, the help topic, the docs page, and the changelog. An entity is "it"; never "people", "everyone", "someone", or "nobody" for entities. Help and docs state the current behavior, never a change (`Old worlds play as before` fails); the changelog is the one place for change. Quoted labels retain their display casing; ordinary nouns use normal prose casing. Introduce unfamiliar terms in help before depending on them. This register is scoped to the listed meanings, not a blanket whitelist for all game vocabulary.

### The help-line test

A setting's brief line, a help line under a field, a tooltip, and a ⓘ popover follow Google's Material UX-writing pattern ([UX writing best practices](https://m3.material.io/foundations/content-design/style-guide/ux-writing-best-practices), [voice and tone](https://developers.google.com/style/tone)). Before shipping one, check it against four rules:

| Rule | Passes | Fails |
| --- | --- | --- |
| **Second person or no subject.** Start with the verb. Never "the app" or "Formamorph" as the subject, never "we". | `Saves every few minutes while you work` | `The app saves every few minutes`, `We save your work` |
| **No on/off preamble.** The label is the on state. State the effect once, then the consequence or trade-off. | `Shorter intervals show changes sooner but use more data` | `When Autosave is on, the app saves… When it is off…` |
| **Contractions, and the period rule.** One sentence takes no period. Two or more sentences end with one. | `You'll be signed out` | `You will be signed out.` |
| **Common words, no figurative language.** "Trash", "badge", "bandwidth" pass. Metaphor, idiom, "simply", "easy", and exclamation marks fail. | `Sends requests to your model server` | `Points requests at your model server`, `Rides the narration history` |

More checks:

- **State the trigger in product terms.** Name the thing the user knows: the narration, a tab, a field. Not the story concept, and not the code. `Shows this name to the player until the narration uses the entity's Name` passes; `until the player learns who it is` and `until a parse of the output detects the name` fail.
- **Name who gets the effect** when it isn't the reader. An author's field acts on the player or the AI, so say which: `Shows this name to the player`, not `Shows this name`.
- **Cut a condition only when the line stays true without it.** The test: would an author who reads only this line build something that breaks? If not, cut it and state it in the help topic. If so, keep it in the line.
- **Paired fields mirror each other.** A field that replaces another field names that field and the condition: `Replaces the Player-Facing Description until…`. Write both hints together.
- **A blank field that acts as a mode gets its own sentence,** stated as the result: `Leave it blank to start known`. Never `Blank means…`.
- **No "not X, but Y".** State what it does.
- **No definition cadence.** Never `A [noun with a packed clause] is [noun]`. Write the action, with you as the subject or no subject.
- **Named controls are bold**, in their on-screen casing, with their element type on first mention when the label is a common word: `The **Chips** tab shows your template`. Bare bold after that. Never quotation marks, never code font. A slot that renders plain text, such as a row description, keeps quotation marks, because bold can't render there.

**Two layers.** The brief line serves a reader who knows the concept: it helps them decide what to set. The ⓘ serves a reader who doesn't: it defines the concept first, then gives guidance (typical values, trade-offs, failure modes). A ⓘ that only restates the line or the control's readout gets cut.

Labels keep Title Case. The brief line stays within 12 words. A ⓘ popover may run longer and takes periods wherever it has two or more sentences. It opens with a lead line, then bullets or short paragraphs. No paragraph runs past three sentences. World text, narration, and readme prose keep their own voice; this test does not apply to them.

### The technical register

Technical surfaces are instructions, not prose. This covers script help, the Scripts Guide and Scripts Reference, editor warnings, Test Code output, Test Bench findings, completion info, template descriptions, and code comments. The reader is writing code and wants the exact term.

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
