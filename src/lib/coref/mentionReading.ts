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

/** One quoted run of speech and who said it; `speaker` is null when no cast entity is the speaker. */
export interface QuoteSpeaker {
  start: number;
  end: number;
  speaker: string | null;
}

export interface MentionReading {
  mentions: MentionLink[];
  quotes: QuoteSpeaker[];
}

/** What the reading needs from the scene beyond the cast. */
export interface MentionSceneContext {
  /** The player character's name: it and "I"/"you" never resolve to a cast entity. */
  playerName?: string;
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

/** Every span the reading asserts, cluster mentions first, in the evaluation's order. */
function nameMentions(text: string, clusters: CorefCluster[], cast: CastEntity[]): MentionLink[] {
  // The matcher reads only the picked fields.
  const hits: Hit[] = findEntityMatches(text, cast as Entity[])
    .flatMap((m) => m.spans.map((s) => ({ entityId: m.entityId, start: s.start, end: s.end, text: s.text })));
  const links: MentionLink[] = [];
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
    for (const [s, f] of cluster) links.push({ start: s, end: f, entityId });
  }
  const everyday = new Map(cast.map((e) => [e.id, isEverydayName(e.name)]));
  hits.forEach((h, i) => {
    // A hit that named a cluster is spoken for; any other hit stands as the parser's own evidence.
    if (used.has(i) && clusters.some((c) => c.some(([s, f]) => s <= h.start && h.end <= f))) return;
    if (everyday.get(h.entityId) && !used.has(i)) return;
    links.push({ start: h.start, end: h.end, entityId: h.entityId });
  });
  return links;
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

/** The player's name and its words, lowercased, minus any word a cast member's name also holds. */
const playerWords = (scene: MentionSceneContext, cast: CastEntity[]): Set<string> => {
  const name = scene.playerName?.trim().toLowerCase();
  if (!name) return new Set();
  const castWords = new Set(cast.flatMap((e) => e.name.toLowerCase().split(/\s+/)));
  return new Set([name, ...name.split(/\s+/).filter((w) => !castWords.has(w))]);
};

interface Paragraph {
  start: number;
  end: number;
}

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

/**
 * The speaker of each quote: the mention at a speech verb attached to the quote, else the nearest preceding
 * subject mention in the paragraph, else none.
 */
function quoteSpeakers(text: string, mentions: MentionLink[], player: Set<string>): QuoteSpeaker[] {
  const isPlayer = (m: MentionLink) => {
    const t = text.slice(m.start, m.end).replace(POSSESSIVE_RE, '').toLowerCase();
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
    (m === undefined ? undefined : isPlayer(m) ? null : m.entityId);
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
      const sv = AFTER_SUBJECT_VERB.exec(after);
      if (sv) {
        const subjStart = run.end + sv.index + sv[0].indexOf(sv[1]);
        speaker = playerSubject(sv[1]) ? null : speakerOf(mentionAt(subjStart, subjStart + sv[1].length));
      }
      if (speaker === undefined) {
        const vs = AFTER_VERB_SUBJECT.exec(after);
        if (vs) {
          const subjStart = run.end + vs[0].length;
          const word = /^[^\s.,!?"“”]+(?:\s+[^\s.,!?"“”]+){0,3}/.exec(after.slice(vs[0].length));
          if (word) speaker = speakerOf(mentionAt(subjStart, subjStart + word[0].length));
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
          if (wordBeforeVerb && playerSubject(wordBeforeVerb[1])) speaker = null;
          const candidates = mentions.filter((m) => m.end <= verbAt && m.start >= sentenceStart
            && /^\s*(?:\w+ly\s+)?$/.test(text.slice(m.end, verbAt)));
          if (speaker === undefined) speaker = speakerOf(candidates.sort((a, b) => b.end - a.end)[0]);
        }
      }
      if (speaker === undefined) speaker = nearestSubject(para, run.start, runs);
      quotes.push({ start: run.start, end: run.end, speaker: speaker ?? null });
    });
  }
  return quotes;

  // The last mention before the quote, in the paragraph's prose, that opens a clause.
  function nearestSubject(within: Paragraph, before: number, quoteRuns: Paragraph[]): string | null | undefined {
    const inQuote = (m: MentionLink) => quoteRuns.some((q) => m.start >= q.start && m.end <= q.end);
    const subjects = mentions.filter((m) => m.start >= within.start && m.end <= before && !inQuote(m)
      && /(?:^|[.!?;]["”]?\s+|["”]\s*|,\s+(?:and|but|then)\s+|\n)\s*$/.test(text.slice(within.start, m.start)));
    const last = subjects.sort((a, b) => b.start - a.start || (b.entityId ? 1 : 0) - (a.entityId ? 1 : 0))[0];
    return speakerOf(last);
  }
}

/** The Mention Reading of one finished passage. */
export function readMentions(
  text: string, clusters: CorefCluster[], cast: CastEntity[], scene: MentionSceneContext = {},
): MentionReading {
  const player = playerWords(scene, cast);
  const prose = stripQuotedSpeech(text);
  // Deduped by span; the first assertion of a span wins, as the evaluation's scorer reads them.
  const seen = new Set<string>();
  const mentions = nameMentions(text, clusters, cast).filter((m) => {
    const key = `${m.start}:${m.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((m) => {
    const word = text.slice(m.start, m.end).replace(POSSESSIVE_RE, '').toLowerCase();
    // The player: "you", their name, and the narrator's own "I" (a speaker's "I" sits inside a quote).
    const narratorI = FIRST_PERSON.test(word) && prose.slice(m.start, m.end) === text.slice(m.start, m.end);
    return SECOND_PERSON.test(word) || player.has(word) || narratorI ? { ...m, entityId: null } : m;
  });
  return { mentions, quotes: quoteSpeakers(text, mentions, player) };
}
