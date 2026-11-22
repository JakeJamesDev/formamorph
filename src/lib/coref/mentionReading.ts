/**
 * Mention Reading: names the Coref Host's clusters with cast entities, through the name parser's hits and
 * head words, and attributes each quote to a speaker.
 */
import type { Entity } from '@/types';
import { distinctiveWords, findEntityMatches, isEverydayName, stripQuotedSpeech } from '@/lib/entityMatch';
import type { CorefCluster } from './corefHost';

/** A span in the passage the reading resolved: a cluster mention or a name parser hit. `entityId` is null
 *  when the span refers to someone outside the cast (or nobody the rules could name). */
export interface MentionLink {
  start: number;
  end: number;
  entityId: string | null;
}

/** Raised whenever the speaker or naming rules change; a contribution carries it so replays know which rules ran. */
export const readingVersion = 2;

/** A fallback that names a speaker the five rules left none for, from the quote itself or its paragraph. */
export type QuoteFallback = 'own-first-person' | 'earlier-quote' | 'pronoun-subject' | 'named-subject';

/** The rule that named a quote's speaker; `none` when no rule did. */
export type QuoteRule = 'after-subject-verb' | 'after-verb-subject' | 'before-verb' | 'beat' | 'nearest-subject' | QuoteFallback | 'none';

/** A span in the passage's text. */
export interface ReadingSpan {
  start: number;
  end: number;
}

/** One quoted run of speech and who said it; `speaker` is null when no cast entity is the speaker. The record
 *  fields come from a fresh reading; a corrected or restored quote has none. */
export interface QuoteSpeaker {
  start: number;
  end: number;
  speaker: string | null;
  /** The rule that found `mention`, or the fallback that picked `speaker` when no rule found one. */
  rule?: QuoteRule;
  /** The mention the rule used; null when none sat at its subject span. */
  mention?: ReadingSpan | null;
  /** The fallback that picked `speaker`; null when a rule did, or nothing did. */
  fallback?: QuoteFallback | null;
  /** The quote's own I, me, my, mine and myself, whether or not a cluster holds them. */
  firstPerson?: ReadingSpan[];
}

export interface MentionReading {
  mentions: MentionLink[];
  quotes: QuoteSpeaker[];
}

/** What the reading needs from the scene beyond the cast. */
export interface MentionSceneContext {
  /** The played persona: its names, "you" and the narrator's "I" resolve to it (Q61). */
  player?: MentionPlayer;
}

/** The played persona as the reading sees it. */
export interface MentionPlayer {
  id: string;
  /** Its name, then its aliases. */
  names: readonly string[];
}

type CastEntity = Pick<Entity, 'id' | 'name' | 'aliases' | 'strangerName' | 'kind'>;

/** The cast a reading names clusters with. */
export type MentionCast = CastEntity[];

interface Hit {
  entityId: string;
  start: number;
  end: number;
  text: string;
}

const POSSESSIVE_RE = /['’]s$/;
const SELF_INTRO_RE = /(?:\bI['’]m|\bI am|[Mm]y name(?:['’]s| is)|[Cc]all me)\s+$/;
const LEADING_ARTICLE_RE = /^(?:a|an|the)\s+/i;

// The written forms a head word takes: itself and its regular plurals.
const forms = (word: string): Set<string> => {
  const w = word.toLowerCase();
  return new Set([w, `${w}s`, `${w}es`, w.replace(/f$/, 'ves'), w.replace(/y$/, 'ies')]);
};

const isUpper = (ch: string | undefined) => !!ch && ch !== ch.toLowerCase() && ch === ch.toUpperCase();

/** The words that may name a mention by its head: the name, its distinctive words, aliases, Stranger Name words. */
function headWords(e: CastEntity): string[] {
  const stranger = e.strangerName?.trim().replace(LEADING_ARTICLE_RE, '');
  return [e.name, ...distinctiveWords(e.name), ...(e.aliases ?? []), ...(stranger ? distinctiveWords(stranger) : [])];
}

/** Entities a mention's last word(s) name, one vote per head that exactly one cast member owns. */
function headVotes(text: string, start: number, end: number, cast: CastEntity[]): Map<string, number> {
  const mention = text.slice(start, end).replace(POSSESSIVE_RE, '').toLowerCase();
  const owners = new Map<string, Set<string>>();
  for (const e of cast) {
    const nameWords = new Set([e.name, ...e.name.split(/\s+/)]);
    for (const head of headWords(e)) {
      for (const form of forms(head)) {
        if (mention !== form && !mention.endsWith(` ${form}`) && !mention.endsWith(`-${form}`)) continue;
        // The parser's capital guard: a one-word name of a person needs its capital.
        const guarded = !form.includes(' ') && e.kind !== 'generic' && nameWords.has(head);
        if (guarded && !isUpper(text.slice(end - form.length, end)[0])) continue;
        const key = head.toLowerCase();
        if (!owners.has(key)) owners.set(key, new Set());
        owners.get(key)!.add(e.id);
      }
    }
  }
  const votes = new Map<string, number>();
  for (const ids of owners.values()) {
    if (ids.size !== 1) continue;
    const [id] = ids;
    votes.set(id, (votes.get(id) ?? 0) + 1);
  }
  return votes;
}

// Counter.most_common(1): the highest count, the first counted on a tie.
function topVote(votes: Map<string, number>): string | null {
  let best: string | null = null;
  let count = 0;
  for (const [id, n] of votes) if (n > count) [best, count] = [id, n];
  return best;
}

const add = (votes: Map<string, number>, id: string, n = 1) => votes.set(id, (votes.get(id) ?? 0) + n);

/** Every span the reading asserts, cluster mentions first, in the evaluation's order, and each cluster's entity. */
function nameMentions(text: string, clusters: CorefCluster[], cast: CastEntity[]): { links: MentionLink[]; clusterEntities: (string | null)[] } {
  // The matcher reads only the picked fields.
  const hits: Hit[] = findEntityMatches(text, cast as Entity[])
    .flatMap((m) => m.spans.map((s) => ({ entityId: m.entityId, start: s.start, end: s.end, text: s.text })));
  const links: MentionLink[] = [];
  const clusterEntities: (string | null)[] = [];
  const used = new Set<number>();
  for (const cluster of clusters) {
    const votes = new Map<string, number>();
    hits.forEach((h, i) => {
      for (const [s, f] of cluster) {
        if (s <= h.start && text.slice(s, f).replace(POSSESSIVE_RE, '').endsWith(h.text)) {
          add(votes, h.entityId);
          used.add(i);
          return;
        }
      }
      if (used.has(i) || !SELF_INTRO_RE.test(text.slice(Math.max(0, h.start - 20), h.start))) return;
      if (cluster.some(([s, f]) => text.slice(s, f) === 'I' && h.start - s > 0 && h.start - s < 20)) {
        add(votes, h.entityId);
        used.add(i);
      }
    });
    for (const [s, f] of cluster) for (const [id, n] of headVotes(text, s, f, cast)) add(votes, id, n);
    const entityId = topVote(votes);
    clusterEntities.push(entityId);
    for (const [s, f] of cluster) links.push({ start: s, end: f, entityId });
  }
  const everyday = new Map(cast.map((e) => [e.id, isEverydayName(e.name)]));
  hits.forEach((h, i) => {
    // A hit that named a cluster is spoken for; any other hit stands as the parser's own evidence.
    if (used.has(i) && clusters.some((c) => c.some(([s, f]) => s <= h.start && h.end <= f))) return;
    if (everyday.get(h.entityId) && !used.has(i)) return;
    links.push({ start: h.start, end: h.end, entityId: h.entityId });
  });
  return { links, clusterEntities };
}

/**
 * The entity the reading gives the span [start, end): the smallest asserted span containing it, else the
 * smallest overlapping one. Null when none, or when that span is unnamed.
 */
export function mentionEntityAt(reading: Pick<MentionReading, 'mentions'>, start: number, end: number): string | null {
  let best: { rank: [number, number]; id: string | null } | null = null;
  for (const m of reading.mentions) {
    let rank: [number, number];
    if (m.start <= start && end <= m.end) rank = [0, m.end - m.start];
    else if (m.start < end && start < m.end) rank = [1, m.end - m.start];
    else continue;
    if (!best || rank[0] < best.rank[0] || (rank[0] === best.rank[0] && rank[1] < best.rank[1])) best = { rank, id: m.entityId };
  }
  return best?.id ?? null;
}

/** Cast entities with a named mention in the prose, outside quoted speech (stripQuotedSpeech's rule). */
export function entitiesInProse(text: string, reading: Pick<MentionReading, 'mentions'>): string[] {
  const prose = stripQuotedSpeech(text);
  const ids = new Set<string>();
  for (const m of reading.mentions) {
    if (m.entityId && prose.slice(m.start, m.end) === text.slice(m.start, m.end)) ids.add(m.entityId);
  }
  return [...ids];
}

// --- Quote speakers ---------------------------------------------------------------------------------------

const QUOTE_RE = /["“][^"”]*(?:["”]|$)/g;
const SPEECH_VERBS = [
  'say', 'ask', 'reply', 'whisper', 'murmur', 'mutter', 'shout', 'call', 'add', 'answer', 'continue', 'snap',
  'laugh', 'growl', 'hiss', 'sigh', 'breathe', 'admit', 'insist', 'offer', 'tell', 'explain', 'begin', 'finish',
  'cry', 'yell', 'purr', 'tease', 'warn', 'agree', 'repeat', 'demand', 'declare', 'announce', 'muse', 'note',
  'observe', 'remark', 'respond', 'retort', 'scoff', 'snort', 'chuckle', 'giggle', 'grumble', 'groan', 'gasp',
  'plead', 'beg', 'promise', 'suggest', 'counter', 'interrupt', 'protest', 'call out', 'bark', 'drawl', 'coo',
  'croak', 'rasp', 'squeak', 'stammer', 'stutter', 'whimper', 'sob', 'moan', 'huff', 'grunt', 'hum', 'sing',
  'chirp', 'concede', 'confirm', 'correct', 'press', 'prompt', 'urge', 'order', 'command', 'instruct', 'mumble',
  'brag', 'boast', 'mew', 'meow', 'choke out', 'spit', 'scream',
];
const verbForms = (v: string): string[] => {
  const stem = v.replace(/e$/, '');
  const irregular: Record<string, string[]> = { say: ['said'], tell: ['told'], begin: ['began'], sing: ['sang'] };
  const third = /(?:s|sh|ch|x|z)$/.test(v) ? `${v}es` : /[^aeiou]y$/.test(v) ? `${v.slice(0, -1)}ies` : `${v}s`;
  const past = /[^aeiou]y$/.test(v) ? `${v.slice(0, -1)}ied` : v.endsWith('e') ? `${v}d` : /[^aeiou][aeiou][bdgmnprt]$/.test(v) && v.length <= 4 ? `${v}${v.slice(-1)}ed` : `${stem}ed`;
  return [v, third, past, ...(irregular[v] ?? [])];
};
const VERB = `(?:${[...new Set(SPEECH_VERBS.flatMap(verbForms))].sort((a, b) => b.length - a.length).join('|')})`;
// `"…," she says` / `"…" says Mira` with an optional adverb; and `Mira says, "…"` before the quote.
const AFTER_SUBJECT_VERB = new RegExp(String.raw`^[,.!?—–-]?\s*([^\s"“”.,!?]+(?:\s+[^\s"“”.,!?]+){0,3}?)\s+(?:\w+ly\s+)?${VERB}\b`, 'i');
const AFTER_VERB_SUBJECT = new RegExp(String.raw`^[,.!?—–-]?\s*${VERB}\s+`, 'i');
const BEFORE_VERB = new RegExp(String.raw`${VERB}(?:\s+\w+ly)?(?:\s+(?:to|at)\s+[^,:."“”]{1,40})?\s*[,:]?\s*$`, 'i');

const SECOND_PERSON = /^(?:you|your|yours|yourself|yourselves)$/;
const FIRST_PERSON = /^(?:i|me|my|mine|myself)$/;
const FIRST_PERSON_WORD = /\b(?:i|me|my|mine|myself)\b/gi;

/** The persona's name, its words minus any word a cast member's name also holds, and its aliases, lowercased. */
const playerWords = (scene: MentionSceneContext, cast: CastEntity[]): Set<string> => {
  const [name, ...aliases] = (scene.player?.names ?? []).map((n) => playerForm(n.trim()));
  if (!name) return new Set();
  const castWords = new Set(cast.flatMap((e) => e.name.toLowerCase().split(/\s+/)));
  return new Set([name, ...name.split(/\s+/).filter((w) => !castWords.has(w)), ...aliases.filter(Boolean)]);
};

/** A mention's text as the player test reads it: lowercased, past a possessive and a leading article. */
const playerForm = (text: string) => text.replace(POSSESSIVE_RE, '').toLowerCase().replace(LEADING_ARTICLE_RE, '');

/** What a fallback rule found: undefined `speaker` means the rule did not fire. */
interface RuleResult {
  speaker: string | null | undefined;
  mention?: MentionLink;
}

interface Paragraph {
  start: number;
  end: number;
}

/** What the fallbacks read about one quote the rules left without a speaker. */
interface FallbackInput {
  run: Paragraph;
  para: Paragraph;
  runs: Paragraph[];
  rule: QuoteRule;
  used: MentionLink | undefined;
  firstPerson: ReadingSpan[];
  /** The paragraph's quotes before this one, with their final speakers. */
  earlier: QuoteSpeaker[];
}

const UNNAMED_PRONOUN = /^(?:he|she|her)$/i;

/** The fallbacks in the order they are tried; the first that names a speaker wins. */
const FALLBACK_ORDER: readonly QuoteFallback[] = ['own-first-person', 'earlier-quote', 'pronoun-subject', 'named-subject'];

function paragraphs(text: string): Paragraph[] {
  const out: Paragraph[] = [];
  const re = /\n\s*\n/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    out.push({ start: at, end: m.index });
    at = m.index + m[0].length;
  }
  out.push({ start: at, end: text.length });
  return out;
}

/** Each quote run the reading attributes, with the end of the paragraph that holds it. */
export function quoteSpans(text: string): { start: number; end: number; paragraphEnd: number }[] {
  return paragraphs(text).flatMap((para) => [...text.slice(para.start, para.end).matchAll(QUOTE_RE)]
    .map((m) => ({ start: para.start + m.index, end: para.start + m.index + m[0].length, paragraphEnd: para.end })));
}

/**
 * The speaker of each quote: the mention at a speech verb attached to the quote, else (unless `verbOnly`) the
 * mention opening an action beat after it, else the nearest preceding subject mention in the paragraph. Unless
 * `verbOnly`, the fallbacks then name a speaker the rules left none for. `mixed` holds the spans, as `start:end`,
 * of clusters that merge player words with someone else's (Q67).
 */
function quoteSpeakers(
  text: string, mentions: MentionLink[], player: Set<string>, playerId: string | null,
  { verbOnly = false, mixed = new Set<string>() }: { verbOnly?: boolean; mixed?: ReadonlySet<string> } = {},
): QuoteSpeaker[] {
  const isPlayer = (m: MentionLink) => {
    const t = playerForm(text.slice(m.start, m.end));
    return SECOND_PERSON.test(t) || FIRST_PERSON.test(t) || player.has(t);
  };
  // The mention that best covers [start, end): exact first, then the one ending there.
  const mentionAt = (start: number, end: number): MentionLink | undefined => {
    const hits = mentions.filter((m) => m.start >= start && m.end <= end && m.end > m.start);
    if (!hits.length) return undefined;
    const named = hits.filter((m) => m.entityId);
    const pool = named.length ? named : hits;
    return pool.reduce((a, b) => (b.end > a.end || (b.end === a.end && b.end - b.start < a.end - a.start) ? b : a));
  };
  const speakerOf = (m: MentionLink | undefined): string | null | undefined =>
    (m === undefined ? undefined : isPlayer(m) ? playerId : m.entityId);
  // A player word at the verb ("you ask") names the player even where no cluster holds it.
  const playerSubject = (words: string) => {
    const last = words.trim().split(/\s+/).pop()?.toLowerCase() ?? '';
    return SECOND_PERSON.test(last) || FIRST_PERSON.test(last) || player.has(last);
  };

  const quotes: QuoteSpeaker[] = [];
  for (const para of paragraphs(text)) {
    const body = text.slice(para.start, para.end);
    const runs = [...body.matchAll(QUOTE_RE)].map((m) => ({ start: para.start + m.index, end: para.start + m.index + m[0].length }));
    runs.forEach((run, r) => {
      // After the quote, up to the next quote or the end of the sentence.
      const nextStart = runs[r + 1]?.start ?? para.end;
      const after = text.slice(run.end, nextStart);
      let speaker: string | null | undefined;
      let rule: QuoteRule = 'none';
      let used: MentionLink | undefined;
      const sv = AFTER_SUBJECT_VERB.exec(after);
      if (sv) {
        const subjStart = run.end + sv.index + sv[0].indexOf(sv[1]);
        used = mentionAt(subjStart, subjStart + sv[1].length);
        speaker = playerSubject(sv[1]) ? playerId : speakerOf(used);
        if (speaker !== undefined) rule = 'after-subject-verb';
      }
      if (speaker === undefined) {
        const vs = AFTER_VERB_SUBJECT.exec(after);
        if (vs) {
          const subjStart = run.end + vs[0].length;
          const word = /^[^\s.,!?"“”]+(?:\s+[^\s.,!?"“”]+){0,3}/.exec(after.slice(vs[0].length));
          if (word) {
            used = mentionAt(subjStart, subjStart + word[0].length);
            speaker = speakerOf(used);
            if (speaker !== undefined) rule = 'after-verb-subject';
          }
        }
      }
      if (speaker === undefined) {
        // Before the quote: `Mira says, "…"` within the same sentence.
        const prevEnd = runs[r - 1]?.end ?? para.start;
        const lead = text.slice(prevEnd, run.start);
        const sentence = lead.slice(Math.max(0, lead.search(/[^.!?]*$/)));
        const sentenceStart = run.start - sentence.length;
        const bv = BEFORE_VERB.exec(sentence);
        if (bv) {
          const verbAt = sentenceStart + bv.index;
          const wordBeforeVerb = /(\S+)\s+(?:\w+ly\s+)?$/.exec(text.slice(sentenceStart, verbAt));
          if (wordBeforeVerb && playerSubject(wordBeforeVerb[1])) speaker = playerId;
          const candidates = mentions.filter((m) => m.end <= verbAt && m.start >= sentenceStart
            && /^\s*(?:\w+ly\s+)?$/.test(text.slice(m.end, verbAt)));
          used = candidates.sort((a, b) => b.end - a.end)[0];
          if (speaker === undefined) speaker = speakerOf(used);
          if (speaker !== undefined) rule = 'before-verb';
        }
      }
      if (speaker === undefined && !verbOnly) {
        const beat = beatSpeaker(run.end, after);
        speaker = beat.speaker;
        if (speaker !== undefined) { rule = 'beat'; used = beat.mention; }
      }
      if (speaker === undefined && !verbOnly) {
        const subject = nearestSubject(para, run.start, runs);
        speaker = subject.speaker;
        if (speaker !== undefined) { rule = 'nearest-subject'; used = subject.mention; }
      }
      const firstPerson = firstPersonSpans(run);
      let fallback: QuoteFallback | null = null;
      if ((speaker ?? null) === null && !verbOnly) {
        for (const name of FALLBACK_ORDER) {
          const found = fallbackSpeaker(name, { run, para, runs, rule, used, firstPerson, earlier: quotes.filter((q) => q.start >= para.start) });
          if (!found) continue;
          [speaker, fallback] = [found.speaker, name];
          // The rule's mention is the evidence; a fallback's stands in only where no rule found one.
          if (rule === 'none' || !used) [rule, used] = [name, found.mention];
          break;
        }
      }
      quotes.push({
        start: run.start, end: run.end, speaker: speaker ?? null,
        rule, mention: rule === 'none' || !used ? null : { start: used.start, end: used.end },
        fallback, firstPerson,
      });
    });
  }
  return quotes;

  // A fallback's speaker for a quote the rules left with none; undefined when it does not fire.
  function fallbackSpeaker(name: QuoteFallback, q: FallbackInput): { speaker: string; mention?: MentionLink } | undefined {
    switch (name) {
      case 'own-first-person': {
        const own = q.firstPerson.flatMap((s) => mentions.filter((m) => m.start === s.start && m.end === s.end && m.entityId
          && !mixed.has(`${m.start}:${m.end}`)));
        const ids = new Set(own.map((m) => m.entityId));
        return ids.size === 1 ? { speaker: own[0].entityId!, mention: own[0] } : undefined;
      }
      case 'earlier-quote': {
        // A tag or beat on someone unnamed is evidence against the earlier speaker.
        if (q.used && q.rule !== 'nearest-subject') return undefined;
        const speaker = q.earlier.findLast((e) => e.speaker)?.speaker;
        return speaker ? { speaker } : undefined;
      }
      case 'pronoun-subject': {
        const tagged = q.rule !== 'nearest-subject' && q.rule !== 'none' && q.used && !q.used.entityId;
        return tagged && UNNAMED_PRONOUN.test(text.slice(q.used!.start, q.used!.end)) ? lastNamedSubject(q) : undefined;
      }
      case 'named-subject':
        return q.rule === 'nearest-subject' ? lastNamedSubject(q) : undefined;
    }
  }

  // The last clause subject before the quote in its paragraph that names someone other than the player.
  function lastNamedSubject(q: FallbackInput): { speaker: string; mention: MentionLink } | undefined {
    const last = clauseSubjects(q.para, q.run.start, q.runs).find((m) => m.entityId && m.entityId !== playerId);
    return last ? { speaker: last.entityId!, mention: last } : undefined;
  }

  // The paragraph's prose mentions before `before` that open a clause, latest first, named before unnamed.
  function clauseSubjects(within: Paragraph, before: number, quoteRuns: Paragraph[]): MentionLink[] {
    const inQuote = (m: MentionLink) => quoteRuns.some((q) => m.start >= q.start && m.end <= q.end);
    return mentions.filter((m) => m.start >= within.start && m.end <= before && !inQuote(m)
      && /(?:^|[.!?;]["”]?\s+|["”]\s*|,\s+(?:and|but|then)\s+|\n)\s*$/.test(text.slice(within.start, m.start)))
      .sort((a, b) => b.start - a.start || (b.entityId ? 1 : 0) - (a.entityId ? 1 : 0));
  }

  // The quote's own I, me, my, mine and myself, from its text.
  function firstPersonSpans(run: ReadingSpan): ReadingSpan[] {
    return [...text.slice(run.start, run.end).matchAll(FIRST_PERSON_WORD)]
      .map((m) => ({ start: run.start + m.index, end: run.start + m.index + m[0].length }));
  }

  // An action beat: the text right after the quote opens on its speaker (`"…" Mira grins.`).
  function beatSpeaker(quoteEnd: number, after: string): RuleResult {
    const lead = /^\s*[,.!?;—–-]?\s*/.exec(after)![0].length;
    const word = /^[^\s.,!?"“”]+/.exec(after.slice(lead));
    if (!word) return { speaker: undefined };
    const opening = mentions.filter((m) => m.start === quoteEnd + lead && m.end > m.start)
      .sort((a, b) => (b.entityId ? 1 : 0) - (a.entityId ? 1 : 0) || b.end - a.end)[0];
    if (playerSubject(word[0])) return { speaker: playerId, mention: opening };
    return { speaker: speakerOf(opening), mention: opening };
  }

  // The last mention before the quote, in the paragraph's prose, that opens a clause.
  function nearestSubject(within: Paragraph, before: number, quoteRuns: Paragraph[]): RuleResult {
    const last = clauseSubjects(within, before, quoteRuns)[0];
    return { speaker: speakerOf(last), mention: last };
  }
}

/** The clusters a speech verb ties to a quote in `text`, by index (Q73). The paragraph-subject fallback is left
 *  out: it hands scare quotes to whoever the paragraph describes. */
export function quoteSpeakingClusters(text: string, clusters: readonly CorefCluster[]): Set<number> {
  const seen = new Set<string>();
  const mentions: MentionLink[] = clusters.flatMap((cluster, i) => cluster.flatMap(([start, end]) => {
    const key = `${start}:${end}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ start, end, entityId: String(i) }];
  }));
  return new Set(quoteSpeakers(text, mentions, new Set(), null, { verbOnly: true }).flatMap((q) => (q.speaker === null ? [] : [Number(q.speaker)])));
}

/** The Mention Reading of one finished passage. */
export function readMentions(
  text: string, clusters: CorefCluster[], cast: CastEntity[], scene: MentionSceneContext = {},
): MentionReading {
  return readPassageMentions(text, clusters, cast, scene).reading;
}

/** The Mention Reading of one finished passage, with the entity each cluster's vote named (Q35). */
export function readPassageMentions(
  text: string, clusters: CorefCluster[], cast: CastEntity[], scene: MentionSceneContext = {},
): { reading: MentionReading; clusterEntities: (string | null)[] } {
  const player = playerWords(scene, cast);
  const playerId = scene.player?.id ?? null;
  const prose = stripQuotedSpeech(text);
  // The persona names clusters and is a parser hit like any cast member.
  const [name, ...aliases] = scene.player?.names ?? [];
  const voters = playerId && name?.trim() ? [...cast, { id: playerId, name, aliases }] : cast;
  const { links, clusterEntities } = nameMentions(text, clusters, voters);
  const isPlayerWord = ({ start, end }: { start: number; end: number }) => {
    const word = playerForm(text.slice(start, end));
    // The player: "you", their names, and the narrator's own "I" (a speaker's "I" sits inside a quote).
    const narratorI = FIRST_PERSON.test(word) && prose.slice(start, end) === text.slice(start, end);
    return SECOND_PERSON.test(word) || player.has(word) || narratorI;
  };
  // Deduped by span; the first assertion of a span wins, as the evaluation's scorer reads them.
  const seen = new Set<string>();
  const mentions = links.filter((m) => {
    const key = `${m.start}:${m.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((m) => (isPlayerWord(m) ? { ...m, entityId: playerId } : m));
  // A cluster no cast member won, made only of player words, is the player's (Q67); a mixed one stays unnamed.
  const named = playerId
    ? clusterEntities.map((id, i) => id ?? (clusters[i].every(([start, end]) => isPlayerWord({ start, end })) ? playerId : null))
    : clusterEntities;
  // Player words merged into a cluster someone else won (Q67); the player's own cluster is not mixed.
  const mixed = new Set(clusters.filter((c, i) => named[i] !== playerId && c.some(([start, end]) => isPlayerWord({ start, end })))
    .flatMap((c) => c.map(([start, end]) => `${start}:${end}`)));
  return { reading: { mentions, quotes: quoteSpeakers(text, mentions, player, playerId, { mixed }) }, clusterEntities: named };
}
