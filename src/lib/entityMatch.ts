import pluralize from 'pluralize';
import commonWordsCore from 'wordlist-english/english-words-10.json';
import commonWordsExtra from 'wordlist-english/english-words-20.json';
import type { Entity } from '@/types';
import { escapeRegExp } from './utils';

/**
 * Detect which of a set of names appear in a block of text — the canonical "who is in this narration"
 * parse. Used to fill the Entities tab, store per-turn participation, and scope the choices request.
 *
 * Matching rules (per name):
 * - **Single-word** name: counts only when it occurs with an **initial capital** (proper-noun use), so a
 *   name that is also a common word (Hope, Will, Rose, Crow) doesn't match ordinary lowercase prose.
 * - **Multi-word** name: the words in order within a short window (so "Emily J. Foster" counts but two
 *   unrelated sentences sharing a word do not), or (partial) a *distinctive* word used as a proper noun —
 *   so "Emily" marks "Emily Foster" present. The capital guard keeps lowercase common-word usage out.
 * - Plurals match via `pluralize` (irregulars included: Wolf↔Wolves, City↔Cities); blank names skipped. A sub-3-char word (e.g. surname "Wu") is
 *   below the significance floor, so a bare "Wu" won't match "Ling Wu" — the in-order pass still does.
 * - Pass `partial: false` for consumers where a false positive has real consequences (the visitor pull,
 *   which relocates an authored NPC); that drops the single-word partial pass, leaving in-order matching.
 */

// The distinct singular + plural surface forms of a word/phrase (deduped, blanks dropped). `pluralize`
// inflects on the final word, so a phrase like "Iron Gate" yields "Iron Gate"/"Iron Gates" and handles
// irregulars ("Wolf"→"Wolves", "City"→"Cities", "Child"→"Children"). Proper nouns it can't inflect
// cleanly (e.g. "Reyes") stay self-consistent — a bad form simply never appears in prose, so it's inert.
const wordForms = (word: string): string[] =>
  [...new Set([word, pluralize.singular(word), pluralize.plural(word)])].filter(Boolean);

// A word-boundary match for `word` OR its singular/plural forms. Default case-insensitive; pass 'gi' for
// iteration via exec().
const makeWordRegex = (word: string, flags = 'i'): RegExp =>
  new RegExp(`\\b(?:${wordForms(word).map(escapeRegExp).join('|')})\\b`, flags);

// Words common enough that they carry no identifying signal on their own. SCOWL frequency tiers 10+20
// (~10.7k words) — deep enough to cover the name-shaped ones (hope, will, rose, dawn, blade, mill, wolf,
// guard, captain), shallow enough that real surnames (Foster, Crow, Marsh) stay distinctive.
const COMMON_WORDS = new Set<string>([...commonWordsCore, ...commonWordsExtra]);

// How many unrelated words may sit between two words of a name and still count as the same phrase —
// absorbs middle initials, honorifics, and parentheticals without spanning a sentence break.
const MAX_NAME_GAP_WORDS = 2;

/** True if `name` appears in `text` with an uppercase first letter (a proper-noun occurrence). */
function occursCapitalized(text: string, name: string): boolean {
  const re = makeWordRegex(name, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (/[A-Z]/.test(m[0].charAt(0))) return true;
  }
  return false;
}

/**
 * The subset of `names` that `text` contains, deduped and returned in first-seen order. The capital guard
 * on single-word names suits proper-cased narration; pass `requireCapital: false` for lowercase sources
 * (e.g. player actions) so a single-word name matches case-insensitively.
 */
export function matchNames(
  text: string,
  names: string[],
  opts: { requireCapital?: boolean; partial?: boolean } = {},
): string[] {
  const { requireCapital = true, partial: allowPartial = true } = opts;
  if (!text) return [];
  const found = new Set<string>();
  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed || found.has(name)) continue;
    const words = trimmed.toLowerCase().split(/\s+/);
    if (words.length === 1) {
      const matched = requireCapital
        ? occursCapitalized(text, trimmed)
        : makeWordRegex(trimmed).test(text);
      if (matched) found.add(name);
      continue;
    }
    // Partial reference: a distinctive word used as a proper noun (e.g. "Emily" for "Emily Foster").
    const sig = distinctiveWords(trimmed);
    const partial = allowPartial && (requireCapital
      ? sig.some((w) => occursCapitalized(text, w))
      : sig.some((w) => makeWordRegex(w).test(text)));
    if (partial || occursInOrder(text, words)) found.add(name);
  }
  return [...found];
}

/** True if any of an entity's aliases appears in `text`. Aliases match differently from names: exact
 *  **case-sensitive** and `\b`-word-bounded (so short nicknames like "Em" don't hit "System"), with the
 *  the same `pluralize`-based plural matching names get. A hit resolves to the entity's canonical name upstream. */
function anyAliasMatches(text: string, aliases: string[] | undefined): boolean {
  if (!aliases) return false;
  for (const alias of aliases) {
    const trimmed = alias?.trim();
    if (!trimmed) continue;
    if (makeWordRegex(trimmed, '').test(text)) return true;
  }
  return false;
}

// Straight or curly double-quoted spans. Single quotes are left alone — apostrophes make them
// unreliable. A trailing unterminated opener runs to the end of the text.
const QUOTED_SPEECH_RE = /["“][^"”]*(?:["”]|$)/g;

/**
 * The narrative prose of `text` with quoted speech removed — what a character is *doing* on the page,
 * rather than what other characters say about them. Presence parses read this: a name that only ever
 * appears inside quotation marks was talked about, not present. Mid-stream, an unterminated opening
 * quote swallows the rest, so a partial narration errs toward "this is dialogue" and resolves on the
 * next tick.
 */
export function stripQuotedSpeech(text: string): string {
  if (!text || !/["“]/.test(text)) return text;
  // Per paragraph: continuing speech re-opens each paragraph and closes only the last, so a span never
  // crosses a paragraph break — matching across one reads the next opener as a closer and leaks the
  // second paragraph's speech into prose.
  return text.split(/(\n\s*\n)/).map((part, i) => (i % 2 ? part : part.replace(QUOTED_SPEECH_RE, ' '))).join('');
}

/**
 * The names of the defined entities that appear in `text`. An entity counts when its **name** matches
 * (via `matchNames`) OR any of its **aliases** matches (case-sensitive, word-bounded); either way the
 * returned value is the entity's canonical name. Name hits keep their in-text order; alias-only hits
 * follow in entity order. Deduped.
 */
export function findEntityNames(
  text: string,
  entities: Entity[],
  opts?: { requireCapital?: boolean; partial?: boolean },
): string[] {
  const found = matchNames(text, entities.map((e) => e.name), opts);
  for (const entity of entities) {
    if (found.includes(entity.name)) continue;
    if (anyAliasMatches(text, entity.aliases)) found.push(entity.name);
  }
  return found;
}

/**
 * The defined entity a scene participant's name refers to. An exact (case-insensitive) name match wins;
 * failing that, a **whole-word** containment either way, so a partial reference still resolves ("Emily" →
 * "Emily Foster") while two names merely sharing a fragment stay distinct ("Wolf" is not "Direwolf").
 * Plural forms match as elsewhere here. Returns undefined for an ad-hoc participant with no entity behind it.
 */
export function resolveEntityByName<T extends { name: string }>(name: string, entities: T[]): T | undefined {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  const exact = entities.find((e) => e.name?.trim().toLowerCase() === lower);
  if (exact) return exact;
  const nameRe = makeWordRegex(trimmed);
  return entities.find((e) => {
    const other = e.name?.trim();
    if (!other) return false;
    return nameRe.test(other) || makeWordRegex(other).test(trimmed);
  });
}

// Short/function words dropped before loose matching so a name like "The Wolf" can't match on "the".
const LOOSE_STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'with']);

const significantWords = (name: string): string[] =>
  name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && !LOOSE_STOPWORDS.has(w));

/**
 * The words of `name` that could identify it on their own: its significant words minus the everyday ones.
 * A name whose words are *all* everyday ("Rose Wolf", "Iron Gate") keeps them — dropping every word would
 * guarantee a miss, and a false positive is the cheaper error for the surfaces this feeds.
 */
const distinctiveWords = (name: string): string[] => {
  const sig = significantWords(name);
  const distinct = sig.filter((w) => !COMMON_WORDS.has(w));
  return distinct.length > 0 ? distinct : sig;
};

/**
 * True if every word of a multi-word name occurs in `text` in order, with at most `MAX_NAME_GAP_WORDS`
 * unrelated words between neighbors — the phrase test that replaces a bare "all words appear somewhere"
 * check, which let two unrelated clauses ("the old woman … a young man") satisfy "Old Man".
 */
function occursInOrder(text: string, words: string[]): boolean {
  const gap = String.raw`(?:\W+\w+){0,${MAX_NAME_GAP_WORDS}}\W+`;
  const parts = words.map((w) => `(?:${wordForms(w).map(escapeRegExp).join('|')})`);
  return new RegExp(`\\b${parts.join(gap)}\\b`, 'i').test(text);
}

/**
 * Whether two names likely refer to the same character — conservative, for de-duping discovered
 * runtime characters. True when the names are equal, or one's significant-word set is a non-empty
 * SUBSET of the other's (so "Aldric" ⊆ "Sergeant Aldric" merge, but "Woman with Knife" and "Merchant
 * with Rusty Blade" do not, nor "Man with Knife" vs "Woman with Knife"). Subset (not any-overlap) keeps
 * it from over-merging on a shared generic noun. Cannot link pure renames with no shared token
 * ("Woman with Knife" → "Mira"); that needs semantic tracking, out of scope here.
 */
export function sameCharacterName(a: string, b: string): boolean {
  const an = a?.trim().toLowerCase();
  const bn = b?.trim().toLowerCase();
  if (!an || !bn) return false;
  if (an === bn) return true;
  const aw = new Set(significantWords(a));
  const bw = new Set(significantWords(b));
  if (aw.size === 0 || bw.size === 0) return false;
  const [small, large] = aw.size <= bw.size ? [aw, bw] : [bw, aw];
  for (const w of small) if (!large.has(w)) return false;
  return true;
}

/**
 * Looser counterpart to `matchNames`: a name counts when **any** of its significant words appears
 * (case-insensitive, plural-tolerant, no capital guard). Intended only for names already vouched for by
 * another source — e.g. defined entities the staged director cast — so "the tank rolls" still confirms a
 * "Battle Tank" the director named, without the strict parse's full-name/capitalization requirement.
 */
export function matchNamesLoose(text: string, names: string[]): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed || found.has(name)) continue;
    const words = significantWords(trimmed);
    if (words.some((w) => makeWordRegex(w).test(text))) found.add(name);
  }
  return [...found];
}
