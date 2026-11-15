/**
 * The coref gold sets (private training-data repo) and the evaluation's scoring of a Mention Reading
 * against them. The repo sits beside this checkout as `formamorph-training-data`, or where
 * `FORMAMORPH_TRAINING_DATA` points; tests that read it skip when it is missing.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Entity } from '@/types';
import type { CorefCluster } from '@/lib/coref/corefHost';
import { entitiesInProse, mentionEntityAt, readMentions, type MentionReading } from '@/lib/coref/mentionReading';

export interface GoldCastMember {
  id: string;
  name: string;
  aliases?: string[];
  strangerName?: string;
  generic?: boolean;
}

export interface GoldPassage {
  id: string;
  text: string;
  cast: GoldCastMember[];
  present: string[];
  /** `entity` is a cast id, or "NONE"/"OTHER" for a trap: a span that must stay unlinked. */
  mentions: { start: number; end: number; text: string; entity: string }[];
  quotes: { start: number; end: number; speaker: string | null }[];
}

export type GoldSetName = 'real' | 'hard' | 'blind' | 'quotes';

/** The training-data checkout, or null when it is absent. */
export function trainingDataDir(): string | null {
  if (process.env.FORMAMORPH_TRAINING_DATA) return process.env.FORMAMORPH_TRAINING_DATA;
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'formamorph-training-data');
    if (existsSync(path.join(candidate, 'coref'))) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}

export function loadGoldSet(dir: string, name: GoldSetName): GoldPassage[] | null {
  const file = path.join(dir, 'coref', 'gold', `${name}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { passages: GoldPassage[] }).passages : null;
}

/** Recorded clusters of one model for every gold passage, keyed `<set>:<passage id>`. */
export function loadGoldClusters(dir: string, model: string): Record<string, CorefCluster[]> | null {
  const file = path.join(dir, 'coref', 'gold', 'preds', `${model}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { clusters: Record<string, CorefCluster[]> }).clusters : null;
}

// Gold casts carry only the fields the matchers read.
export const goldCast = (cast: GoldCastMember[]): Entity[] =>
  cast.map((m) => ({ id: m.id, name: m.name, aliases: m.aliases ?? [], strangerName: m.strangerName,
    ...(m.generic ? { kind: 'generic' as const } : {}) }) as unknown as Entity);

const PRONOUN_RE = /^(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves|it|its|itself)$/i;

type Kind = 'name' | 'descriptor' | 'pronoun';
const kindOf = (text: string): Kind =>
  (PRONOUN_RE.test(text) ? 'pronoun' : text[0] !== text[0].toLowerCase() && !text.includes(' ') ? 'name' : 'descriptor');

export interface Tally {
  ok: number;
  total: number;
  wrong: number;
}

export interface GoldScore {
  name: Tally;
  descriptor: Tally;
  pronoun: Tally;
  /** Traps left unlinked. */
  traps: Tally;
  /** Gold-present entities found (ok), of all gold-present (total); `wrong` = entities found that are absent. */
  presence: Tally;
  fails: string[];
}

const tally = (): Tally => ({ ok: 0, total: 0, wrong: 0 });

/** combo_eval's scoring: each gold mention's attributed entity, traps, and presence. */
export function scoreReadings(passages: GoldPassage[], read: (p: GoldPassage) => MentionReading): GoldScore {
  const s: GoldScore = { name: tally(), descriptor: tally(), pronoun: tally(), traps: tally(), presence: tally(), fails: [] };
  for (const p of passages) {
    const reading = read(p);
    for (const g of p.mentions) {
      const got = mentionEntityAt(reading, g.start, g.end);
      if (g.entity === 'NONE' || g.entity === 'OTHER') {
        s.traps.total++;
        if (got === null) s.traps.ok++;
        else s.fails.push(`${p.id}: '${g.text}'@${g.start} is ${g.entity}, got ${got}`);
        continue;
      }
      const t = s[kindOf(g.text)];
      t.total++;
      if (got === g.entity) t.ok++;
      else {
        if (got !== null) t.wrong++;
        s.fails.push(`${p.id}: '${g.text}'@${g.start} is ${g.entity}, got ${got}`);
      }
    }
    const present = new Set(entitiesInProse(p.text, reading));
    const gold = new Set(p.present);
    for (const e of gold) {
      s.presence.total++;
      if (present.has(e)) s.presence.ok++;
      else s.fails.push(`${p.id}: presence -${e} (missed)`);
    }
    for (const e of present) {
      if (gold.has(e)) continue;
      s.presence.wrong++;
      s.fails.push(`${p.id}: presence +${e} (not present)`);
    }
  }
  return s;
}

export interface QuoteScore {
  /** Quotes whose speaker (cast id or none) matches the label. */
  ok: number;
  total: number;
  /** Quotes given a cast speaker other than the label's. */
  wrong: number;
  fails: string[];
}

/** Each labeled quote against the reading's quote at the same span. */
export function scoreQuotes(passages: GoldPassage[], read: (p: GoldPassage) => MentionReading): QuoteScore {
  const s: QuoteScore = { ok: 0, total: 0, wrong: 0, fails: [] };
  for (const p of passages) {
    const reading = read(p);
    for (const q of p.quotes) {
      s.total++;
      const got = reading.quotes.find((r) => r.start === q.start && r.end === q.end)?.speaker ?? null;
      if (got === q.speaker) s.ok++;
      else {
        if (got !== null) s.wrong++;
        s.fails.push(`${p.id}: ${JSON.stringify(p.text.slice(q.start, q.start + 30))} is ${q.speaker}, got ${got}`);
      }
    }
  }
  return s;
}

/** The reading the app would make of a gold passage from recorded clusters. */
export const readGold = (clusters: Record<string, CorefCluster[]>, set: GoldSetName) => (p: GoldPassage) =>
  readMentions(p.text, clusters[`${set}:${p.id}`] ?? [], goldCast(p.cast));
