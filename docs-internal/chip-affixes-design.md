# Chip affixes — phase 1 spec

**Status:** ✅ **phase 1 built** (2026-07-26) — token grammar, renderer, editor fields, `restyle` and `setAxis` preservation, all eight gate tests green and mutation-checked. Phase 2 (Parent scope, Time chip, Entities "In scene" scope, retiring the three clause tokens, two-row popover, preview real values) is not started.

One thing the build found that this spec missed: `chipVocabulary.setAxis` dropped affixes exactly like `restyle` did — switching a chip's mode in the editor would have deleted the user's wording. Same root cause (rebuilding a token through `withVariant`), same fix (`joinToken`), and it now has its own gate test.

**Problem.** A chip used inside a sentence needs connective words around it, and those words must disappear when the chip has no value. `Now you are at <LOCATION|name>, inside <LOCATION|parent.name>` reads as "…inside ." at a top-level location, or "…inside N/A" today. So far this has been solved four times by hardcoding the whole clause into a bespoke token (`<SCENE CAST>`, `<SCENE NOTES>`, `<SCENE TIME>`, and a proposed `<SCENE PARENT>`), which freezes the wording in code.

**Fix.** A chip placement carries an optional **prefix** and **suffix**. They render only when the chip's value is non-empty; when it is empty, the value *and* both affixes render as nothing.

---

## 1. Token grammar

Today ([promptTemplate.ts:11](src/lib/promptTemplate.ts:11)) the grammar is closed on both halves:

```
(?: <LOCATION | <ENTITIES | … )  (?:\| (?: name | summary | reachable.summary.markdown | … ) )?  >
      closed list of bases              closed list of variant ids
```

Phase 1 extends it to:

```
<BASE [|variantId] [|pre="…"] [|post="…"]>
```

| Rule | Value |
|---|---|
| Order | Always base, then variant, then `pre`, then `post`. Any other order does not match. |
| Distinguishing a variant from an affix | Variant ids never contain `=`; a part beginning `pre=` or `post=` is an affix. No ambiguity. |
| Delimiter | Double quotes, so leading/trailing spaces are visible in raw text: `pre=", inside "` |
| Reserved character | `"` only. It cannot appear in affix text and the editor blocks it. `>` and `|` are safe because the quotes delimit — this is what stops a stray `>` silently truncating a token. |
| Escape scheme | None. One banned character beats an escape grammar for a field that holds connective words. |
| Length cap | 40 characters per affix. |
| Emitted only when non-empty | `pre=""` is never written; the part is omitted instead. |

**Canonical form is the only accepted form.** Anything else — wrong order, unquoted, an empty affix written out — fails to match and stays literal text, exactly as `<LOCATION|banana>` does today. That is what makes `serialize(parse(x)) === x` provable rather than hoped for.

## 2. Renderer

`renderPromptTemplate` is currently a dictionary lookup over precomputed token strings. With affixes the set of legal token strings is infinite, so the lookup key has to be derived:

```
replace(TOKEN_RE, (match) => {
  const { key, pre, post } = splitToken(match)   // key = "<BASE|variantId>", affixes stripped
  const value = values[key]
  if (value === undefined) return match          // unknown token untouched — unchanged behavior
  if (!pre && !post) return value                // no affixes — byte-identical to today
  if (isBlank(value)) return ''                  // affixed + empty ⇒ the whole placement vanishes
  return pre + value + post
})
```

`isBlank(v)` = `v.trim() === ''` **or** `v === NONE_PLACEHOLDER`. The `N/A` case matters: absent values render `N/A` today, and "inside N/A" is the bug being fixed.

**The vanish rule fires only when an affix is set.** A bare `<ENTITIES|name>` still renders `N/A` when nobody is present, exactly as now. Nothing that exists today changes behavior.

New helpers `splitToken` / `joinToken` live in `promptVariables.ts` beside `baseToken` / `withVariant`.

## 3. `restyle` preservation

[sectionStyle.ts:59](src/lib/sectionStyle.ts:59) rebuilds every format-bearing token through `baseToken` + `withVariant` when a preset is downcast to Simple or XML. Both must route through `splitToken`/`joinToken` so affixes survive. Without this, switching section style silently deletes the user's wording — no error, no undo.

## 4. Editor

Two text fields in the chip popover, shown only for affix-capable chips.

- **Visible whitespace.** Leading and trailing spaces render with a middot or shaded cell. These fields are almost entirely `" with "` and `", inside "`; invisible spaces are the likeliest thing to feel broken.
- Values are stored literally — no trimming, no auto-spacing.
- `"` is rejected on input with an inline explanation.
- The chip's highlight color extends over the affix text, so it reads as part of the chip rather than prose.
- Preview applies affixes and the vanish rule.

**Affix-capable in phase 1:** Location (Name variant), Entities (Name variant), Notes. Gated by an `affixable` flag on the `PromptVariable`. Time joins in phase 2 when that chip exists.

## 5. Test bar — the gate to advance to phase 2

| # | Test | Why |
|---|---|---|
| 1 | **Round-trip, property-based.** For every prompt in `PROMPT_TEXT_DEFAULTS` plus a generated corpus of tokens (all bases × all variant ids × affix present/absent/empty/spaces/punctuation), `serializeSegments(parsePromptTemplate(t)) === t` | Opening and closing the settings panel must never rewrite a stored prompt |
| 2 | **No-affix rendering is byte-identical.** Render every shipped prompt against a fixture value map, before and after the change; assert equality | The renderer is on the path of every AI call in the app |
| 3 | Affixed + value present → `pre + value + post` | core behavior |
| 4 | Affixed + value blank *or* `N/A` → `''` | the bug being fixed |
| 5 | Unaffixed + value blank → `N/A`, unchanged | no silent change to existing chips |
| 6 | `restyle` markdown → labels → xml → markdown preserves affixes exactly | the silent-deletion trap |
| 7 | Malformed affixes (`pre=unquoted`, wrong order, stray `>`) stay literal text | the typo net |
| 8 | Editor: parse → set affix → serialize produces canonical form; setting an affix to empty removes the part | canonical-form guarantee |

Tests 1, 2 and 6 are the ones that actually gate the phase; 3–5 are the feature.

## 6. Explicitly out of scope for phase 1

Parent scope · the Time chip · the Entities "In scene" scope · retiring `<SCENE CAST>`/`<SCENE NOTES>`/`<SCENE TIME>` · the two-row scope popover · the preview real-values fix. All of those are phase 2 and get cheap once the mechanism holds.

## 7. Compatibility

No world or save shape change. Prompt-preset **files** can now contain affixed tokens, which an older build would render as literal text — acceptable, since no released version has affixes and preset files are not forward-compatible in general. Every existing token is untouched and every existing preset renders identically.

## 8. Decisions already taken (do not relitigate)

Affixes encoded in the token, not a sidecar map — a preset is a plain string that gets copied, shared, and style-downcast, so the wording has to travel with it. Vanish-on-empty applies only to affixed placements. Whitespace is literal with a visible marker, not auto-spaced. No migration for local presets holding retired tokens; they will be recreated by hand.
