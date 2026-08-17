/**
 * The Triggers instrument's view-model: prose in, a full account of what the harness makes of it out.
 *
 * Everything here is a reading of the game's own passes — `explainActivation` for the dictionary,
 * `findEntityMatches` for presence — never a second implementation of either. What this module adds is the
 * part play has no reason to compute: why an entry that *didn't* fire didn't, phrased as something an
 * author can act on.
 */
import {
  explainActivation, historyForEntry, invalidRegexKeys, matchHits, matchRuleOf, parseKeywords,
  type ActivationReason, type MatchHit, type MatchRule, type ScanSource, type SecondaryStatus,
} from '@/lib/dictionaryUtils';
import { findEntityMatches, stripQuotedSpeech, type EntityMatch } from '@/lib/entityMatch';
import { describePlaceholders } from '@/lib/placeholders';
import type { DictionaryEntry, Entity } from '@/types';
import type { RuleWorld } from './rules';

/** The slices of the authored world the tracer reads. */
export type TriggerWorld = Pick<RuleWorld, 'entities' | 'dictionaries' | 'placeholders'>;

/**
 * Why an entry the author is looking at did not fire — the near-miss classes, from "you turned it off" to
 * "it matched, one message too far back". `no-match` is the honest floor: nothing about the entry is wrong,
 * the words simply are not there.
 */
export type NearMiss =
  | 'book-disabled'
  | 'entry-disabled'
  | 'no-keywords'
  | 'invalid-regex'
  | 'secondary-excluded'
  | 'secondary-absent'
  | 'beyond-scan-depth'
  | 'whole-word-blocked'
  | 'no-match';

/** One dictionary entry's verdict with everything the row needs to explain itself. */
export interface TriggerEntry {
  entryId: string;
  /** The entry as the dictionary list labels it, chips resolved; falls back to its first keyword. */
  name: string;
  bookId: string;
  bookName: string;
  /** `false` when the whole book is muted — the entry was never scanned. */
  bookEnabled: boolean;
  fired: boolean;
  reason: ActivationReason;
  /** Located primary-keyword occurrences behind a firing (empty otherwise). */
  hits: MatchHit[];
  secondary?: SecondaryStatus;
  rule: MatchRule;
  keywords: string[];
  constant: boolean;
  /** Absent when the entry fired. */
  nearMiss?: NearMiss;
  /** Keywords whose regex does not compile — reported on the entry whether or not it fired, so a broken
   *  pattern is a flag on the row rather than a failed run. */
  badPatterns: string[];
  /** The keywords the near-miss is about, where the class names any. */
  nearMissKeywords: string[];
  /** The literal text behind the near-miss, where one exists (the word a blocked substring sits inside). */
  nearMissSample?: string;
  /** The depth window that dropped a hit — present only on `beyond-scan-depth`. */
  scanDepth?: number;
}

/** A highlight in the pasted text, pointing at the row that claims it. */
export type TriggerMark =
  | { kind: 'entity'; id: string; label: string }
  | { kind: 'entry'; id: string; label: string; keyword: string };

/** One run of the pasted text: plain when `marks` is empty, otherwise claimed by everything covering it. */
export interface TriggerSegment {
  text: string;
  start: number;
  marks: TriggerMark[];
}

/** Everything the Triggers tab renders for one piece of prose. */
export interface TriggerReport {
  /** The detected entities, exactly as the game's presence parse reports them. */
  entities: EntityMatch[];
  /** Every entry in the world, fired first-class or not, in book then declaration order. */
  entries: TriggerEntry[];
  /** The pasted text split into plain and claimed runs. */
  segments: TriggerSegment[];
  /** How many entries got a verdict — what makes "nothing fired" read as a result. */
  checked: number;
  fired: number;
  /** How many of the fired entries fired because they are constant. */
  constant: number;
}

/** The region label the scene text is scanned under — the coordinate space the highlights live in. */
const SCENE_REGION = 'scene';

/** An entry as the dictionary list labels it. */
const entryLabel = (entry: DictionaryEntry, placeholders: TriggerWorld['placeholders']): string =>
  describePlaceholders(entry.name, placeholders) || parseKeywords(entry)[0] || 'Untitled entry';

/** An entity with its authored chips resolved, so matching runs against the words that will be on the page.
 *  A multi-value Wildcard resolves to a summary rather than a value and so matches nothing — which is the
 *  truth about a name that is only decided at play time. */
const resolveEntity = (entity: Entity, placeholders: TriggerWorld['placeholders']): Entity => ({
  ...entity,
  name: describePlaceholders(entity.name, placeholders),
  aliases: entity.aliases?.map((a) => describePlaceholders(a, placeholders)),
});

/** Where one specific keyword of `entry` hits, under that entry's own flags. Probing through `matchHits`
 *  keeps every question about "would this word have matched" on the one matcher. */
const keywordHits = (entry: DictionaryEntry, keyword: string, sources: ScanSource[]): MatchHit[] =>
  matchHits({ ...entry, key: [keyword] }, sources);

/** The near-miss verdict for an entry that did not fire, plus the evidence its sentence needs. */
function classify(
  entry: DictionaryEntry,
  scanned: ScanSource[],
  dropped: ScanSource[],
  secondary: SecondaryStatus | undefined,
): Pick<TriggerEntry, 'nearMiss' | 'nearMissKeywords' | 'nearMissSample' | 'scanDepth'> {
  const keywords = parseKeywords(entry);
  if (entry.enabled === false) return { nearMiss: 'entry-disabled', nearMissKeywords: [] };
  if (!entry.constant && keywords.length === 0) return { nearMiss: 'no-keywords', nearMissKeywords: [] };

  // A primary hit that still didn't fire can only have been stopped by the secondary gate.
  if (secondary && matchHits(entry, scanned).length > 0) {
    if (secondary.exclude) {
      const present = secondary.keywords.filter((k) => keywordHits(entry, k, scanned).length > 0);
      return { nearMiss: 'secondary-excluded', nearMissKeywords: present };
    }
    const missing = secondary.keywords.filter((k) => keywordHits(entry, k, scanned).length === 0);
    return { nearMiss: 'secondary-absent', nearMissKeywords: missing };
  }

  // Only when *every* primary pattern is broken is the regex the reason: one bad key beside a healthy one
  // that simply isn't in the text (or a bad secondary, which gates rather than triggers) is a flag on the
  // row, and blaming it would send the author to repair a pattern that stopped nothing.
  const bad = invalidRegexKeys(entry);
  const badPrimary = keywords.filter((k) => bad.includes(k));
  if (keywords.length > 0 && badPrimary.length === keywords.length) {
    return { nearMiss: 'invalid-regex', nearMissKeywords: badPrimary };
  }

  const late = dropped.length > 0 ? matchHits(entry, dropped) : [];
  if (late.length > 0) {
    return { nearMiss: 'beyond-scan-depth', nearMissKeywords: [late[0].keyword], scanDepth: entry.scanDepth };
  }

  if (entry.matchWholeWords && !entry.useRegex) {
    const loose = matchHits({ ...entry, matchWholeWords: false }, scanned);
    if (loose.length > 0) {
      return { nearMiss: 'whole-word-blocked', nearMissKeywords: [loose[0].keyword], nearMissSample: wordAround(scanned, loose[0]) };
    }
  }
  return { nearMiss: 'no-match', nearMissKeywords: [] };
}

/** The whole word a blocked substring sits inside — the thing the author has to see to believe the verdict. */
function wordAround(sources: ScanSource[], hit: MatchHit): string | undefined {
  const text = sources.find((s) => s.region === hit.region)?.text;
  if (!text) return undefined;
  let start = hit.start;
  let end = hit.end;
  while (start > 0 && /\w/.test(text[start - 1])) start--;
  while (end < text.length && /\w/.test(text[end])) end++;
  return text.slice(start, end);
}

/**
 * What `sceneText` (and any `history`, oldest→newest) makes fire. Presence reads the prose with speech
 * blanked out, exactly as a turn does; the dictionary scans the text as written, also as a turn does — so
 * the two lists disagree with each other here for the same reason they do in play.
 */
export function buildTriggerReport(
  world: TriggerWorld,
  sceneText: string,
  opts: { history?: string[] } = {},
): TriggerReport {
  const placeholders = world.placeholders ?? [];
  const entities = findEntityMatches(
    stripQuotedSpeech(sceneText),
    (world.entities ?? []).map((e) => resolveEntity(e, placeholders)),
  );

  const scene: ScanSource[] = sceneText ? [{ region: SCENE_REGION, text: sceneText }] : [];
  const history: ScanSource[] = (opts.history ?? [])
    .map((text, i) => ({ region: `history:${i}`, text }))
    .filter((s) => s.text);

  // The muted books are held back from the pass rather than filtered out of it: play never scans them, so
  // running them here would invent a verdict the harness would not have reached.
  const books = world.dictionaries ?? [];
  const live = books.filter((b) => b.enabled !== false);
  const report = explainActivation(live.flatMap((b) => b.entries ?? []), scene, { history });

  const entries: TriggerEntry[] = [];
  for (const book of books) {
    const bookEnabled = book.enabled !== false;
    for (const entry of book.entries ?? []) {
      const base = {
        entryId: entry.id,
        name: entryLabel(entry, placeholders),
        bookId: book.id,
        bookName: book.name,
        bookEnabled,
        keywords: parseKeywords(entry),
        constant: !!entry.constant,
        badPatterns: invalidRegexKeys(entry),
      };
      if (!bookEnabled) {
        entries.push({
          ...base,
          fired: false,
          reason: 'none',
          hits: [],
          rule: matchRuleOf(entry),
          nearMiss: 'book-disabled',
          nearMissKeywords: [],
        });
        continue;
      }
      const activation = report.byId.get(entry.id);
      if (!activation) continue; // unreachable: every live entry is in the report
      const scanned = [...scene, ...historyForEntry(entry, history)];
      const dropped = history.filter((s) => !scanned.includes(s));
      entries.push({
        ...base,
        fired: activation.activated,
        reason: activation.reason,
        hits: activation.hits,
        secondary: activation.secondary,
        rule: activation.rule,
        ...(activation.activated
          ? { nearMissKeywords: [] }
          : classify(entry, scanned, dropped, activation.secondary)),
      });
    }
  }

  return {
    entities,
    entries,
    segments: buildSegments(sceneText, entities, entries),
    checked: entries.length,
    fired: entries.filter((e) => e.fired).length,
    constant: entries.filter((e) => e.fired && e.reason === 'constant').length,
  };
}

/**
 * `text` cut at every span boundary, each run carrying the rows that claim it. Overlaps are kept rather
 * than resolved — an entity and an entry laying claim to the same words is a thing the author wants to see,
 * not a tie to break. Only scene-region hits are placed: a history or recursion hit indexes a string that
 * isn't on screen.
 */
function buildSegments(text: string, entities: EntityMatch[], entries: TriggerEntry[]): TriggerSegment[] {
  if (!text) return [];
  const claims: { start: number; end: number; mark: TriggerMark }[] = [];
  for (const entity of entities) {
    for (const span of entity.spans) {
      claims.push({ start: span.start, end: span.end, mark: { kind: 'entity', id: entity.entityId, label: entity.name } });
    }
  }
  for (const entry of entries) {
    for (const hit of entry.hits) {
      if (hit.region !== SCENE_REGION) continue;
      claims.push({ start: hit.start, end: hit.end, mark: { kind: 'entry', id: entry.entryId, label: entry.name, keyword: hit.keyword } });
    }
  }
  if (claims.length === 0) return [{ text, start: 0, marks: [] }];

  const cuts = [...new Set([0, text.length, ...claims.flatMap((c) => [c.start, c.end])])]
    .filter((c) => c >= 0 && c <= text.length)
    .sort((a, b) => a - b);
  const segments: TriggerSegment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [start, end] = [cuts[i], cuts[i + 1]];
    if (start === end) continue;
    segments.push({
      text: text.slice(start, end),
      start,
      marks: claims.filter((c) => c.start <= start && c.end >= end).map((c) => c.mark),
    });
  }
  return segments;
}

const quote = (text: string) => `“${text}”`;

/** "a, b and c" — how a reason names the handful of keywords it is about. */
const listKeywords = (keywords: string[]): string => {
  const quoted = keywords.map(quote);
  return quoted.length <= 1 ? (quoted[0] ?? '') : `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
};

/**
 * The near-miss as a sentence the author can act on. These strings are the feature — an entry that didn't
 * fire is only useful if the row says which of its own rules stopped it.
 */
export function describeNearMiss(entry: TriggerEntry): string {
  const keys = listKeywords(entry.nearMissKeywords);
  switch (entry.nearMiss) {
    case 'book-disabled':
      return `The ${quote(entry.bookName)} book is off, so none of its entries are scanned.`;
    case 'entry-disabled':
      return 'This entry is off.';
    case 'no-keywords':
      return 'No keywords and not constant, so this entry can never fire.';
    case 'invalid-regex':
      return `${keys} is not valid regex — a pattern that cannot compile never matches.`;
    case 'secondary-excluded':
      return `${keys} is present, and this entry fires only when it is absent.`;
    case 'secondary-absent':
      return entry.secondary?.requireAll
        ? `A keyword matched, but every secondary must appear too — ${keys} missing.`
        : `A keyword matched, but none of its secondary keywords did — needs ${keys}.`;
    case 'beyond-scan-depth': {
      const depth = entry.scanDepth ?? 0;
      return `${keys} matched further back than its scan depth of ${depth} ${depth === 1 ? 'message' : 'messages'}.`;
    }
    case 'whole-word-blocked':
      return entry.nearMissSample
        ? `${keys} appears only inside ${quote(entry.nearMissSample)}, and whole-word matching is on.`
        : `${keys} appears only inside a longer word, and whole-word matching is on.`;
    case 'no-match':
      return 'No keyword found in the text.';
    default:
      return '';
  }
}

/** The scanned region a hit came from, as the evidence line names it. */
export function describeRegion(region: string): string {
  if (region === SCENE_REGION) return 'Scene';
  if (region.startsWith('history:')) return 'History';
  if (region.startsWith('recursion:')) return 'Another entry';
  return region;
}

/** Why a firing happened, as its badge reads. */
export const REASON_LABEL: Record<ActivationReason, string> = {
  constant: 'Always On',
  keyword: 'Keyword',
  recursive: 'Recursive',
  semantic: 'Semantic',
  none: '',
};
