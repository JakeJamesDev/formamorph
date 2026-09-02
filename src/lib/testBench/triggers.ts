/**
 * The Triggers instrument's view-model: prose in, a full account of what the harness makes of it out.
 *
 * Everything here is a reading of the game's own passes — `explainActivation` for the dictionary,
 * `findEntityMatches` for presence — never a second implementation of either. What this module adds is the
 * part play has no reason to compute: why an entry that *didn't* fire didn't, phrased as something an
 * author can act on.
 */
import { allPlaceholders } from '@/lib/placeholderHomes';
import {
  buildDictionaryContext, explainActivation, historyForEntry, invalidRegexKeys, matchHits, matchRuleOf,
  parseKeywords,
  type ActivationReason, type MatchHit, type MatchRule, type ScanSource, type SecondaryStatus,
} from '@/lib/dictionaryUtils';
import { findEntityMatches, stripQuotedSpeech, type EntityMatch } from '@/lib/entityMatch';
import { estimateTokens } from '@/lib/memoryUtils';
import { applySemanticLore } from '@/lib/semanticDictionary';
import type { DictionaryEntry, Entity } from '@/types';
import { resolveLensText } from './lens';
import type { RuleWorld } from './rules';
import { traceSemantic, type EntrySemantic, type SemanticInput } from './semantic';

/** The slices of the authored world the tracer reads. */
export type TriggerWorld = Pick<RuleWorld, 'entities' | 'entityGroups' | 'dictionaries' | 'placeholders'>;

/** The lens PC's placeholder pins — placeholder id → the value that character forces. */
type Pins = Record<string, string>;

/** Nothing pinned, shared so a lens-less run keeps report identity across calls. */
const NO_PINS: Pins = {};

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
  /** Absent when the entry fired, except on a semantic firing — there the keyword verdict is still the
   *  answer to "so why didn't my matching rules catch this?". */
  nearMiss?: NearMiss;
  /** Keywords whose regex does not compile — reported on the entry whether or not it fired, so a broken
   *  pattern is a flag on the row rather than a failed run. */
  badPatterns: string[];
  /** The keywords the near-miss is about, where the class names any. */
  nearMissKeywords: string[];
  /** The literal text behind the near-miss, where one exists (the word a blocked substring sits inside). */
  nearMissSample?: string;
  /** The entry's own history window, unset when it reads all of it — what a history hit's distance is
   *  judged against, whether the hit landed inside it or fell out. */
  scanDepth?: number;
  /** How many messages back the dropped hit sat — present only on `beyond-scan-depth`. */
  nearMissDistance?: number;
  /** What the semantic pass made of this entry. Absent unless that pass ran, and absent on the entries it
   *  never scores — so nothing on a keyword-only run can be read as a semantic result. */
  semantic?: EntrySemantic;
}

/** One lore block as the harness would inject it — the string a `<DICTIONARY>` chip is replaced with. */
export interface RenderedBlock {
  /** Which of the prompt's two lorebook blocks it is: `before` renders early, `after` late. */
  position: 'before' | 'after';
  /** The block body, built by the game's own renderer, so it is what the model would receive. */
  text: string;
  /** How many fired entries contributed text (an entry with an empty value renders nothing). */
  entryCount: number;
  /** Approximate token cost — chars-based, since a world runs against arbitrary endpoints. */
  tokens: number;
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
  /** The lore blocks this run would inject, in prompt order; empty when nothing fired with a value. */
  rendered: RenderedBlock[];
  /** The whole injection's approximate token cost. */
  renderedTokens: number;
  /** How many history messages were offered — what a hit's distance is measured back from. */
  historyCount: number;
  /** How many entries got a verdict — what makes "nothing fired" read as a result. */
  checked: number;
  fired: number;
  /** How many of the fired entries fired because they are constant. */
  constant: number;
  /** The semantic run behind the rows, present only when one happened — its absence is what makes a
   *  keyword-only report unable to show a score anywhere. */
  semantic?: SemanticSummary;
}

/** What one semantic run covered, for the line above the results. */
export interface SemanticSummary {
  threshold: number;
  cap: number;
  /** How many scannable entries had a vector — the rest cannot fire on meaning, exactly as in play. */
  indexed: number;
  eligible: number;
}

/** The region label the scene text is scanned under — the coordinate space the highlights live in. */
const SCENE_REGION = 'scene';

/** The region prefix a history message is scanned under; the suffix is its index, oldest first. */
const HISTORY_REGION_PREFIX = 'history:';

/** What separates one pasted message from the next. A blank line cannot do it: narration is several
 *  paragraphs, so blank lines would cut one turn into several and every distance measured from them would
 *  be wrong. A rule line is something prose does not write by accident. */
export const HISTORY_SEPARATOR = '---';

/** The messages in the history box, oldest first — the order `opts.history` is scanned in. */
export function splitHistory(text: string): string[] {
  return text.split(/^[ \t]*-{3,}[ \t]*$/m).map((message) => message.trim()).filter(Boolean);
}

/** `messages` as the history box holds them, ready to paste back in. */
export function joinHistory(messages: string[]): string {
  return messages.join(`\n\n${HISTORY_SEPARATOR}\n\n`);
}

/** An entry as the dictionary list labels it. */
const entryLabel = (entry: DictionaryEntry, placeholders: TriggerWorld['placeholders'], pins: Pins): string =>
  resolveLensText(entry.name, placeholders, pins) || parseKeywords(entry)[0] || 'Untitled entry';

/** An entity with its authored chips resolved, so matching runs against the words that will be on the page.
 *  An unpinned multi-value Wildcard resolves to a summary rather than a value and so matches nothing — which
 *  is the truth about a name that is only decided at play time. */
const resolveEntity = (entity: Entity, placeholders: TriggerWorld['placeholders'], pins: Pins): Entity => ({
  ...entity,
  name: resolveLensText(entity.name, placeholders, pins),
  aliases: entity.aliases?.map((a) => resolveLensText(a, placeholders, pins)),
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
  historyCount: number,
): Pick<TriggerEntry, 'nearMiss' | 'nearMissKeywords' | 'nearMissSample' | 'nearMissDistance'> {
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
    return {
      nearMiss: 'beyond-scan-depth',
      nearMissKeywords: [late[0].keyword],
      nearMissDistance: historyDistance(late[0].region, historyCount),
    };
  }

  if (entry.matchWholeWords && !entry.useRegex) {
    const loose = matchHits({ ...entry, matchWholeWords: false }, scanned);
    if (loose.length > 0) {
      return { nearMiss: 'whole-word-blocked', nearMissKeywords: [loose[0].keyword], nearMissSample: wordAround(scanned, loose[0]) };
    }
  }
  return { nearMiss: 'no-match', nearMissKeywords: [] };
}

const isHistoryRegion = (region: string) => region.startsWith(HISTORY_REGION_PREFIX);

/**
 * The further messages an entry's hits came out of, one per message — never the one the row's first hit has
 * already named, since a second keyword in a message already placed says nothing new about where it was.
 */
export function otherHistoryHits(entry: TriggerEntry): MatchHit[] {
  const first = entry.hits[0];
  const byMessage = new Map<string, MatchHit>();
  for (const hit of entry.hits) {
    if (!isHistoryRegion(hit.region) || hit.region === first?.region || byMessage.has(hit.region)) continue;
    byMessage.set(hit.region, hit);
  }
  return [...byMessage.values()];
}

/** How many messages back a history region sits, counting the newest as 1 — the distance an author thinks
 *  in. Zero for anything that isn't a history region, or when there is no history to measure against. */
function historyDistance(region: string, historyCount: number): number {
  if (!isHistoryRegion(region) || historyCount <= 0) return 0;
  const index = Number(region.slice(HISTORY_REGION_PREFIX.length));
  return Number.isInteger(index) ? Math.max(0, historyCount - index) : 0;
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

/** The entries a run scans: those of the books that are on. A muted book's entries still earn a row — they
 *  are held back from the pass rather than dropped, so the row can say the book is why. */
export const scannedEntries = (world: TriggerWorld): DictionaryEntry[] =>
  (world.dictionaries ?? []).filter((b) => b.enabled !== false).flatMap((b) => b.entries ?? []);

/**
 * What `sceneText` (and any `history`, oldest→newest) makes fire. Presence reads the prose with speech
 * blanked out, exactly as a turn does; the dictionary scans the text as written, also as a turn does — so
 * the two lists disagree with each other here for the same reason they do in play.
 *
 * `opts.semantic` adds the meaning-based pass over the top, folded in by the game's own `applySemanticLore`
 * so a keyword firing keeps its stronger reason. Without it nothing semantic exists in the result at all.
 *
 * `opts.pins` is the lens PC's: every chip that character fixes reads as their value, so an entity whose
 * name is pinned matches the prose here exactly as it would in that playthrough.
 */
export function buildTriggerReport(
  world: TriggerWorld,
  sceneText: string,
  opts: { history?: string[]; semantic?: SemanticInput; pins?: Pins } = {},
): TriggerReport {
  const placeholders = allPlaceholders(world);
  const pins = opts.pins ?? NO_PINS;
  const historyCount = (opts.history ?? []).length;
  const entities = findEntityMatches(
    stripQuotedSpeech(sceneText),
    (world.entities ?? []).map((e) => resolveEntity(e, placeholders, pins)),
  );

  const scene: ScanSource[] = sceneText ? [{ region: SCENE_REGION, text: sceneText }] : [];
  const history: ScanSource[] = (opts.history ?? [])
    .map((text, i) => ({ region: `history:${i}`, text }))
    .filter((s) => s.text);

  // The muted books are held back from the pass rather than filtered out of it: play never scans them, so
  // running them here would invent a verdict the harness would not have reached.
  const books = world.dictionaries ?? [];
  const live = scannedEntries(world);
  const report = explainActivation(live, scene, { history });
  // Semantic runs over the keyword report, as the narration prompt applies it: an entry the keywords already
  // took keeps its reason, so a score can never be mistaken for what put it in. It reads the unpinned text
  // because that is what the stored vectors were built from — pinning here would look every entry up under a
  // key the index does not have.
  const semantic = opts.semantic ? traceSemantic(live, placeholders, opts.semantic) : undefined;
  if (semantic) applySemanticLore(report, semantic.activations);

  const entries: TriggerEntry[] = [];
  const activated: DictionaryEntry[] = []; // book order, which is the order the injected block renders in
  for (const book of books) {
    const bookEnabled = book.enabled !== false;
    for (const entry of book.entries ?? []) {
      const base = {
        entryId: entry.id,
        name: entryLabel(entry, placeholders, pins),
        bookId: book.id,
        bookName: book.name,
        bookEnabled,
        keywords: parseKeywords(entry),
        constant: !!entry.constant,
        badPatterns: invalidRegexKeys(entry),
        scanDepth: entry.scanDepth,
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
      if (activation.activated) activated.push(entry);
      entries.push({
        ...base,
        fired: activation.activated,
        reason: activation.reason,
        hits: activation.hits,
        secondary: activation.secondary,
        rule: activation.rule,
        semantic: semantic?.states.get(entry.id),
        // A semantic firing is the one activation whose keyword verdict is still worth having: the author is
        // looking at a row that fired *without* their matching rules, and why those missed is the thing they
        // came here to fix. Every other firing is its own explanation.
        ...(activation.activated && activation.reason !== 'semantic'
          ? { nearMissKeywords: [] }
          : classify(entry, scanned, dropped, activation.secondary, historyCount)),
      });
    }
  }

  const rendered = renderBlocks(activated, placeholders, pins);
  return {
    entities,
    entries,
    segments: buildSegments(sceneText, entities, entries),
    rendered,
    renderedTokens: rendered.reduce((total, block) => total + block.tokens, 0),
    historyCount,
    checked: entries.length,
    fired: entries.filter((e) => e.fired).length,
    constant: entries.filter((e) => e.fired && e.reason === 'constant').length,
    ...(semantic && {
      semantic: {
        threshold: semantic.threshold,
        cap: semantic.cap,
        indexed: semantic.indexed,
        eligible: semantic.eligible,
      },
    }),
  };
}

/**
 * The fired entries as the harness would inject them: split into the prompt's two lorebook blocks by each
 * entry's `position`, then rendered by the game's own `buildDictionaryContext` — headings excluded, since a
 * block is what a `<DICTIONARY>` chip is replaced with and the prompt owns the heading around it.
 *
 * Chips resolve through the lens: what the PC pins reads as their value, and everything else as the editor
 * describes it rather than as a playthrough rolled it — an author has no rolls, and a Wildcard's summary is
 * the honest answer about text decided at play time.
 */
function renderBlocks(
  activated: DictionaryEntry[],
  placeholders: TriggerWorld['placeholders'],
  pins: Pins,
): RenderedBlock[] {
  const positions: Array<RenderedBlock['position']> = ['before', 'after'];
  return positions.flatMap((position) => {
    const inBlock = activated.filter((entry) =>
      (position === 'before') === (entry.position === 'before'));
    const text = resolveLensText(buildDictionaryContext(inBlock, false), placeholders, pins);
    if (!text) return [];
    return [{
      position,
      text,
      entryCount: inBlock.filter((entry) => entry.value).length,
      tokens: estimateTokens(text.length),
    }];
  });
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

/** "1 message" / "3 messages" — the unit every history distance and scan depth is stated in. */
export const messageCount = (count: number): string => `${count} ${count === 1 ? 'message' : 'messages'}`;

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
      const back = entry.nearMissDistance ? `${messageCount(entry.nearMissDistance)} back, ` : '';
      return `${keys} matched ${back}further back than its scan depth of ${messageCount(depth)}.`;
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

/**
 * The scanned region a hit came from, as the evidence line names it. A history hit is placed by distance —
 * `historyCount` is how many messages were offered, so the newest reads as one back.
 */
export function describeRegion(region: string, historyCount = 0): string {
  if (region === SCENE_REGION) return 'Scene';
  if (isHistoryRegion(region)) {
    const back = historyDistance(region, historyCount);
    return back > 0 ? `History, ${messageCount(back)} back` : 'History';
  }
  if (region.startsWith('recursion:')) return 'Another entry';
  return region;
}

/**
 * Where a hit was found and, for a history hit, the depth window that let it count. The verdict is the
 * other half of the distance: two messages back means nothing until you know what the entry reads.
 */
export function describeHitOrigin(entry: TriggerEntry, hit: MatchHit, historyCount: number): string {
  const where = describeRegion(hit.region, historyCount);
  if (!isHistoryRegion(hit.region)) return where;
  const depth = entry.scanDepth;
  return depth == null
    ? `${where} · no scan depth, so all history is read`
    : `${where} · inside its scan depth of ${messageCount(depth)}`;
}

/** Why a firing happened, as its badge reads. */
export const REASON_LABEL: Record<ActivationReason, string> = {
  constant: 'Always On',
  keyword: 'Keyword',
  recursive: 'Recursive',
  semantic: 'Semantic',
  none: '',
};
