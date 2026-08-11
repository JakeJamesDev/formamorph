/**
 * Shiki themes for markdown code fences, painted from the app's own `--code-*` palette so a fence in a
 * help popup matches the stat-code editor beside it.
 *
 * Shiki never parses a theme's colors — it copies them into the rendered spans — so each one can be a
 * `hsl(var(…))` reference rather than a literal. The palette therefore has exactly one home
 * (`index.css`), and since those vars already flip under `.dark`, both entries of Shiki's required
 * [light, dark] pair are the same mapping.
 *
 * The buckets mirror `codeHighlightStyle`'s, and the TextMate scopes are grouped to land where Lezer
 * puts the equivalent token: plain operators read as punctuation, `typeof`/`new` read as keywords.
 */

import type { ThemeRegistrationAny } from 'streamdown';

const v = (token: string) => `hsl(var(--code-${token}))`;

const SETTINGS: NonNullable<ThemeRegistrationAny['settings']> = [
  { settings: { foreground: v('variable') } },
  {
    scope: ['keyword', 'storage', 'storage.type', 'keyword.control', 'keyword.operator.expression', 'keyword.operator.new', 'variable.language'],
    settings: { foreground: v('keyword') },
  },
  { scope: ['string', 'string.regexp', 'constant.character.escape', 'punctuation.definition.string'], settings: { foreground: v('string') } },
  { scope: ['constant.numeric', 'constant.language'], settings: { foreground: v('number') } },
  { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: v('comment'), fontStyle: 'italic' } },
  { scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function'], settings: { foreground: v('function') } },
  {
    scope: ['variable.other.property', 'support.type.property-name', 'meta.object-literal.key', 'entity.other.attribute-name'],
    settings: { foreground: v('property') },
  },
  { scope: ['variable', 'entity.name.type', 'support.class', 'support.type'], settings: { foreground: v('variable') } },
  // Lezer bolds a name at its declaration; these are the scopes that land on one.
  { scope: ['variable.other.constant', 'meta.definition.variable', 'variable.parameter'], settings: { foreground: v('variable'), fontStyle: 'bold' } },
  // The fat arrow is `storage.type` to TextMate but an operator to Lezer, which reads it as punctuation.
  { scope: ['punctuation', 'meta.brace', 'keyword.operator', 'punctuation.accessor', 'storage.type.function.arrow'], settings: { foreground: v('punctuation') } },
  { scope: ['invalid'], settings: { foreground: 'hsl(var(--destructive))' } },
];

// Transparent so the fence keeps whichever surface it sits on rather than carrying an editor's page color.
const base = { bg: 'transparent', colors: { 'editor.background': 'transparent', 'editor.foreground': v('variable') }, settings: SETTINGS };

export const markdownCodeThemes: [ThemeRegistrationAny, ThemeRegistrationAny] = [
  { ...base, name: 'formamorph-light', type: 'light' },
  { ...base, name: 'formamorph-dark', type: 'dark' },
];
