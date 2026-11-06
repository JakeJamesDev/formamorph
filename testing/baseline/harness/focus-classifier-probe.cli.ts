// Focus Classifier probe (Focused Thinking ticket 01). Two arms over the labeled turns in
// ../focus-classifier-cases.json, each a scene with 3 or more entities here and in sublocations.
//
//   classifier  sends the draft Focus Classifier prompt per case and grades its reply against the labels:
//               Focus recall, tier match, parse failures, and the narration prompt tokens its tiers save
//               (measured with max_tokens 1 against the full roster, net of the classifier call itself).
//   narration   sends the real narration request twice per labeled narration case, with the full roster and
//               with the hand-labeled trimmed roster, interleaved in one batch. Objective continuity per
//               passage: Focus facts kept, Background entities still present, Offstage entities put onstage.
//               It also writes a shuffled, label-stripped judge packet for the blind 1-5 continuity score.
//   merge       --judge <scores.json> --run <narration run.json> joins the blind scores back to their arms.
//
// The trimmed roster renders through the app's own chips: Focus entities get the scope's full block,
// Background entities its summary block with stats off, and Offstage names join one list after the
// sublocation roster under a provisional header.
//
// Usage: npx vite-node testing/baseline/harness/focus-classifier-probe.cli.ts --
//          --arm classifier|narration|merge [--endpoint URL] [--model ID] [--runs 5] [--only id,id]
//          [--pool 4] [--dump <case id>] [--control <module exporting prompt>] [--judge scores.json --run run.json]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaultFocusClassifierPrompt, defaultFocusClassifierUserPrompt, defaultSystemPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { resolveEntityText, resolvePlaceholders, type ResolveOptions } from '@/lib/placeholders';
import { placementLetter } from '@/lib/placementLetters';
import { NONE_PLACEHOLDER } from '@/lib/promptFallbacks';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import type { ValueLookup } from '@/lib/promptValues';
import { decodeChipKey, encodeVariant } from '@/lib/promptVariables';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { ChatMessage, Entity, GameLocation } from '@/types';
import { meanCi, pairedDiff, parseFocusReply, tallyLabels, type FocusTier, type LabelOutcome } from './focus-classifier-score';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const arm = argVal('--arm', 'classifier');
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', arm === 'narration' ? '12' : '5'));
const pool = Number(argVal('--pool', '4'));
const only = argVal('--only', '');
const dump = argVal('--dump', '');
// The classifier's sampler pins, for ticket 02 to copy into PROMPT_SAMPLER_PINS (Q24).
const CLASSIFIER_PINS = { temperature: 0.2, repetitionPenalty: 1 };
const OFFSTAGE_HEADER = '## Elsewhere, not in this scene';
const SEED = 4242;

interface Scene { world: string; location: string; here: string[]; sub: Record<string, string[]> }
interface Case {
  id: string; scene: string; covers: string[]; narration?: boolean;
  prevAction: string; lastNarration: string; action: string; tiers: Record<string, FocusTier>;
}
interface Marks { presence: string; facts: string[] }
const file = JSON.parse(readFileSync(path.resolve('testing/baseline/focus-classifier-cases.json'), 'utf8')) as {
  scenes: Record<string, Scene>; cases: Case[]; marks: Record<string, Marks>;
};
const cases = file.cases.filter((c) => !only || only.split(',').includes(c.id));

// ---- Scenes: each listed entity stands where the scene puts it, and nobody else stands there.

interface Built {
  scene: Scene; location: GameLocation; entities: Entity[]; byName: Map<string, Entity>;
  /** Roster entries in letter order: here first, then each sublocation as the scene lists them. */
  roster: Array<{ letter: string; name: string; where: string | null }>;
  ctxFor: (only?: ReadonlySet<string>) => ValueLookup;
  resolveOptions: ResolveOptions;
}
const worlds = new Map<string, ReturnType<typeof migrateWorld>>();
const loadWorld = (worldPath: string) => {
  if (!worlds.has(worldPath)) worlds.set(worldPath, migrateWorld(JSON.parse(readFileSync(path.resolve(worldPath), 'utf8'))));
  return worlds.get(worldPath)!;
};

function buildScene(scene: Scene): Built {
  const world = loadWorld(scene.world);
  const place = (name: string) => {
    const found = world.locations.find((l) => l.name === name);
    if (!found) throw new Error(`${scene.world} has no location ${name}`);
    return found;
  };
  const location = place(scene.location);
  const subIds = Object.keys(scene.sub).map((name) => {
    const sub = place(name);
    if (sub.parentId !== location.id) throw new Error(`${name} is not a sublocation of ${scene.location}`);
    return sub.id;
  });
  const assigned = new Map<string, string>();
  for (const name of scene.here) assigned.set(name, location.id);
  for (const [subName, names] of Object.entries(scene.sub)) for (const name of names) assigned.set(name, place(subName).id);
  const sceneIds = new Set([location.id, ...subIds]);
  const entities = world.entities.map((entity: Entity): Entity => {
    const at = assigned.get(entity.name);
    if (at) return { ...entity, locations: [at], presence: undefined };
    return { ...entity, locations: (entity.locations ?? []).filter((id) => !sceneIds.has(id)) };
  });
  for (const name of assigned.keys()) if (!entities.some((e) => e.name === name)) throw new Error(`${scene.world} has no entity ${name}`);
  // Every placeholder takes its first value, so all arms and runs read the same world.
  const resolveOptions: ResolveOptions = { placeholders: allPlaceholders({ ...world, entities }), rolls: {}, pick: (values) => values[0]?.text ?? '' };
  const resolveText = (text: string) => resolvePlaceholders(text, resolveOptions);
  const byName = new Map(entities.map((e) => [e.name, e]));
  const roster = [
    ...scene.here.map((name) => ({ name, where: null })),
    ...Object.entries(scene.sub).flatMap(([where, names]) => names.map((name) => ({ name, where }))),
  ].map((entry, i) => ({ ...entry, letter: placementLetter(i) }));
  const ctxFor = (keep?: ReadonlySet<string>) => chipValues(authoredChipScene(
    { ...world, entities: keep ? entities.map((e) => (keep.has(e.name) || !assigned.has(e.name) ? e : { ...e, locations: [] })) : entities },
    {
      location,
      activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
      resolve: resolveText,
      resolveEntity: (entity: Entity, text: string) => resolveEntityText(entity, text, resolveOptions),
    },
  ));
  return { scene, location, entities, byName, roster, ctxFor, resolveOptions };
}
const built = new Map(Object.entries(file.scenes).map(([id, scene]) => [id, buildScene(scene)]));

// ---- Requests.

/** The classifier's lettered roster: name and AI summary, the full description when the summary is blank. */
function rosterBlock(b: Built): string {
  const line = (entry: Built['roster'][number]) => {
    const entity = b.byName.get(entry.name)!;
    const text = resolveEntityText(entity, entity.aiSummary?.trim() || entity.aiDescription || '', b.resolveOptions).replace(/\s+/g, ' ').trim();
    return `${entry.letter}: ${entry.name}. ${text}`;
  };
  const here = b.roster.filter((e) => e.where === null).map(line);
  const subs = Object.keys(b.scene.sub).map((where) => [`### In ${where}`, ...b.roster.filter((e) => e.where === where).map(line)].join('\n'));
  return ['## Who and what is here', ...here, ...subs].join('\n');
}

function classifierMessages(c: Case, system = defaultFocusClassifierPrompt): ChatMessage[] {
  const b = built.get(c.scene)!;
  const user = renderPromptTemplate(defaultFocusClassifierUserPrompt, { '<PLAYER ACTION>': c.action, '<NARRATION>': c.lastNarration });
  return [
    { role: 'system', content: system },
    { role: 'user', content: `${user.trim()}\n\n${rosterBlock(b)}` },
  ] as ChatMessage[];
}

const rosterScopeOf = (key: string) => {
  const decoded = decodeChipKey(key);
  if (decoded?.variable.token !== '<ENTITIES>') return null;
  const scope = decoded.selection.scope ?? '';
  return scope === '' || scope === 'sublocations' ? { decoded, scope } : null;
};
const realValue = (text: string | undefined) => (text && text.trim() !== NONE_PLACEHOLDER ? text.trimEnd() : null);

/** The narration chip values for `tiers`: Focus full, Background summary without stats, Offstage named once. */
function trimmedCtx(b: Built, tiers: Record<string, FocusTier>): ValueLookup {
  const full = b.ctxFor();
  const named = (tier: FocusTier) => new Set(Object.entries(tiers).filter(([, t]) => t === tier).map(([name]) => name));
  const focusCtx = b.ctxFor(named('Focus'));
  const backgroundCtx = b.ctxFor(named('Background'));
  const offstage = b.roster.filter((e) => tiers[e.name] === 'Offstage').map((e) => e.name);
  return (key: string) => {
    const roster = rosterScopeOf(key);
    if (!roster) return full(key);
    const { decoded, scope } = roster;
    const summaryId = encodeVariant(decoded.variable, { ...decoded.selection, content: 'summary', stats: 'nostats' });
    const parts = [realValue(focusCtx(key)), realValue(backgroundCtx(summaryId ? `<ENTITIES|${summaryId}>` : '<ENTITIES>'))];
    // The list rides the sublocation roster, so a template without that chip drops it.
    if (scope === 'sublocations' && offstage.length) parts.push(`\n${OFFSTAGE_HEADER}\n${offstage.join(', ')}`);
    const text = parts.filter((p): p is string => p !== null).join('\n');
    return text ? `${text}\n` : NONE_PLACEHOLDER;
  };
}

function narrationMessages(c: Case, tiers: Record<string, FocusTier> | null): ChatMessage[] {
  const b = built.get(c.scene)!;
  const system = buildNarrationPrompt({
    template: defaultSystemPrompt, ctx: tiers ? trimmedCtx(b, tiers) : b.ctxFor(), action: c.action, history: [], dictionary: [],
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  return [
    { role: 'system', content: system },
    { role: 'user', content: c.prevAction },
    { role: 'assistant', content: c.lastNarration },
    { role: 'user', content: c.action },
  ] as ChatMessage[];
}

// ---- Transport.

interface Reply { text: string; promptTokens: number; completionTokens: number }
async function complete(messages: ChatMessage[], body: Record<string, unknown>): Promise<Reply> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, seed: SEED, reasoning_effort: 'none', stream: false, ...body, messages }),
    });
    if (res.ok) {
      const json = await res.json() as { choices: Array<{ message: { content: string | null } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      return { text: json.choices[0].message.content ?? '', promptTokens: json.usage?.prompt_tokens ?? NaN, completionTokens: json.usage?.completion_tokens ?? NaN };
    }
    if (res.status < 500 || attempt >= 2) throw new Error(`${res.status} ${await res.text()}`);
  }
}
// Each run gets its own seed, so a seed-honoring local model gives replicates, not copies.
const classify = (c: Case, system: string, run: number) => complete(classifierMessages(c, system), {
  seed: SEED + run,
  temperature: CLASSIFIER_PINS.temperature,
  repetition_penalty: CLASSIFIER_PINS.repetitionPenalty, repeat_penalty: CLASSIFIER_PINS.repetitionPenalty,
  max_tokens: 12 * built.get(c.scene)!.roster.length + 24,
});
const tokenCache = new Map<string, Promise<number>>();
/** The narration request's prompt tokens under `tiers` (null = full roster), measured once per tier map. */
function narrationTokens(c: Case, tiers: Record<string, FocusTier> | null): Promise<number> {
  const key = `${c.id}|${JSON.stringify(tiers)}`;
  if (!tokenCache.has(key)) tokenCache.set(key, complete(narrationMessages(c, tiers), { max_tokens: 1 }).then((r) => r.promptTokens));
  return tokenCache.get(key)!;
}

async function inPool<T>(jobs: Array<() => Promise<T>>): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(pool, jobs.length) }, async () => {
    while (next < jobs.length) {
      const i = next++;
      out[i] = await jobs[i]();
    }
  }));
  return out;
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a');
const runDir = path.resolve('testing/baseline/runs');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

// ---- Arms.

/** One prompt's classifier results, scored and printed under `label`. */
async function reportClassifier(label: string, system: string, results: ClassifierResult[]) {
  const tally = tallyLabels(results as LabelOutcome[]);
  const saved = meanCi(results.map((r) => r.fullTokens - r.trimmedTokens));
  const cost = meanCi(results.map((r) => r.classifierTokens));
  // The fixed part is the system prompt: its tokens over a one-word user turn, less that turn alone.
  const probeTurn = [{ role: 'user', content: '.' }] as ChatMessage[];
  const [withSystem, bare] = await Promise.all([
    complete([{ role: 'system', content: system }, ...probeTurn] as ChatMessage[], { max_tokens: 1 }),
    complete(probeTurn, { max_tokens: 1 }),
  ]);
  const systemTokens = withSystem.promptTokens - bare.promptTokens;
  const perTurn = meanCi(results.map((r) => r.classifierTokens - systemTokens));
  const misses = results.flatMap((r) => Object.entries(r.expected)
    .filter(([name, tier]) => tier === 'Focus' && r.predicted?.[name] !== 'Focus')
    .map(([name]) => `[${splitOf(r.case)}] ${r.case} #${r.run}: ${name} → ${r.predicted?.[name] ?? 'parse failure'}`))
    .sort();
  const confusion: Record<string, number> = {};
  for (const r of results) for (const [name, tier] of Object.entries(r.expected)) {
    const key = `${tier}→${r.predicted?.[name] ?? 'fail'}`;
    confusion[key] = (confusion[key] ?? 0) + 1;
  }
  const line = (part: string, t: ReturnType<typeof tallyLabels>) => console.log(`  ${part.padEnd(5)} Focus recall ${pct(t.focusFound, t.focusExpected)} (${t.focusFound}/${t.focusExpected}) · tier match ${pct(t.tiersMatched, t.entities)} (${t.tiersMatched}/${t.entities}) · parse failures ${t.parseFailures}/${t.replies}`);
  console.log(`\n${label}`);
  line('tune', tallyLabels(results.filter((r) => splitOf(r.case) === 'tune') as LabelOutcome[]));
  line('held', tallyLabels(results.filter((r) => splitOf(r.case) === 'held') as LabelOutcome[]));
  line('all', tally);
  console.log(`  narration prompt tokens saved ${saved.mean.toFixed(0)} ± ${saved.half.toFixed(0)} per turn · classifier call ${cost.mean.toFixed(0)} tokens (system ${systemTokens}, per turn ${perTurn.mean.toFixed(0)}) · net ${(saved.mean - cost.mean).toFixed(0)}`);
  console.log(`  confusion (expected→got): ${Object.entries(confusion).sort().map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`  missed Focus (${misses.length}):\n    ${misses.join('\n    ') || 'none'}`);
  return { label, prompt: system, tally, saved, cost, systemTokens, perTurn, misses, confusion, results };
}

interface ClassifierResult {
  case: string; run: number; reply: string; predicted: Record<string, FocusTier> | null; expected: Record<string, FocusTier>;
  fullTokens: number; trimmedTokens: number; classifierTokens: number;
}

// Revisions tune on the even-indexed cases; the odd ones are held out.
const splitOf = (id: string) => (file.cases.findIndex((c) => c.id === id) % 2 === 0 ? 'tune' : 'held');

async function classifierArm() {
  // With --control, that module's `prompt` runs beside the current one in the same batch.
  const controlPath = argVal('--control', '');
  const prompts = [
    { label: 'current', system: defaultFocusClassifierPrompt },
    ...(controlPath ? [{ label: `control ${controlPath}`, system: (await import(pathToFileURL(path.resolve(controlPath)).href) as { prompt: string }).prompt }] : []),
  ];
  const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => prompts.map((p, arm) => async () => {
    const b = built.get(c.scene)!;
    const reply = await classify(c, p.system, run);
    const byLetter = parseFocusReply(reply.text, b.roster.map((e) => e.letter));
    const predicted = byLetter && Object.fromEntries(b.roster.map((e) => [e.name, byLetter[e.letter]]));
    const [fullTokens, trimmedTokens] = await Promise.all([narrationTokens(c, null), narrationTokens(c, predicted)]);
    console.log(`${p.label.split(' ')[0]} ${c.id} #${run} ${predicted ? b.roster.map((e) => `${e.letter}=${predicted[e.name][0]}`).join(' ') : `PARSE FAIL ${JSON.stringify(reply.text.slice(0, 120))}`}`);
    return { arm, result: { case: c.id, run, reply: reply.text, predicted, expected: c.tiers, fullTokens, trimmedTokens, classifierTokens: reply.promptTokens + reply.completionTokens } };
  })).flat());
  const done = await inPool(jobs);
  console.log(`\nmodel ${model} · runs ${runs} · cases ${cases.length} · temp ${CLASSIFIER_PINS.temperature}`);
  const reports = [];
  for (const [arm, p] of prompts.entries()) reports.push(await reportClassifier(p.label, p.system, done.filter((d) => d.arm === arm).map((d) => d.result)));
  mkdirSync(runDir, { recursive: true });
  const out = path.join(runDir, `focus-classifier-${model.replace(/[^\w.-]/g, '_')}-${stamp}.json`);
  writeFileSync(out, JSON.stringify({ model, runs, pins: CLASSIFIER_PINS, reports }, null, 2));
  console.log(`wrote ${out}`);
}

type Arm = 'full' | 'trimmed';
interface Passage { id: string; case: string; run: number; arm: Arm; text: string; promptTokens: number; focusFacts: number; backgroundPresent: number; offstageOnstage: number }

/** Objective continuity of one passage against the case's labels. */
function continuity(c: Case, text: string) {
  const hit = (pattern: string) => new RegExp(pattern, 'i').test(text);
  const ofTier = (tier: FocusTier) => Object.entries(c.tiers).filter(([, t]) => t === tier).map(([name]) => name);
  const facts = ofTier('Focus').flatMap((name) => file.marks[name]?.facts ?? []);
  const background = ofTier('Background');
  return {
    focusFacts: facts.length ? facts.filter(hit).length / facts.length : NaN,
    backgroundPresent: background.length ? background.filter((name) => hit(file.marks[name].presence)).length / background.length : NaN,
    offstageOnstage: ofTier('Offstage').filter((name) => hit(file.marks[name].presence)).length,
  };
}

async function narrationArm() {
  const picked = cases.filter((c) => c.narration);
  const ARMS: Arm[] = ['full', 'trimmed'];
  const jobs = picked.flatMap((c) => Array.from({ length: runs }, (_, run) => ARMS.map((which) => async (): Promise<Passage> => {
    const reply = await complete(narrationMessages(c, which === 'trimmed' ? c.tiers : null), { seed: SEED + run, max_tokens: 600 });
    console.log(`${c.id} #${run} ${which}: ${reply.text.length} chars`);
    return { id: '', case: c.id, run, arm: which, text: reply.text, promptTokens: reply.promptTokens, ...continuity(c, reply.text) };
  })).flat());
  const passages = await inPool(jobs);
  // Ids are numbered in an order the passage text sets, so neither an id nor its position tells the arm.
  [...passages].sort((a, b) => hash(a.text) - hash(b.text)).forEach((p, i) => { p.id = `p${String(i).padStart(3, '0')}`; });
  const pairs = (metric: keyof Passage) => {
    const of = (which: Arm) => picked.flatMap((c) => Array.from({ length: runs }, (_, run) => passages.find((p) => p.case === c.id && p.run === run && p.arm === which)![metric] as number));
    const full = of('full'); const trimmed = of('trimmed');
    const keep = full.map((v, i) => !Number.isNaN(v) && !Number.isNaN(trimmed[i]));
    return { full: full.filter((_, i) => keep[i]), trimmed: trimmed.filter((_, i) => keep[i]) };
  };
  console.log(`\nmodel ${model} · runs ${runs} per arm · cases ${picked.length}`);
  for (const [metric, higher] of [['focusFacts', true], ['backgroundPresent', true], ['offstageOnstage', false], ['promptTokens', false]] as const) {
    const { full, trimmed } = pairs(metric);
    const d = pairedDiff(full, trimmed, higher);
    const f = meanCi(full); const t = meanCi(trimmed);
    console.log(`${metric}: full ${f.mean.toFixed(3)} · trimmed ${t.mean.toFixed(3)} · better-by ${d.mean.toFixed(3)} [${d.low.toFixed(3)}, ${d.high.toFixed(3)}]${metric === 'promptTokens' ? '' : ` · no worse: ${d.noWorse}`}`);
  }
  mkdirSync(runDir, { recursive: true });
  const base = path.join(runDir, `focus-narration-${model.replace(/[^\w.-]/g, '_')}-${stamp}`);
  writeFileSync(`${base}.json`, JSON.stringify({ model, runs, passages }, null, 2));
  // The judge packet, in id order, with no arm, tier or run on any item.
  const packet = [...passages].sort((a, b) => a.id.localeCompare(b.id)).map((p) => {
    const c = file.cases.find((x) => x.id === p.case)!;
    const b = built.get(c.scene)!;
    return {
      id: p.id, world: b.scene.world, location: b.scene.location,
      present: b.roster.map((e) => {
        const entity = b.byName.get(e.name)!;
        return `${e.name}${e.where ? ` (in ${e.where})` : ''}: ${resolveEntityText(entity, entity.aiDescription ?? '', b.resolveOptions).replace(/\s+/g, ' ').trim()}`;
      }),
      previousScene: c.lastNarration, action: c.action, passage: p.text,
    };
  });
  writeFileSync(`${base}.judge.json`, JSON.stringify(packet, null, 2));
  console.log(`wrote ${base}.json and ${base}.judge.json`);
}
const hash = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0) + 7) | 0, 17);

function mergeArm() {
  const run = JSON.parse(readFileSync(argVal('--run', ''), 'utf8')) as { passages: Passage[] };
  const scores = JSON.parse(readFileSync(argVal('--judge', ''), 'utf8')) as Array<{ id: string; continuity: number; invented: boolean }>;
  const byId = new Map(scores.map((s) => [s.id, s]));
  const keyOf = (p: Passage) => `${p.case}#${p.run}`;
  const full = run.passages.filter((p) => p.arm === 'full');
  const trimmedByKey = new Map(run.passages.filter((p) => p.arm === 'trimmed').map((p) => [keyOf(p), p]));
  const paired = full.filter((p) => byId.has(p.id) && trimmedByKey.has(keyOf(p)) && byId.has(trimmedByKey.get(keyOf(p))!.id));
  for (const [metric, higher, read] of [
    ['continuity 1-5', true, (p: Passage) => byId.get(p.id)!.continuity],
    ['invented duplicate', false, (p: Passage) => (byId.get(p.id)!.invented ? 1 : 0)],
  ] as const) {
    const f = paired.map(read); const t = paired.map((p) => read(trimmedByKey.get(keyOf(p))!));
    const d = pairedDiff(f, t, higher);
    console.log(`${metric}: full ${meanCi(f).mean.toFixed(3)} · trimmed ${meanCi(t).mean.toFixed(3)} · better-by ${d.mean.toFixed(3)} [${d.low.toFixed(3)}, ${d.high.toFixed(3)}] · no worse: ${d.noWorse} · pairs ${paired.length}`);
  }
}

if (dump) {
  const c = file.cases.find((x) => x.id === dump);
  if (!c) throw new Error(`no case ${dump}`);
  const show = (messages: ChatMessage[]) => messages.map((m) => `--- ${m.role}\n${m.content}`).join('\n');
  console.log(`=== classifier\n${show(classifierMessages(c))}\n\n=== narration (trimmed)\n${show(narrationMessages(c, c.tiers))}`);
} else if (arm === 'classifier') await classifierArm();
else if (arm === 'narration') await narrationArm();
else if (arm === 'merge') mergeArm();
else throw new Error(`unknown arm ${arm}`);
