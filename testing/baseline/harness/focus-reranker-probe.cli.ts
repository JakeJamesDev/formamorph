// Focus reranker probe: can a pretrained cross-encoder tier the entities with no training?
// Scores each (turn, entity) pair over the labeled turns in ../focus-classifier-cases.json, then maps scores to
// tiers with two thresholds fit on the tune half (even-indexed cases) and reports the held half beside the full
// set, as the classifier probe does (Q27). The Focus threshold is the highest that keeps tune Focus recall at 95%.
//
// Usage: npx vite-node testing/baseline/harness/focus-reranker-probe.cli.ts -- [--models id,id] [--out file.json]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { AutoModelForSequenceClassification, AutoTokenizer, env } from '@huggingface/transformers';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { resolveEntityText, type ResolveOptions } from '@/lib/placeholders';
import { migrateWorld } from '@/lib/version';
import type { Entity } from '@/types';
import { tallyLabels, type FocusTier, type LabelOutcome } from './focus-classifier-score';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const MODELS = argVal('--models', [
  'Xenova/ms-marco-MiniLM-L-6-v2',
  'mixedbread-ai/mxbai-rerank-xsmall-v1',
  'Alibaba-NLP/gte-reranker-modernbert-base',
  'onnx-community/bge-reranker-v2-m3-ONNX',
].join(',')).split(',');
const out = argVal('--out', '.scratch/focus-reranker/results.json');
env.cacheDir = path.resolve('.scratch/hf-cache');

interface Scene { world: string; location: string; here: string[]; sub: Record<string, string[]> }
interface Case {
  id: string; scene: string; lastNarration: string; action: string;
  tiers: Record<string, FocusTier>; alsoOk?: Record<string, FocusTier>;
}
const file = JSON.parse(readFileSync(path.resolve('testing/baseline/focus-classifier-cases.json'), 'utf8')) as {
  scenes: Record<string, Scene>; cases: Case[];
};
const split = (i: number) => (i % 2 === 0 ? 'tune' : 'held');

/** Each scene entity's name, sublocation, summary and description, placeholders at their first value. */
function sceneEntities(scene: Scene) {
  const world = migrateWorld(JSON.parse(readFileSync(path.resolve(scene.world), 'utf8')));
  const opts: ResolveOptions = { placeholders: allPlaceholders(world), rolls: {}, pick: (values) => values[0]?.text ?? '' };
  const text = (e: Entity, s?: string) => resolveEntityText(e, s ?? '', opts).replace(/\s+/g, ' ').trim();
  const entry = (name: string, where: string | null) => {
    const e = world.entities.find((x: Entity) => x.name === name);
    if (!e) throw new Error(`${scene.world} has no entity ${name}`);
    const description = text(e, e.aiDescription);
    return { name, where, summary: text(e, e.aiSummary) || description, description };
  };
  return [
    ...scene.here.map((n) => entry(n, null)),
    ...Object.entries(scene.sub).flatMap(([where, names]) => names.map((n) => entry(n, where))),
  ];
}
const scenes = new Map(Object.entries(file.scenes).map(([id, s]) => [id, sceneEntities(s)]));

type Ent = ReturnType<typeof sceneEntities>[number];
const QUERIES = {
  action: (c: Case) => c.action,
  turn: (c: Case) => `${c.action}\n\nThe scene so far: ${c.lastNarration}`,
};
const DOCS = {
  summary: (e: Ent) => `${e.name}${e.where ? ` (in ${e.where})` : ''}. ${e.summary}`,
  description: (e: Ent) => `${e.name}${e.where ? ` (in ${e.where})` : ''}. ${e.description}`,
};

interface Pair { caseIndex: number; name: string; expected: FocusTier; also?: FocusTier; score: number }

/** Thresholds from the tune half: Focus keeps 95% recall, Mentionable maximizes tier match below it. */
function fit(pairs: Pair[]) {
  const tune = pairs.filter((p) => split(p.caseIndex) === 'tune');
  const focus = tune.filter((p) => p.expected === 'Focus').map((p) => p.score).sort((a, b) => a - b);
  const tFocus = focus[Math.floor(focus.length * 0.05)];
  const candidates = [...new Set(tune.map((p) => p.score).filter((s) => s < tFocus))].sort((a, b) => a - b);
  let best = { tMention: -Infinity, match: -1 };
  for (const tMention of [-Infinity, ...candidates]) {
    const match = tune.filter((p) => tierOf(p.score, tFocus, tMention) === p.expected || tierOf(p.score, tFocus, tMention) === p.also).length;
    if (match > best.match) best = { tMention, match };
  }
  return { tFocus, tMention: best.tMention };
}
const tierOf = (s: number, tFocus: number, tMention: number): FocusTier => (s >= tFocus ? 'Focus' : s >= tMention ? 'Mentionable' : 'Unused');

/** Probability that a random Focus pair outscores a random non-Focus pair. */
function auc(pairs: Pair[], positive: (p: Pair) => boolean) {
  const pos = pairs.filter(positive).map((p) => p.score);
  const neg = pairs.filter((p) => !positive(p)).map((p) => p.score);
  let wins = 0;
  for (const a of pos) for (const b of neg) wins += a > b ? 1 : a === b ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

function report(pairs: Pair[]) {
  const { tFocus, tMention } = fit(pairs);
  const outcomes = (half?: string): LabelOutcome[] => file.cases.flatMap((c, i) => {
    if (half && split(i) !== half) return [];
    const mine = pairs.filter((p) => p.caseIndex === i);
    return [{
      expected: c.tiers, accepted: c.alsoOk,
      predicted: Object.fromEntries(mine.map((p) => [p.name, tierOf(p.score, tFocus, tMention)])),
    }];
  });
  const pct = (a: number, b: number) => `${((100 * a) / b).toFixed(1)}%`;
  const fmt = (t: ReturnType<typeof tallyLabels>) => `recall ${pct(t.focusFound, t.focusExpected)} match ${pct(t.tiersMatched, t.entities)}`;
  return {
    tune: fmt(tallyLabels(outcomes('tune'))), held: fmt(tallyLabels(outcomes('held'))), all: fmt(tallyLabels(outcomes())),
    focusAuc: auc(pairs, (p) => p.expected === 'Focus').toFixed(3),
    unusedAuc: auc(pairs, (p) => p.expected !== 'Unused').toFixed(3),
  };
}

async function scoreModel(id: string) {
  const tokenizer = await AutoTokenizer.from_pretrained(id);
  const model = await AutoModelForSequenceClassification.from_pretrained(id, { dtype: 'q8' });
  const rows: Record<string, unknown>[] = [];
  for (const [qName, query] of Object.entries(QUERIES)) for (const [dName, doc] of Object.entries(DOCS)) {
    const raw: Pair[] = [];
    const started = Date.now();
    for (const [caseIndex, c] of file.cases.entries()) {
      const ents = scenes.get(c.scene)!;
      const q = query(c);
      const inputs = tokenizer(ents.map(() => q), { text_pair: ents.map(doc), padding: true, truncation: true });
      const { logits } = await model(inputs);
      const scores = Array.from(logits.data as Float32Array);
      const width = logits.dims[1] ?? 1;
      ents.forEach((e, k) => raw.push({ caseIndex, name: e.name, expected: c.tiers[e.name], also: c.alsoOk?.[e.name], score: scores[k * width] }));
    }
    const ms = Date.now() - started;
    // Relative: each score less the case's top score, so a turn's own scale does not move the thresholds.
    const relative = raw.map((p) => ({ ...p, score: p.score - Math.max(...raw.filter((r) => r.caseIndex === p.caseIndex).map((r) => r.score)) }));
    for (const [mode, pairs] of [['absolute', raw], ['relative', relative]] as const) {
      const row = { model: id, query: qName, doc: dName, mode, msPerPair: (ms / raw.length).toFixed(1), ...report(pairs) };
      console.log(JSON.stringify(row));
      rows.push(row);
    }
  }
  return rows;
}

const rows: Record<string, unknown>[] = [];
for (const id of MODELS) rows.push(...await scoreModel(id));
mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
writeFileSync(path.resolve(out), JSON.stringify(rows, null, 2));
console.log(`wrote ${out}`);
