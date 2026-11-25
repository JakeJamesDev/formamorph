# Spec: Requirement Sentences

Status: done
Status note: 2026-11-25, tickets 01-08, last landing 759ae56e9, then fixes 5d5e75789 and e245774d8. Review: 3 gaps closed by e245774d8 (Q38). Closed red: lint, 31 errors, all in `worlds-wip/`. Tests green on 2026-11-25. Ticket 08's Test Bench criterion has no test.
Spec session: requirement-sentences — spec
Prototype: branch `prototype/requirement-sentences`, commit 7fa4ca1f5, variant A (`/?variant=A#dev?view=mainMenu&modal=worldEditor&tab=traits`). Compared two add controls on the sentence editor (A text tokens, B one button) against the chips (C). A won on 2026-11-24.

## Problem Statement

The **Requires** field shows each Condition as a chip. A chip with inline controls (a stat comparison, an item's State, the parts of the day) grows wide and wraps, and its width changes on every edit. A row with three Conditions is hard to read as a rule.

The author also can't change a Condition after adding it. To pick another owner or another trait, the author removes the Condition and adds it again.

The Entity Schedule already solved the same problem. Each schedule row is a sentence, and each part of the sentence opens its own small editor.

## Solution

Each Requirement Row becomes one sentence. Each part of a Condition is a **token**: underlined text that opens the editor for that part.

> This entity has Paladin and Albus's Health is at least 50 and…
> or
> The player is Albus and…
> or…

- The owner, the verb, the target and the value are separate tokens.
- A click on the verb flips Not: "has" becomes "doesn't have".
- A muted "and…" token ends each sentence and adds a Condition. A muted "or…" line after the last row adds a row.
- A row wraps at "and". A Condition that does not fit moves to the next line whole.

Every place that reads a rule as text uses the same wording: the editor, the player's lock line, code cards, update notes, image rules and the Test Bench.

## Rulings

| Q | Ruling |
|---|---|
| Q1 | Every host of the Requires field changes at once. No host keeps the chips. |
| Q2 | One sentence per Requirement Row, with "or" between rows. |
| Q3 | One token per part of a Condition, not one token per Condition. |
| Q4 | New wording, unified where possible. |
| Q5 | One wording everywhere: the editor, the lock line, code cards, update notes. |
| Q6 | Not lives in the verb token. One click flips it, with no popover. The flip button and the NOT mark go away. |
| Q7 | The owner is its own token and can change after add. The add flow drops the owner page; a new Condition starts with no owner. A stat picked from an owner's section starts with that owner, as before. |
| Q8 | The target token opens a swap list with an **Open** button for the target. |
| Q9 | A small × follows each Condition, always visible. |
| Q10, Q13 | Add controls are text tokens in the flow: "and…" at the end of each sentence, "or…" after the last row (prototype verdict, variant A). |
| Q11 | A Condition with no owner reads the host's name. With no host name it reads "This entity". (First ruled "the owner"; changed on 2026-11-24 after the prototype.) |
| Q12 | A stat comparison reads as words: above, below, at least, at most, exactly, different from. |
| Q14 | A broken part is a red token with a warning icon and a tooltip that gives the reason. |
| Q15 | Time, weather and Opening Conditions are one list token. The toggles live in its popover. An empty set is a broken token. |
| Q16 | An item's State and identity checks show in the sentence only when set. The item token's popover adds them. |
| Q17 | The swap list holds targets of the same kind only. |
| Q18 | The player's lock line uses full clauses, with "you" for the persona. |
| Q19 | A stat Condition's Not flag reads "is not above". The comparison token holds the six operators. No data changes. |
| Q20 | The grammar table below. |
| Q21 | The item verb token opens a list of four forms. It is the one exception to Q6. |
| Q22 | A row wraps at "and". A Condition that does not fit moves to the next line whole, and the "and" stays on the line above. |
| Q23 | "or" sits on its own line, muted, at the row's text size. |
| Q24 | A persona Condition reads "The player is Albus" / "is not". (Replaces "plays as", 2026-11-24.) |
| Q25 | A Condition with no owner that reads the world's own traits or stats (global scope) has no subject in the editor: "Paladin is active", "A trait in Combat is active", "Gold is at least 5". An item Condition there reads the persona and keeps "The player owns Lantern". The player's lock line reads the same, with no subject: "Paladin is active", not "you have Paladin" (ruled 2026-11-24, after ticket 01). "You" stays for a Condition that reads the persona. |
| Q26 | An empty set reads as a prompt in its broken token: "It is [pick a time]", "The weather is [pick the weather]", "The opening is [pick an opening]". |
| Q27 | A stat's value is one token, "50%". Its popover holds the number and the Raw / % switch. |
| Q28 | The builder always writes the full subject. No "its" or "their" for a repeated subject. |
| Q29 | Every gate line that carries clauses takes a colon and a final period: "Requires: Knight is active and Paladin is not active, or Mercenary is active." "Unlocked by" lines follow the same rule. A bare "Locked" label is unchanged. |
| Q30 | The You pill leaves every gate line. In the player's view, a Condition whose owner is the played persona reads "you" / "your", a named entity that is played included. |
| Q31 | On a row with no subject (Q25), the target token's popover holds an Owner list above the swap list. A pick writes the owner, and the sentence gains its subject token. |
| Q32 | On an item's image rule, a Condition with no owner reads "The item's owner". |
| Q33 | Token popovers in the Requires field are modal in every host. |
| Q34 | A stat target swap keeps the comparison and Not. A % value stays; a Raw value resets to the new stat's default. A stat owner swap keeps the whole Condition. |
| Q35 | Tokens take the lighter, muted underline everywhere the shared token shows, the Entity Schedule included. |
| Q36 | An image rule's "Shown while" summary takes a final period and no colon: "Shown while Paladin is active." |
| Q37 | A Blueprint trait, group and stat follow one rule, in the editor and in play. Under Blueprints is not global scope: Q25 does not apply. On a Blueprint's own field, a Condition with no owner on a Blueprint target takes the Q11 subject, "This entity". On a Link it reads the linking entity, and "you" for the played one. An item Condition with no owner on a Blueprint's own field reads "This entity" too, because a Link reads the linking entity's items. (Ruled 2026-11-25.) |
| Q38 | On a Global Trait's field, a Condition with no owner on a Blueprint target keeps the Q25 sentence, and its target is a broken token: "This trait needs an owner." The Owner list in the target popover (Q31) fixes it. A Blueprint stat that no entity has is a broken token when the Condition names an owner: "No entity has this stat." (Ruled 2026-11-25, at the second close review.) |
| Q39 | The add menu lists Blueprint traits, groups and stats on a **Blueprints** page, on every host. **World** holds only global ones. A pick from Blueprints adds the Condition with no owner. An entity's page keeps its own traits and its stats, linked ones included. (Ruled 2026-11-25, after the close; built in the commit that adds this line.) |
| Q40 | An entity's page in the add menu also lists the Blueprint traits and groups the entity links, as its stat page lists linked stats. A pick there names that entity: "Albus has Paladin". This amends Q7 for a linked trait or group; the Blueprints page still adds with no owner. In a world small enough for the flat list, a linked trait shows once per page it is on, told apart by its path. (Ruled 2026-11-25.) |

### Grammar (Q20)

Brackets mark tokens.

| Kind | Sentence | Not form |
|---|---|---|
| Trait | `[This entity] [has] [Knight]` | `doesn't have` |
| Group | `[This entity] [has a trait in] [Combat]` | `has no trait in` |
| Playing As | `The player [is] [Albus]` | `is not` |
| Stat | `[Albus]'s [Health] [is] [at least] [50%]` | `is not` |
| Item | `[Albus] [owns] [Lantern] ([lit, identified])` | see below |
| Time | `It [is] [morning or evening]` | `is not` |
| Weather | `The weather [is] [rain or snow]` | `is not` |
| Opening | `The opening [is] [Harbor or Ruins]` | `is not` |
| World Option, choice | `[Difficulty] [is] [Hard]` | `is not` |
| World Option, on/off | `[Permadeath] is [on]` | `off` (the value token flips) |
| World Option, number | `[Party Size] is [at least] [3]` | none |

- **Item verb (Q21):** owns, doesn't own, has equipped, doesn't have equipped. "Has equipped" is offered only for an item that fits a slot.
- **Subject:** a named owner reads by name, the persona reads "the player", and no owner follows Q11.
- **Global scope (Q25):** `[Paladin] [is] active` / `is not`; `[A trait in] [Combat] is active` / `No trait in`; `[Gold] [is] [at least] [5]`. This applies when a Condition with no owner reads global scope: on a world host whose target is global, and on an entity host whose target is global and not held by the entity. A Blueprint target is never global (Q37).
- **Capitals:** the first word of a sentence takes a capital. A subject later in the sentence does not.

## User Stories

**Reading a rule**

1. As an author, I want each Requirement Row to read as a sentence, so that I understand a rule without decoding chips.
2. As an author, I want "or" on its own line between rows, so that I see where one way ends and the next starts.
3. As an author, I want a long row to break at "and", so that each Condition stays in one piece.
4. As an author, I want a Condition with no owner to name its host, so that I know whose trait, stat or item it reads.
5. As an author, I want "This entity" when the host has no name, so that the sentence still has a subject.
6. As an author, I want stat comparisons in words, so that the sentence reads without symbols.
7. As an author, I want an item's State and identity checks shown only when set, so that most item sentences stay short.
8. As an author, I want a broken part marked in red with a warning icon, so that I find a deleted trait or an empty time set at once.
9. As an author, I want the reason for a broken part in a tooltip, so that I know how to fix it.

**Editing a Condition**

10. As an author, I want to flip a Condition to Not with one click on its verb, so that I don't open a menu for a yes or no change.
11. As an author, I want to change a Condition's owner after adding it, so that I don't remove and add it again.
12. As an author, I want to swap a Condition's target for another of the same kind, so that I can correct a wrong pick in place.
13. As an author, I want an **Open** button in the target's popover, so that I can still go to the trait, group or persona.
14. As an author, I want to pick a stat comparison from six words, so that I set it without a symbol dropdown.
15. As an author, I want to edit a stat's number and its Raw or % unit in one popover, so that the value reads as one token.
16. As an author, I want to choose between owns, doesn't own, has equipped and doesn't have equipped for an item, so that one token covers both status and Not.
17. As an author, I want the parts of the day, the weather kinds and the Openings in a popover, so that the row doesn't hold a wall of toggles.
18. As an author, I want a World Option's value in its own token, so that I change it in place.
19. As an author, I want an on/off World Option to flip on one click, so that it works like a verb flip.
20. As an author, I want an edit that would repeat another Condition in the row to be refused, so that a row never holds the same Condition twice.
21. As an author, I want the popover controls to stay in place while I edit, so that my next click lands where I expect.

**Adding and removing**

22. As an author, I want an "and…" token at the end of each sentence, so that I add a Condition where I am reading.
23. As an author, I want an "or…" line after the last row, so that I add another way in the same style.
24. As an author, I want a new Condition added at once with no owner, so that the add flow has one page fewer.
25. As an author, I want an × after each Condition, so that I remove one with one click.
26. As an author, I want removing a row's last Condition to remove the row, so that no empty row stays.
27. As an author, I want a delete button for a whole row, so that I drop a way in one click.
28. As an author with an empty field, I want one "Add a requirement…" token, so that the start is obvious.

**Everywhere else**

29. As an author, I want the same sentence editor in traits, image rules, entity and location gates and Routines, so that I learn it once.
30. As a player, I want a lock line in full clauses, such as "Requires: Knight is active and you own Lantern, or Mercenary is active.", so that I know what to do.
31. As a player, I want the lock line to say "you" for my persona, so that I know which Conditions are about me.
32. As an author, I want code cards and update notes to use the same words as the editor, so that one rule never has two wordings.
33. As a keyboard user, I want every token, × and add control reachable by Tab with a spoken label, so that I can edit a rule without a mouse.
34. As a mobile author, I want the × always visible, so that I don't need hover.

## Implementation Decisions

**One text source**

- The gates module gets one builder that returns a Condition's clause as ordered parts: subject, verb, target, and the extras of its kind (comparison, value, item checks, set). Each part carries its text and its role.
- The plain rule text is those parts joined. Every reader of rule text moves to it: the editor's labels, the player's lock line, code cards, update notes, image rule summaries and the Test Bench.
- The builder takes the reader's point of view. For the player it writes "you" and second-person verbs ("you have", "you are", "your Health is"). For the author it writes the owner's name, "the player" or the Q11 subject.
- The lock line keeps its joining rule: "and" inside a row, "or" between rows, with a comma before "or" after a row of several Conditions.
- A Condition's unresolved state stays as today. The builder marks which part is broken, so the editor colors that token only.

**The field**

- The Requires field keeps its data. Its text props became a clause builder and a clause host, and every host passes them.
- Each row renders the clause parts as tokens. A token is underlined text that opens a popover editor; the schedule's token moves to the shared UI components so both features use one.
- Token types: a flip token (one click, no popover), a list token (a searchable pick list), and an editor token (a popover with controls).
- The existing per-kind controls for time, weather, Opening, item checks and World Option values move into popovers. They are not rewritten.
- The duplicate guard stays: an edit that would repeat a Condition in its row, or copy a one-Condition row, is refused, and such list rows are disabled.
- Owner choices come from the picker's existing owner options for the target. A stat's owners are the owners that hold a stat with that id.
- A target swap keeps the owner when the new target allows it, else clears it. A World Option swap starts on the new Option's default value. A stat swap follows Q34.
- The add picker stays, minus the owner page.

**Layout** (from the prototype)

- Each Condition is one inline box that holds its tokens, its × and the "and" that follows it. The browser moves a box that does not fit to the next line. A box wider than the line wraps inside itself.
- The last box of a row holds the "and…" token.
- "or" and "or…" are lines of their own at the row's text size, muted.
- Popover content has a fixed layout per kind, so a selection never moves its choices.

**No data change**

- The Requirement Row and Condition shapes do not change. World and save exports are unchanged, and no migration is needed.

**Words that change with this**

- The glossary's **Requirement Row** entry names the **And** and **Or Another Way** buttons, and the **Requires** entry quotes the old lock line. Both entries change with the build.
- The wiki pages that show the Requires field or quote a lock line change with the build.
- User-facing strings follow the Writing Guide. The grammar table is the starting text, not final copy.

## Testing Decisions

A good test here reads what the author or player reads and checks what an edit writes. It does not check component structure or class names.

| Seam | What it covers | Prior art |
|---|---|---|
| Text builder (pure) | Every row of the grammar table, both points of view, each Not form, the Q11 subject cases, each unresolved case | The gate text tests beside the gates module, one file per Condition kind |
| Lock line (pure) | "and" / "or" joining with full clauses and the comma rule | The gate line tests |
| Requires field (rendered from plain props) | Tokens found by label; the rows each edit writes: flip, owner change, target swap, comparison, value, item verb, item checks, sets, remove, add, row delete; refused duplicates | The field's seven test files, one per Condition kind |
| Wrap | Each Condition is one box that holds its own "and"; one Playwright measurement that a box which does not fit starts the next line | The Playwright suite; the locked-locations run already reads a lock line |

- The existing gate text tests move to the new wording. They are not deleted.
- Each guard gets a proof that it bites: the duplicate refusal, the same-kind swap list, the Q11 subject.
- A test that only repeats the grammar table as strings and never calls the builder does not count.

## Out of Scope

- Any change to how a gate is evaluated.
- New Condition kinds.
- Swapping a Condition for another kind (Q17).
- Drag to reorder Conditions or rows.
- The Entity Schedule's own sentences, apart from sharing the token component.
- Translation of the new wording.

## Further Notes

**Open points from the prototype.** These are not ruled. The build should raise each one with the spec session.

- **Density.** Almost every word is underlined. A row with three or more Conditions looks busy. Resolved by Q35: the user saw ticket 02's two comparison frames and picked the lighter underline.
- **Popover in a popover.** The image rule editor already sits in a popover. Token popovers inside it need the modal popover setting, or wheel scroll stops.

## Prototype

- **Question:** does the Requires field read well as sentences with tokens, and which add control fits?
- **Verdict (user, 2026-11-24):** sentences, with variant A, the text tokens. Then three changes in review: wrap at "and" (Q22, Q23), "This entity" (Q11), "The player is" (Q24).
- **Branch:** `prototype/requirement-sentences`, commit 7fa4ca1f5, worktree `.claude/worktrees/prototype-requirement-sentences`. It is a primary source, not code to merge.
- **Run:** `preview_start` entry `prototype-requirement-sentences` in that worktree, port 5234.
- **Route:** `/?variant=A|B|C#dev?view=mainMenu&modal=worldEditor&tab=traits`, then Emberwatch, the Smite trait, the Availability tab. The floating bar switches variants.
- **Not built in it:** the shared text builder, the player's lock line, and the broken-token tooltip reasons. Variant B's row list still shows the old rule text.
