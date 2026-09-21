// Open Chat probe — A/B the Open Chat world's narration prompt against the built-in one, over the real
// bundled world (src/defaultworlds/open-chat.json) and one imported SillyTavern card
// (../open-chat-cards.json, read through the real card importer). Assembly uses the production boundaries:
// world migration, trait pins, placeholder resolution, the world-prompt seam, and buildNarrationPrompt.
//
//   Arm A = the built-in narration prompt over the world (what a player gets after the per-world opt-out).
//   Arm B = the world's own narration prompt.
//
// Cases: solo (greeting is page one, then three turns), duo (two entities present), cold (entity with no
// greeting, the world's Opening Action starts), empty (no entity: the false-positive guard, nobody is there
// to speak). Seeds are paired across arms. Metrics are regex counts; read the dumped prose for quality.
//
// Usage: npx vite-node testing/baseline/harness/open-chat-probe.mjs -- [--endpoint URL] [--model default]
//          [--runs 2] [--arms A,B] [--cases solo,duo,cold,empty] [--tones none] [--seed 11]
//          [--concurrency 1] [--override-file FILE] [--a-world-rev REV] [--token T]
//   --tones          Tone traits to run, one picked per job, by name: none (the middle of every group),
//                    Short, Long, "Mostly Dialogue", Descriptive, ...
//   --override-file  Draft narration prompt for arm B, in place of the one stored on the world.
//   --a-world-rev    Arm A reads the world from this git revision (e.g. one with the tone chips in the
//                    world system prompt).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultSystemPrompt, defaultNarrationUserPrompt } from '@/components/game/GamePrompts';
import { migrateWorld } from '@/lib/version';
import { readTavernJson } from '@/lib/tavernCard';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { ALL_PROMPT_VARIABLES, variableVariantIds, withVariant } from '@/lib/promptVariables';
import { expandScopedTokens, buildLocationContext, renderEntityRoster } from '@/lib/locationContext';
import { buildTraitContext } from '@/lib/traitTree';
import { personaContextValues } from '@/lib/personaContext';
import { collectPins } from '@/lib/placeholderPins';
import { resolvePlaceholders } from '@/lib/placeholders';
import { renderUserMacro } from '@/lib/userMacro';
import { resolveWorldPrompt, worldPromptChipValues, setWorldPromptOverride } from '@/lib/worldPrompt';
import { HIDDEN_SETTING_DEFAULTS } from '@/lib/settingsAdvancedData';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, '../../..');
const WORLD_PATH = 'src/defaultworlds/open-chat.json';

const args = process.argv.slice(2);
const option = (name, fallback = null) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const list = (name, fallback) => option(name, fallback).split(',').map((s) => s.trim()).filter(Boolean);
const endpoint = option('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = option('--model', 'default');
const runs = Number(option('--runs', '2'));
const baseSeed = Number(option('--seed', '11'));
const concurrency = Number(option('--concurrency', '1'));
const token = option('--token', process.env.PROBE_TOKEN || '');
const arms = list('--arms', 'A,B');
const caseIds = list('--cases', 'solo,duo,cold,empty');
const tones = list('--tones', 'none');
const overrideFile = option('--override-file');
const aWorldRev = option('--a-world-rev');

const { paragraphLimit, maxTokens } = HIDDEN_SETTING_DEFAULTS;

// ---------- fixtures ----------
const loadWorld = (text) => migrateWorld(JSON.parse(text));
const worldB = loadWorld(await readFile(path.join(REPO_ROOT, WORLD_PATH), 'utf8'));
if (overrideFile) {
  const text = (await readFile(overrideFile, 'utf8')).replace(/\r\n/g, '\n').trimEnd();
  worldB.worldOverview.promptOverrides =
    setWorldPromptOverride(worldB.worldOverview.promptOverrides, 'narration', { text, enabled: true });
}
const worldA = aWorldRev
  ? loadWorld(execFileSync('git', ['show', `${aWorldRev}:${WORLD_PATH}`], { cwd: REPO_ROOT, encoding: 'utf8' }))
  : worldB;

const cards = JSON.parse(await readFile(path.join(HARNESS_DIR, '../open-chat-cards.json'), 'utf8'))
  .map((card) => readTavernJson(JSON.stringify(card)).entity);
const [lead, second] = cards;
// Persona None: the Player Name marker reads as "you", the way play renders it.
const greeting = renderUserMacro(lead.openings[0].text, { kind: 'opening' });

// Actions are bare player text, as the app sends them. `start` is the world's own Opening Action.
const CASES = {
  solo: {
    entities: [lead],
    greeting,
    actions: [
      '"Estate sale? Whose?" I shake the rain off my coat and pull a stool up to the counter.',
      'I slit the tape on the box with my key and lift out the first book, turning it over in my hands.',
      '"You never told me why you keep the shop open this late."',
    ],
  },
  duo: {
    entities: [lead, second],
    greeting,
    actions: [
      '"I\'ll take the tea. Is Tobias still hiding in the back?"',
      'I hold the wet parcel out to Tobias. "This one has your handwriting on it."',
    ],
  },
  cold: { entities: [{ ...lead, openings: undefined }], greeting: null, actions: ['start', '"Quiet night?"'] },
  empty: { entities: [], greeting: null, actions: ['start', 'I look around for anyone else.'] },
};

// ---------- assembly ----------
function buildSystem(arm, world, entities, toneTrait, action, history) {
  const placeholders = world.placeholders ?? [];
  const active = toneTrait ? [toneTrait] : [];
  const pins = collectPins({ traits: active, disabledTraitIds: [], placeholders });
  const resolvePH = (text) => resolvePlaceholders(text, { placeholders, rolls: {}, pins });
  const overview = world.worldOverview;
  const declined = arm === 'A';
  const location = world.locations.find((l) => l.isStarting) ?? world.locations[0];
  const ids = entities.map((e) => e.id);

  const values = Object.fromEntries(ALL_PROMPT_VARIABLES.flatMap((v) =>
    [null, ...variableVariantIds(v)].map((id) => [withVariant(v.token, id), 'N/A'])));
  Object.assign(values, {
    ...expandScopedTokens('<LOCATION>', { '': (opts) => buildLocationContext(location, opts) }),
    ...expandScopedTokens('<ENTITIES>', { '': (opts) => renderEntityRoster(ids, entities, opts) }),
    ...personaContextValues(null),
    '<WORLD DESCRIPTION>': overview.systemPrompt || '',
    '<NOTES>': 'N/A',
  });
  for (const format of ['simple', 'markdown', 'xml']) {
    values[format === 'simple' ? '<TRAITS DESCRIPTION>' : `<TRAITS DESCRIPTION|${format}>`] = active.length
      ? buildTraitContext(active.map((t) => t.id), world.traits, world.traitGroups ?? [], format)
      : 'N/A';
  }
  for (const key in values) values[key] = resolvePH(values[key]);
  Object.assign(values, worldPromptChipValues(overview, declined, resolvePH));

  return buildNarrationPrompt({
    template: resolveWorldPrompt(overview, 'narration', defaultSystemPrompt, declined),
    ctx: values, action, history, dictionary: [], actionVec: null, semanticLore: false,
    embedVectors: new Map(), language: 'English', paragraphLimit, maxTokens,
    markdownOutput: HIDDEN_SETTING_DEFAULTS.markdownOutput, sectionStyle: 'markdown', resolvePH,
  }).prompt;
}

async function call(system, messages, seed) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const pins = PROMPT_SAMPLER_PINS.narration ?? {};
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model, messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: maxTokens, stream: false, seed, reasoning_effort: 'none',
      ...(pins.temperature !== undefined ? { temperature: pins.temperature } : {}),
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const choice = (await res.json()).choices?.[0];
  return { text: (choice?.message?.content ?? '').trim(), truncated: choice?.finish_reason === 'length' };
}

// ---------- metrics ----------
const QUOTE_RE = /["“][^"”\n]*["”]/g;
const shingles = (text) => {
  const words = text.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
  return new Set(words.slice(0, -2).map((_, i) => words.slice(i, i + 3).join(' ')));
};

function score(text, action, entities) {
  const quotes = text.match(QUOTE_RE) ?? [];
  const outside = text.replace(QUOTE_RE, ' ');
  const actionShingles = shingles(action);
  const echoed = quotes.filter((q) => [...shingles(q)].some((s) => actionShingles.has(s)));
  const quoteChars = quotes.reduce((n, q) => n + q.length, 0);
  const echoChars = echoed.reduce((n, q) => n + q.length, 0);
  const firstPerson = (outside.match(/\b(I|I'm|I've|I'll|I'd|my|me|myself)\b/g) ?? []).length;
  return {
    words: text.split(/\s+/).filter(Boolean).length,
    paras: text.split(/\n\s*\n/).filter((p) => p.trim()).length,
    // Speech that is not the player's own line read back: the entity's share of the reply.
    dialogueShare: text.length ? (quoteChars - echoChars) / text.length : 0,
    echoShare: text.length ? echoChars / text.length : 0,
    // The frame: the player is "you", every entity is third person. A break is first-person narration or
    // the player written in third person. A reply that is only an entity's quoted line still holds it.
    frameHeld: firstPerson === 0 && !/\bthe player\b/i.test(outside)
      && /\b(you|your|she|he|they|her|his|their)\b/i.test(outside),
    youSeen: /\byou(r|rs|rself)?\b/i.test(outside),
    // Narration that slid out of the present tense: two or more plain past-tense narrator verbs.
    pastTense: (outside.match(/\b(you|she|he|they) (was|were|had|did|said|looked|turned|seemed|felt|watched)\b/gi) ?? []).length >= 2,
    firstPerson,
    named: entities.length > 0 && entities.every((e) => text.includes(e.name.split(' ')[0])),
    // The model stepping out of the story: a heading, a note about its own job, a request for setup.
    meta: /^\s*#|\b(narrat(e|or|ion)|please provide|scenario|as an ai)\b/im.test(outside),
    narratorAsks:/\b(what (do|would|will) you (do|say)|choose one|your options?|options?:|pick one)\b/i.test(outside),
    bold: (text.match(/\*\*[^*]+\*\*/g) ?? []).length,
    asterisks: (text.replace(/\*\*[^*]+\*\*/g, '').match(/\*[^*\n]+\*/g) ?? []).length,
    leak: /\{\{|<[A-Z][A-Z ]+[|>]/.test(text),
    empty: !text,
  };
}

// ---------- run ----------
const toneTraitOf = (world, tone) => {
  if (tone === 'none') return null;
  const trait = world.traits.find((t) => t.name.toLowerCase() === tone.toLowerCase());
  if (!trait) throw new Error(`no tone trait "${tone}"`);
  return trait;
};

const jobs = [];
for (const arm of arms) for (const caseId of caseIds) for (const tone of tones) for (let r = 0; r < runs; r++) {
  jobs.push({ arm, caseId, tone, run: r });
}

async function runJob({ arm, caseId, tone, run }) {
  const world = arm === 'A' ? worldA : worldB;
  const spec = CASES[caseId];
  const trait = toneTraitOf(world, tone);
  const openingAction = world.worldOverview.openings?.[0]?.text ?? 'START GAME';
  const history = spec.greeting
    ? [{ role: 'user', content: 'START GAME' }, { role: 'assistant', content: spec.greeting }]
    : [];
  const turns = [];
  for (let t = 0; t < spec.actions.length; t++) {
    const action = spec.actions[t] === 'start' ? openingAction : spec.actions[t];
    const system = buildSystem(arm, world, spec.entities, trait, action, history);
    const user = renderPromptTemplate(defaultNarrationUserPrompt, { '<PLAYER ACTION>': action });
    let reply;
    try {
      reply = await call(system, [...history, { role: 'user', content: user }], baseSeed + run * 100 + t);
    } catch (e) {
      turns.push({ turn: t + 1, action, error: String(e.message || e) });
      break;
    }
    history.push({ role: 'user', content: action }, { role: 'assistant', content: reply.text });
    turns.push({ turn: t + 1, action, system: t === 0 ? system : undefined, text: reply.text,
      truncated: reply.truncated, ...score(reply.text, action, spec.entities) });
  }
  return { arm, caseId, tone, run, turns };
}

console.log(`Open Chat probe · ${endpoint} · model "${model}" · arms ${arms.join('/')} · cases ${caseIds.join(', ')} · tones ${tones.join(', ')} ·${runs} run(s)`);
// Warm-up, so a cold model load does not land inside the first timed job.
await call('Reply with one word.', [{ role: 'user', content: 'ready?' }], 1).catch(() => {});

const results = [];
let next = 0;
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    const result = await runJob(job);
    results.push(result);
    console.log(`  done ${job.arm} ${job.caseId} ${job.tone} #${job.run + 1} (${results.length}/${jobs.length})`);
  }
}));

// ---------- report ----------
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const rate = (xs) => `${xs.filter(Boolean).length}/${xs.length}`;
const rows = [];
for (const arm of arms) for (const caseId of caseIds) for (const tone of tones) {
  const turns = results.filter((r) => r.arm === arm && r.caseId === caseId && r.tone === tone)
    .flatMap((r) => r.turns).filter((t) => !t.error);
  if (!turns.length) continue;
  rows.push({
    arm, case: caseId, tone, n: turns.length,
    words: mean(turns.map((t) => t.words)).toFixed(0),
    paras: mean(turns.map((t) => t.paras)).toFixed(1),
    'dialogue%': (mean(turns.map((t) => t.dialogueShare)) * 100).toFixed(1),
    'echo%': (mean(turns.map((t) => t.echoShare)) * 100).toFixed(1),
    frameHeld: rate(turns.map((t) => t.frameHeld)),
    youSeen: rate(turns.map((t) => t.youSeen)),
    past: rate(turns.map((t) => t.pastTense)),
    named: rate(turns.map((t) => t.named)),
    asks: rate(turns.map((t) => t.narratorAsks)),
    meta: rate(turns.map((t) => t.meta)),
    bold: mean(turns.map((t) => t.bold)).toFixed(1),
    asterisks: mean(turns.map((t) => t.asterisks)).toFixed(1),
    cut: rate(turns.map((t) => t.truncated)),
    leak: rate(turns.map((t) => t.leak || t.empty)),
  });
}
console.table(rows);
const errors = results.flatMap((r) => r.turns).filter((t) => t.error);
if (errors.length) console.log(`${errors.length} errored turn(s): ${errors[0].error}`);

const outDir = path.join(HARNESS_DIR, '../runs');
await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, `open-chat-probe-${model.replace(/[^\w.-]/g, '_')}-${Date.now()}.json`);
await writeFile(outFile, JSON.stringify({ endpoint, model, runs, baseSeed, overrideFile, aWorldRev, rows, results }, null, 2));
console.log(`prose and prompts: ${path.relative(REPO_ROOT, outFile)}`);
