# 05 — Roll field per-chip spans

Status: done
Type: task
Blocked by: 01
Spec: ../spec.md (Roll field colors)

## Task

- `lib/placeholders.ts`: `drawPlaceholderSpans(ph, placeholders, weights?, pick?)` returns
  `{ text: string; placeholderId?: string }[]`. Draw the value as today, then split it with
  `parsePlaceholderText`: a literal segment is a plain span; a chip segment resolves to one span
  tagged with the chip's placeholder id. A lone-chip value is one tagged span. `drawPlaceholderOnce`
  becomes the joined text of the spans, so existing callers see no change.
- Value pins (ticket 06) apply inside the draw once that ticket lands; until then the draw is the
  same as today.
- `managers/PlaceholderManager.tsx:355-363`: the result `<p>` renders spans. A tagged span is a
  `<mark>` styled with the same tint `PreviewPane` uses for `placeholderAccent(id)`, `title` = the
  placeholder's display name. Plain spans are plain text. `(nothing)` unchanged.

## Acceptance

- Spans test: a value `{Hair}, {Eyes}` yields four spans (Hair, literal, Eyes) with the right ids;
  a lone chip yields one tagged span; a plain value yields one plain span.
- Joined spans equal `drawPlaceholderOnce` output for the same pick.
- `PlaceholderManager.test.tsx`: the roll renders a `<mark>` per tagged span with the accent color
  (compare through the `cssColor` helper).
- Four gates green.

## Answer

Done. The resolver's value walk is now span-based: `phSpans` and `valueSpans` in `lib/placeholders.ts`
return `PlaceholderSpan[]`, and `resolvePh` / `resolveValue` are their joins, so the string form cannot
drift from the spans. `drawPlaceholderSpans` builds the same context as the old draw and starts at the
placeholder; `drawPlaceholderOnce` is its join. Empty spans are dropped, so a chip that resolves to
nothing leaves no mark. An Object joins its non-empty values with a literal `, ` span.

The Roll field maps spans to `<mark>` with `tintMarkStyle(placeholderAccent(id))` and `TINT_MARK_CLASS`.
The name rides in a `Tip` (`labelsChild={false}`), not a native `title`, because the lint rule
`formamorph/no-native-title` forbids the attribute. The name is `qualifiedPlaceholderName(..., editing.id)`,
so an owned row of the edited placeholder reads bare and anything else reads `Owner › Name`.

Acceptance note: `{Hair}, {Eyes}` yields three spans (chip, literal, chip), not four as the ticket's text
says; the parenthetical list in the ticket names three.
