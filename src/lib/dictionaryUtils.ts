import type { Dictionary, DictionaryEntry } from '@/types';
import { escapeRegExp } from './utils';

const MAX_RECURSION_PASSES = 3;

/**
 * Flatten enabled books into a single entry list — book order, then per-book entry order — dropping the
 * entries of any book with `enabled === false`. The one bridge from the book model to the entry-based
 * injection pipeline, so block order follows book order. Per-entry `enabled` is left untouched here;
 * `getActivatedDictionary` still applies it.
 */
export function flattenEnabledBookEntries(dictionaries: Dictionary[] | undefined): DictionaryEntry[] {
  if (!dictionaries) return [];
  return dictionaries.flatMap((book) => (book.enabled === false ? [] : book.entries ?? []));
}

/** An entry's primary trigger keywords (empties dropped). */
export function parseKeywords(entry: DictionaryEntry): string[] {
  return (entry.key ?? []).filter(Boolean);
}

/**
 * The compiled matcher for one keyword under an entry's flags, or null for an unusable key (empty, or a
 * malformed `useRegex` pattern — those never match rather than throwing). `global` yields a span-scanning
 * regex; the default is a stateless boolean-test regex. Substring mode is an escaped literal with the `i`
 * flag, byte-for-byte equivalent to the old `.includes` path but able to report offsets.
 */
function keyMatcher(key: string, entry: DictionaryEntry, global = false): RegExp | null {
  if (!key) return null;
  const flags = (entry.caseSensitive ? '' : 'i') + (global ? 'g' : '');
  if (entry.useRegex) {
    try { return new RegExp(key, flags); }
    catch { return null; }
  }
  const body = entry.matchWholeWords ? `\\b${escapeRegExp(key)}\\b` : escapeRegExp(key);
  return new RegExp(body, flags);
}

/** Whether one keyword occurs in `haystack`, honoring `useRegex` / `matchWholeWords` / `caseSensitive`. */
function keyMatches(key: string, haystack: string, entry: DictionaryEntry): boolean {
  if (!key || !haystack) return false;
  const re = keyMatcher(key, entry);
  return re ? re.test(haystack) : false;
}

/** Whether any of `keys` occurs in `haystack`. */
function anyKeyMatches(keys: string[], haystack: string, entry: DictionaryEntry): boolean {
  return keys.some((k) => keyMatches(k, haystack, entry));
}

/** Every occurrence of one keyword in `text`, with offsets, under the entry's flags. */
function keySpans(key: string, text: string, entry: DictionaryEntry): { start: number; end: number; text: string }[] {
  const re = keyMatcher(key, entry, true);
  if (!re || !text) return [];
  const out: { start: number; end: number; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-length matches
  }
  return out;
}

/** One located occurrence of a primary keyword. */
export interface MatchSpan {
  start: number;
  end: number;
  /** The exact substring matched (may differ from `keyword` for regex/case). */
  text: string;
  keyword: string;
}

/** Every occurrence of any of an entry's primary keywords in `text`, honoring its match flags. */
export function matchSpans(entry: DictionaryEntry, text: string): MatchSpan[] {
  const out: MatchSpan[] = [];
  for (const kw of parseKeywords(entry)) {
    for (const s of keySpans(kw, text, entry)) out.push({ ...s, keyword: kw });
  }
  return out;
}

/** The secondary gate's raw evaluation: whether the any/all condition held (before `exclude` inverts it). */
function secondaryHolds(entry: DictionaryEntry, secondary: string[], haystack: string): boolean {
  return entry.secondaryAll
    ? secondary.every((k) => keyMatches(k, haystack, entry))
    : secondary.some((k) => keyMatches(k, haystack, entry));
}

/** Options for `getActivatedDictionary`. */
export interface ActivationOptions {
  /** Recent message contents oldest→newest; scanned per entry up to its `scanDepth` (all of it when unset). */
  history?: string[];
}

/** A named region of scanned text — the unit of match attribution in the AI-context viewer. `region` is a
 *  caller-chosen label (e.g. `location`, `history:2`); `recursion:<entryId>` labels are minted internally for
 *  hits found in an active entry's value during the recursive pass. */
export interface ScanSource {
  region: string;
  text: string;
}

/** One primary-keyword occurrence that drove (or, for a `constant` entry, merely accompanied) activation. */
export interface MatchHit {
  keyword: string;
  /** The exact substring matched (may differ from `keyword` for regex/case). */
  matchedText: string;
  /** The `ScanSource.region` it was found in. */
  region: string;
  /** Offset within that source's `text`. */
  start: number;
  end: number;
}

/** The secondary gate's evaluation for an entry that has `secondaryKeys`. */
export interface SecondaryStatus {
  keywords: string[];
  /** `secondaryAll` — every secondary must appear, vs. any one. */
  requireAll: boolean;
  /** `secondaryExclude` — the entry fires only when the condition does NOT hold. */
  exclude: boolean;
  /** Whether the any/all condition held, before `exclude` inverts it. */
  present: boolean;
}

/** How an entry's match flags were interpreted (for the viewer's "why it fired" popover). */
export interface MatchRule {
  regex: boolean;
  wholeWord: boolean;
  caseSensitive: boolean;
}

/** Why an entry did or didn't activate. `keyword` = a scanned-text hit; `recursive` = fired against another
 *  active entry's value; `constant` = always-on; `semantic` = meaning-similar to the player action (applied
 *  after the keyword pass by lib/semanticDictionary — never overrides a keyword reason); `none` = not
 *  activated (disabled, or no qualifying hit). */
export type ActivationReason = 'constant' | 'keyword' | 'recursive' | 'semantic' | 'none';

/** One entry's activation outcome with the evidence behind it. */
export interface EntryActivation {
  entryId: string;
  activated: boolean;
  reason: ActivationReason;
  /** Primary-keyword occurrences in scanned regions (empty when not activated by keywords). */
  hits: MatchHit[];
  /** Present only when the entry has `secondaryKeys`. */
  secondary?: SecondaryStatus;
  rule: MatchRule;
  /** Cosine similarity to the player action; present only when `reason` is 'semantic'. */
  semanticSimilarity?: number;
}

/** Full per-entry activation report — the single source of truth `getActivatedDictionary` also runs on. */
export interface ActivationReport {
  /** One record per passed entry, in declaration order (includes disabled/non-activated entries). */
  entries: EntryActivation[];
  byId: Map<string, EntryActivation>;
}

function ruleOf(entry: DictionaryEntry): MatchRule {
  return {
    regex: !!entry.useRegex,
    wholeWord: !entry.useRegex && !!entry.matchWholeWords,
    caseSensitive: !!entry.caseSensitive,
  };
}

/** All primary-keyword hits of `entry` across `sources`, tagged with each source's region. */
export function matchHits(entry: DictionaryEntry, sources: ScanSource[]): MatchHit[] {
  const hits: MatchHit[] = [];
  for (const kw of parseKeywords(entry)) {
    for (const src of sources) {
      for (const span of keySpans(kw, src.text, entry)) {
        hits.push({ keyword: kw, matchedText: span.text, region: src.region, start: span.start, end: span.end });
      }
    }
  }
  return hits;
}

function secondaryStatus(entry: DictionaryEntry, haystack: string): SecondaryStatus | undefined {
  const secondary = (entry.secondaryKeys ?? []).filter(Boolean);
  if (secondary.length === 0) return undefined;
  return {
    keywords: secondary,
    requireAll: !!entry.secondaryAll,
    exclude: !!entry.secondaryExclude,
    present: secondaryHolds(entry, secondary, haystack),
  };
}

/** Whether an entry fires given its primary hit and (optional) secondary status — the `triggered` logic,
 *  reusing an already-computed `SecondaryStatus` so the boolean path and the report never diverge. */
function firesWith(primaryHit: boolean, secondary: SecondaryStatus | undefined): boolean {
  if (!primaryHit) return false;
  if (!secondary) return true;
  return secondary.exclude ? !secondary.present : secondary.present;
}

/**
 * The full activation report for a turn — every entry's outcome plus the located keyword hits behind it.
 * This is the engine `getActivatedDictionary` wraps, so the viewer's highlights can never disagree with what
 * actually injected. `scene` sources are always scanned; `opts.history` sources are scanned per entry up to
 * its `scanDepth`. Recursive entries then scan the active entries' values (regions `recursion:<entryId>`).
 */
export function explainActivation(
  entries: DictionaryEntry[],
  scene: ScanSource[],
  opts: { history?: ScanSource[] } = {},
): ActivationReport {
  const records: EntryActivation[] = [];
  const byId = new Map<string, EntryActivation>();
  const add = (a: EntryActivation) => { records.push(a); byId.set(a.entryId, a); };
  if (!entries || entries.length === 0) return { entries: records, byId };

  const sceneSources = scene.filter((s) => s.text);
  const historySources = (opts.history ?? []).filter((s) => s.text);

  const activeEntries: DictionaryEntry[] = []; // insertion order feeds the recursive value scan
  const pending: DictionaryEntry[] = [];

  for (const entry of entries) {
    const rule = ruleOf(entry);
    if (entry.enabled === false) {
      add({ entryId: entry.id, activated: false, reason: 'none', hits: [], rule });
      continue;
    }
    if (entry.constant) {
      const rec: EntryActivation = { entryId: entry.id, activated: true, reason: 'constant', hits: matchHits(entry, sceneSources), rule };
      const sec = secondaryStatus(entry, sceneSources.map((s) => s.text).join('\n'));
      if (sec) rec.secondary = sec;
      add(rec); activeEntries.push(entry);
      continue;
    }
    const depth = entry.scanDepth;
    const hist = depth == null ? historySources : depth <= 0 ? [] : historySources.slice(-depth);
    const sources = [...sceneSources, ...hist];
    const hay = sources.map((s) => s.text).join('\n');
    const sec = secondaryStatus(entry, hay);
    const fires = firesWith(anyKeyMatches(parseKeywords(entry), hay, entry), sec);
    const rec: EntryActivation = {
      entryId: entry.id,
      activated: fires,
      reason: fires ? 'keyword' : 'none',
      hits: fires ? matchHits(entry, sources) : [],
      rule,
    };
    if (sec) rec.secondary = sec;
    add(rec);
    if (fires) activeEntries.push(entry);
    else pending.push(entry);
  }

  // Recursive pass: `recursive` entries can fire against the values already activated, capped to avoid loops.
  const recursive = pending.filter((e) => e.recursive);
  if (recursive.length && activeEntries.length) {
    for (let pass = 0; pass < MAX_RECURSION_PASSES; pass++) {
      const valueSources: ScanSource[] = activeEntries
        .filter((e) => e.value)
        .map((e) => ({ region: `recursion:${e.id}`, text: e.value }));
      const activeText = valueSources.map((s) => s.text).join('\n');
      let added = false;
      for (const entry of recursive) {
        const rec = byId.get(entry.id)!;
        if (rec.activated) continue;
        const sec = secondaryStatus(entry, activeText);
        if (!firesWith(anyKeyMatches(parseKeywords(entry), activeText, entry), sec)) continue;
        rec.activated = true;
        rec.reason = 'recursive';
        rec.hits = matchHits(entry, valueSources);
        if (sec) rec.secondary = sec;
        activeEntries.push(entry);
        added = true;
      }
      if (!added) break;
    }
  }

  return { entries: records, byId };
}

/**
 * The dictionary/lorebook entries active this turn. An enabled entry activates when it is `constant` or its
 * keywords fire against the scanned text — the current scene (`sceneTexts`, always scanned) plus the last
 * `scanDepth` messages of `opts.history` (all of it when `scanDepth` is unset; none when it is 0). Entries
 * flagged `recursive` may then be activated by the already-active entries' content, bounded to a few passes.
 * Returns the active entries in declaration order; ordering within a rendered block is `buildDictionaryContext`'s job.
 *
 * A thin wrapper over `explainActivation` — the boolean membership here and the viewer's match report come
 * from one computation, so they cannot drift apart.
 */
export function getActivatedDictionary(
  dictionary: DictionaryEntry[],
  sceneTexts: string[],
  opts: ActivationOptions = {},
): DictionaryEntry[] {
  if (!dictionary || dictionary.length === 0) return [];
  const scene = sceneTexts.map((text, i) => ({ region: `scene:${i}`, text }));
  const history = (opts.history ?? []).map((text, i) => ({ region: `history:${i}`, text }));
  const report = explainActivation(dictionary, scene, { history });
  return dictionary.filter((e) => e.enabled !== false && report.byId.get(e.id)?.activated);
}

/** A run of displayed text — plain, or (with `chip`) a real activation match to render as a clickable chip. */
export interface MatchSegment {
  text: string;
  chip?: { entryId: string; hit: MatchHit; activation: EntryActivation };
}

/**
 * Split `text` into plain and match segments for the AI-context viewer. Each `report` hit is placed by
 * locating its captured `sources` string within `text` (first occurrence) and offsetting the hit into it —
 * so a segment marks the *actual* scanned span, never a coincidental keyword echo elsewhere. Entries for
 * which `skip(entryId)` is true are omitted; overlapping hits resolve longest-first. `text` with no locatable
 * hit returns a single plain segment (empty `text` → `[]`).
 */
export function locateMatches(
  text: string,
  report: EntryActivation[],
  sources: ScanSource[],
  skip: (entryId: string) => boolean = () => false,
): MatchSegment[] {
  if (!text) return [];
  interface Mark { start: number; end: number; chip: NonNullable<MatchSegment['chip']>; }
  const marks: Mark[] = [];
  for (const src of sources) {
    if (!src.text) continue;
    const base = text.indexOf(src.text); // first occurrence; scanned strings are distinct enough
    if (base < 0) continue;
    for (const act of report) {
      if (skip(act.entryId)) continue;
      for (const hit of act.hits) {
        if (hit.region !== src.region) continue;
        marks.push({ start: base + hit.start, end: base + hit.end, chip: { entryId: act.entryId, hit, activation: act } });
      }
    }
  }
  if (marks.length === 0) return [{ text }];
  // Longest-first, greedily drop overlaps (so "fire dragon" wins over "dragon"), then order by position.
  marks.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const chosen: Mark[] = [];
  for (const m of marks) {
    if (chosen.some((c) => m.start < c.end && c.start < m.end)) continue;
    chosen.push(m);
  }
  chosen.sort((a, b) => a.start - b.start);
  const segs: MatchSegment[] = [];
  let last = 0;
  for (const m of chosen) {
    if (m.start > last) segs.push({ text: text.slice(last, m.start) });
    segs.push({ text: text.slice(m.start, m.end), chip: m.chip });
    last = m.end;
  }
  if (last < text.length) segs.push({ text: text.slice(last) });
  return segs;
}

/**
 * Text block for the given entries (empty if none), rendered in the order given — the `dictionary` array order
 * within each position block. With `includeHeading` (the default) it carries its own `## Foreground Lore`
 * heading, used only for the no-chip fallback append; `false` returns the body so the prompt template owns it.
 */
export function buildDictionaryContext(entries: DictionaryEntry[], includeHeading = true): string {
  if (!entries || entries.length === 0) return '';
  const lines = entries
    .filter((e) => e.value)
    .map((e) => {
      const label = e.name || e.key?.[0] || '';
      return label ? `${label}: ${e.value}` : e.value;
    });
  if (lines.length === 0) return '';
  const body = lines.join('\n');
  return includeHeading ? `## Foreground Lore\n${body}` : body;
}
