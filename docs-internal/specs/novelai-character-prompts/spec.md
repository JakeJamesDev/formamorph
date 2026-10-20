# Spec: NovelAI Character Prompts

Status: done
Status note: Closed on 2026-10-20. Tickets 01–02 landed; the last landing is dbb5b39f4. Closed without gates.
Spec session: novelai-character-prompts — spec

## Problem Statement

A player who draws scene images on NovelAI gets characters that bleed into each other. The scene image prompt is one flat tag line: counts, then every character's appearance, then the action, then the place. NovelAI reads that line as one description, so one character's hair color or outfit lands on the other. NovelAI V4 and later can keep characters apart, through a base prompt plus one character prompt per person, but Formamorph never uses it. It always sends an empty character list.

The **Clean Up Tags** setting lets the player type NovelAI syntax by hand, but there is no way to get the character split from the scene images Formamorph writes itself.

## Solution

On every image preset that uses a NovelAI V4, V4.5 or V5 model, the scene image prompt is written in NovelAI's own multi-character syntax: a base part, then one part per character, separated by `|`.

- The base part carries the subject counts (`2girls`, `1girl, 1boy`), the action tags, and the place tags.
- Each character part opens with that character's kind (`girl`, `boy` or `other`, with no number) and carries that character's authored or derived appearance tags.
- A scene with one character is split the same way.

When the request goes to NovelAI V4+, Formamorph turns each `|` part after the first into a character prompt. The player sees and edits the same `|` line under the image, so a hand edit (adding a tag to one character, adding a third part) is honored on the next draw. A `|` typed into the editor's Generate dialog is honored too.

Every other provider gets the line with each spaced ` | ` turned into a comma, so a stored scene line still draws after the player switches presets. NovelAI V3 gets the line unchanged, because V3 reads `|` as its own Prompt Mixing (Q6).

## User Stories

1. As a player on NovelAI, I want each character's appearance tags sent as that character's own prompt, so that one character's hair, eyes and clothes do not appear on the other.
2. As a player on NovelAI, I want the subject counts in the base prompt, so that NovelAI draws the right number of people.
3. As a player on NovelAI, I want each character prompt to open with `girl`, `boy` or `other`, so that NovelAI knows what kind of person each prompt describes.
4. As a player on NovelAI, I want the action and place tags in the base prompt, so that the whole frame shares one scene and one pose description.
5. As a player on NovelAI, I want my image preset's positive prompt prefix to stay in the base prompt, so that my quality and style tags apply to the whole image.
6. As a player on NovelAI, I want a one-character scene split the same way, so that every scene image follows one rule.
7. As a player on NovelAI, I want the split to happen without a new setting, so that the better prompt is the default for every NovelAI V4+ preset.
8. As a player on NovelAI, I want the scene tag line under the image to show the `|` parts, so that I can read what each character prompt holds.
9. As a player on NovelAI, I want to edit one character's part of the line and redraw, so that I can fix one character without touching the other.
10. As a player on NovelAI, I want a third `|` part I type by hand to become a third character prompt, so that I can add a character the composer did not include.
11. As a player on NovelAI, I want two characters who share a tag (`long hair`) to both keep it, so that the dedupe never strips one character's feature.
12. As a player on NovelAI, I want the split to work with **Clean Up Tags** on or off, so that the cleanup never breaks the separators.
13. As a player on NovelAI with **Clean Up Tags** off, I want my weights and NovelAI syntax kept inside each part, so that hand-written emphasis still works per character.
14. As a player on NovelAI, I want the character list order to follow the scene cast order (the persona first when in frame), so that NovelAI's left-to-right placement matches who leads the scene.
15. As a player on NovelAI, I want NovelAI to choose where each character stands, so that I get the same placement behavior as NovelAI's "AI's Choice".
16. As a player on NovelAI, I want each character prompt to get a matching empty negative prompt, so that the request has the shape NovelAI's own clients send.
17. As a player on NovelAI V5, I want the same split, so that the newest model also keeps characters apart.
18. As a player on NovelAI V3, I want my `|` left as typed, so that V3 Prompt Mixing keeps working (Q6).
19. As a player on A1111, ComfyUI, InvokeAI or OpenAI, I want the `|` turned into commas, so that a scene line written under a NovelAI preset still draws after I switch presets.
20. As a player on a non-NovelAI provider, I want my scene line composed exactly as today, so that this change has no effect on my images.
21. As a world author on NovelAI, I want to type `|` in the editor's Generate dialog prompt, so that I can test multi-character prompts on a subject image.
22. As a player on NovelAI, I want a character with no tags at all to still get a part with only their kind, so that NovelAI still draws a separate person.
23. As a player on NovelAI, I want location tags such as `no humans` still dropped when characters are present, so that the base prompt does not contradict the cast.
24. As a player on NovelAI, I want character and place names still stripped from the action tags, so that invented names never reach the image model.
25. As a player on NovelAI, I want an empty `|` part ignored, so that a stray separator in a hand edit does not create a blank character.
26. As a player who saved a game before this change, I want old flat scene lines to draw as before, so that nothing in my save needs a migration.

## Implementation Decisions

- **Segmented composition is part of the scene tag composer.** The composer gets one new input that asks for the segmented form. Without it, the output is byte-for-byte what it is today.
- **Segmented line layout:** `<counts>, <action>, <place> | <kind>, <character 1 tags> | <kind>, <character 2 tags>`. Count tags are derived for the group as today. Each part strips the character's own count tags and `solo` tags, then leads with the kind that the count derivation already decides for that character (`girl`, `boy`, else `other`).
- **Normalize and dedupe per part.** The tag normalizer runs on each part on its own, and the parts join with ` | `. A tag may appear in two parts. This also keeps **Clean Up Tags** from turning `|` into a space.
- **Who asks for the segmented form:** the in-game scene tag run. It asks when the active image preset's provider is NovelAI and its model is V4, V4.5 or V5. The rule for "NovelAI V4+" is one shared predicate, the same one the NovelAI request builder uses to pick caption-wrapped prompts.
- **The stored scene line stays a string.** The turn's `sceneTags` field keeps its type. It may now hold `|`. **This is not a save export-shape change:** the field and its type are unchanged.
- **Splitting happens on our side.** The NovelAI request builder splits the final prompt on `|`. The first part becomes `base_caption`; each further non-empty, trimmed part becomes one `char_captions` entry `{ char_caption, centers: [{ x: 0.5, y: 0.5 }] }`. The negative caption gets one entry per character with an empty `char_caption` and the same center. `use_coords` stays `false` and `use_order` stays `true`. The top-level `input` and the V3 `prompt` fields get the base part only on V4+, and the unchanged line on V3 (Q6).
- **Rationale for client-side splitting:** every working NovelAI client checked (novelai-sdk, Marinara-Engine, a ComfyUI node, a SillyTavern plugin) builds `char_captions` itself. Whether NovelAI's server also parses `|` inside `base_caption` is UNVERIFIED. Client-side splitting is correct in both cases.
- **Flattening for everything else.** The shared image request builder turns each ` | ` (whitespace on both sides) into `, ` for every provider other than NovelAI. A bare `|` stays literal, so A1111 alternation `[cow|horse]` and ComfyUI wildcards `{a|b}` survive (Q5). NovelAI V3 is not flattened (Q6).
- **Splitting on V4+ uses any `|`**, spaced or bare: NovelAI V4+ has no other `|` syntax (Q5). Each part has leading and trailing commas trimmed, so `prefix, | girl` gives base `prefix`. A `|` inside the preset prefix also splits on V4+; that is accepted.
- **Preset prefix placement.** The request builder still joins the preset's positive prompt in front of the subject prompt, so the prefix lands in the base part. No change is needed for that.
- **The cast cap stays at two.** NovelAI allows more (6 on V4/V4.5, 22 on V5); raising the cap is out of scope.
- **No new setting, no settings default, no prompt text change.** The scene tag pass prompt is unchanged, so no probe is needed.
- **No version bump and no migration.** Old flat lines have no `|` and draw as before.

## Testing Decisions

- A good test calls the public function with realistic input and asserts on its output. It never mirrors the implementation's string building. Each guard is proven by reinstating the bug it guards (for example, a shared dedupe across parts must fail the shared-tag test).
- **Seam 1: the scene tag composer.** Extend the existing scene tag composer tests. Cover: two characters give counts in the base and `girl`/`boy` kinds in their parts; one character is still split; a tag shared by both characters stays in both parts; **Clean Up Tags** on keeps the separators; **Clean Up Tags** off keeps NovelAI syntax inside a part; an untagged character gets a kind-only part; `no humans` still drops; names are still stripped from the action; without the new input the output is unchanged (the existing tests stay green as written).
- **Seam 2: the image request builder feeding the NovelAI request builder.** Extend the existing NovelAI request builder tests and the shared request builder tests. Cover: a pipe line on V4.5 and V5 gives `base_caption` plus one `char_captions` entry per part, with matching empty negative entries; an empty part is skipped; the preset prefix lands in the base; V3 gets the line unchanged; A1111 and one other provider get ` | ` flattened while a bare `|` (`[cow|horse]`) stays; a line with no `|` gives `char_captions: []` exactly as today.
- No GameViewer test: the scene tag run only passes the flag. The user confirmed these two seams.
- Prior art: the existing scene tag composer tests and the NovelAI request builder tests (`buildNovelAIBody` cases for V3, V4.5 and V5).

## Out of Scope

- Per-character action tags with NovelAI's `source#`, `target#` and `mutual#` prefixes. That needs the scene tag pass to write one line per character, which is a prompt change with probes. It is the planned follow-up step (option B in the notes).
- A structured scene line or one edit box per character (option C, rejected).
- Raising the two-character cast cap for NovelAI.
- Character positions on the canvas (`use_coords: true`).
- Per-character negative prompts with content.
- The root-level `characterPrompts` field. novelai-sdk sends it next to `char_captions`; Marinara-Engine sends `char_captions` alone. Add it only if images show the split is ignored.
- Settling whether NovelAI's server parses `|` itself. That needs a paid request.

## Rulings

- **Q5** (ticket 01, 2026-10-20). Flatten only a spaced ` | ` for non-NovelAI providers; NovelAI V4+ splits on any `|`. Per-part comma trim accepted; a `|` in the preset prefix splits on V4+.
- **Q6** (user, 2026-10-20). NovelAI V3 keeps `|` as typed, for Prompt Mixing. Supersedes the original story 18 (flatten on V3).

## Further Notes

- Research and rulings: `docs-internal/notes/novelai-multi-character/notes.md`.
- Source: NovelAI's Multi-Character Prompting docs say count tags go in the base and each character prompt uses `girl`, `boy` or `other` with no number, and that the order of the character prompts sets placement.
- Follows the per-preset **Clean Up Tags** setting, which shipped first so players could keep NovelAI syntax by hand.
- Changelog: one 👤 Added entry for NovelAI scene images keeping characters apart.
