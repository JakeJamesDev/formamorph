# NovelAI multi-character scene prompts — proposal

Status: ruled 2026-10-20. No code yet.

## Rulings

- **Q1.** Build A now. B is a separate, probed step later. C is out.
- **Q2.** Segmented line is automatic on every NovelAI V4+ preset. No new setting.
- **Q3.** One-character scenes segment too.
- **Q4.** Keep the two-character cap for now.
- Open: spend one paid request on the `|`-in-`base_caption` question (not needed for A).

Goal: on NovelAI V4+, send each cast member's tags as their own character prompt, so features stop leaking between characters. Follows the per-preset **Clean Up Tags** setting (53bd06ae4).

## What the API takes (verified 2026-10-20)

| Fact | Source |
|---|---|
| Base prompt carries scene, style, and the count tags (`2girls`). Each character prompt says `girl` / `boy` / `other` with no number. | [NovelAI docs, Multi-Character Prompting](https://docs.novelai.net/en/image/multiplecharacters) |
| `source#` / `target#` / `mutual#` prefix an action tag in each character's prompt. The docs call it "not always reliable". | same page |
| V4 / V4.5: up to 6 characters, positions snap to a 5×5 grid. V5: up to 22, free positions. | same page; caru-ini/novelai-sdk `converter.py` |
| `|` in the prompt splits base and characters **in the web UI**. It is off when any character box exists. | same page |
| Wire shape, all of V4 / V4.5 / V5: `v4_prompt.caption.char_captions: [{ char_caption, centers: [{x, y}] }]`. `v4_negative_prompt` carries one entry per character (empty `char_caption` is fine). Optional root `characterPrompts: [{ prompt, uc, center, enabled }]`. | caru-ini/novelai-sdk (`types/api/image.py`, `_utils/converter.py`); Pasta-Devs/Marinara-Engine `image-generation.ts`; mrm987/ComfyUI_Multi_Prompt_Generator |
| `use_coords: false` = "AI's Choice" placement; the server ignores `centers` then. Order follows the list (first = left with `side-by-side`). | novelai-sdk `_uses_coords` comment; docs |
| V5 sends `params_version: 4`, else 3. We already do this. | novelai-sdk `converter.py` |

> ⚠️ **UNVERIFIED: whether the API parses `|` inside `base_caption`.** Every client I read splits `|` on its own side before it sends (novelai-sdk takes structured characters; ComfyUI_Multi_Prompt_Generator and dsh-tavern split `|` into `char_captions`). The docs' "off when a box exists" rule also points to a UI-side parse. One paid request would settle it. **Plan for client-side splitting either way:** it is what the working clients do, and it costs nothing if the server also parses.

## What our code does today

- `composeSceneTags` ([sceneTags.ts](../../../src/lib/sceneTags.ts)) builds one flat line: counts, appearance, action, place. It dedupes across the whole line.
- The tag pass ([GamePrompts.ts:536](../../../src/components/game/GamePrompts.ts:536)) writes **one** action line for the whole frame. It has no per-character output, so it cannot place `source#` / `target#` today.
- `runSceneTags` ([GameViewer.tsx:3940](../../../src/views/GameViewer.tsx:3940)) stores the line as the turn's `sceneTags` string. The player edits that string, and `runSceneImage` sends it verbatim.
- [novelai.ts](../../../src/lib/imageGen/novelai.ts) sends `char_captions: []`, `use_coords: false`.
- **Trap:** Clean Up Tags on turns `|` and `#` into spaces (`cleanTag`), and the cross-line dedupe would drop a tag that two characters share (`long hair`). Any segmented line must normalize and dedupe **per segment**.

## Options

### A. Pipe line, no action split — ~½ day

- Composer gets a segmented form for NovelAI V4+: `counts, action, place | girl, <char 1 tags> | boy, <char 2 tags>`. Normalize and dedupe per segment.
- `novelai.ts` splits `|` into `char_captions` (plus matching empty negatives). One shared helper, so the editor's Generate dialog also honors a hand-typed `|`.
- Other providers flatten ` | ` to `, ` before they send, so a stored line still works after a provider switch.
- The stored `sceneTags` stays a string. The player edits it in NovelAI's own documented syntax.
- ✅ No prompt change, no shape change. ❌ Action tags stay in the base, so "who hugs whom" is still up to the model.

### B. A + per-character action tags — ~2 days

- Everything in A, plus the tag pass writes one line per person (`<name>: tags`) with `source#` / `target#` / `mutual#` on interactions. The composer routes each line into that character's segment; frame-wide tags (framing, light) go to the base.
- `cleanTag` keeps the three `#` prefixes even with Clean Up Tags on.
- ⚠️ A prompt change: needs probe numbers on the cloud model (5–12 runs per arm), and the docs say the syntax is unreliable. The non-NovelAI path also needs a flat-line fallback from the same pass.

### C. Structured scene line — ~4–5 days

- `sceneTags` becomes `{ base, characters: [{ name, tags }] }`. `ImageGenParams` gets `characters`. The edit field under the image becomes one box per character.
- ⚠️ **Save export-shape change.** Adds no capability over A/B: the pipe string is already NovelAI's own format.

## Recommendation

**A now, B as its own step after a probe.** A fixes the reported leak with no prompt or shape risk. B's gain depends on a syntax NovelAI itself calls unreliable, so it should earn its place with numbers. Skip C.

## Open questions for the grill

1. Segmented form: automatic for every NovelAI V4+ preset, or behind its own setting?
2. One-character scenes: segment too (`1girl, … | girl, …`), or stay flat?
3. Raise the 2-character cap (`MAX_SCENE_CHARACTERS`) for NovelAI (V4 up to 6, V5 up to 22)?
4. Spend one paid request to settle the `|`-in-`base_caption` question?
