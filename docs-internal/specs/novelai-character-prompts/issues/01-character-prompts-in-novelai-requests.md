# 01: Character Prompts In NovelAI Requests

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: two pure request builders and their tests, with the wire shape already settled in the spec.

## What to build

A prompt line that holds `|` becomes NovelAI character prompts on a NovelAI V4, V4.5 or V5 preset. The first part is the base prompt; each further non-empty part is one character prompt, with a matching empty negative entry and NovelAI's own placement (`use_coords: false`). The preset's positive prompt prefix stays in the base. Every other provider, and NovelAI V3, gets the line with each ` | ` turned into `, `. A line with no `|` sends exactly what it sends today. A world author can test this right away by typing `|` in the editor's Generate dialog.

Spec: stories 5, 10, 15–19, 21, 25, 26; decisions on client-side splitting, flattening and prefix placement.

## Acceptance criteria

- [ ] On V4.5 and V5, a `base | a | b` prompt gives `base_caption` = base and two `char_captions` entries `{ char_caption, centers: [{ x: 0.5, y: 0.5 }] }`, plus two empty negative entries with the same centers.
- [ ] An empty or blank part is skipped; parts are trimmed.
- [ ] The preset's positive prefix lands in the base part.
- [ ] On V4+, `input` carries the base part only.
- [ ] NovelAI V3 and at least A1111 plus one other provider get the flattened comma line.
- [ ] A line with no `|` gives `char_captions: []` and the same body as before.
- [ ] One shared "NovelAI V4+" predicate is exported for ticket 02.
- [ ] Tests at the request-builder seam; each guard proven by reinstating its bug.
- [ ] Four gates green.
