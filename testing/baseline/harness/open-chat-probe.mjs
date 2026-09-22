// Open Chat probe — A/B the Open Chat world's narration prompt against a baseline, over the real bundled
// world (src/defaultworlds/open-chat.json) and one imported SillyTavern card (../open-chat-cards.json, read
// through the real card importer). Assembly uses the production boundaries: world migration, trait pins,
// placeholder resolution, the world-prompt seam, and buildNarrationPrompt.
//
//   Arm A = the world's narration prompt at --a-world-rev (default: the revision 1 prompt), or the built-in
//           narration prompt with --a-builtin (what a player gets after the per-world opt-out).
//   Arm B = the world's own narration prompt in the working tree, or --override-file.
//
// A reply in revision 2 is one first-person chat message from the entity. Cases: solo (the greeting is page
// one, then a question, banter, and a task), cold (no greeting, the world's Opening Action starts, then a
// question), duo (two entities present: the name-prefix smoke case), duocold (two entities, no greeting),
// empty (no entity: the model introduces a speaker). Seeds are paired across arms. Metrics are regex
// counts; read the dumped prose for quality.
//
// Usage: npx vite-node testing/baseline/harness/open-chat-probe.mjs -- [--endpoint URL] [--model default]
//          [--runs 2] [--arms A,B] [--cases solo,cold,duo,empty] [--tones none] [--seed 11]
//          [--concurrency 1] [--override-file FILE] [--a-world-rev REV] [--a-builtin] [--no-rider] [--token T]
//   --tones          Tone traits to run, one picked per job, by name: none (the default trait of every
//                    group), Short, Long, Casual, Literary, "Entity Leads", "You Lead". A picked trait
//                    replaces its group's default, as the exclusive picker does.
//   --override-file  Draft narration prompt for arm B, in place of the one stored on the world.
//   --a-world-rev    Arm A reads the world from this git revision.
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
// The revision 1 narration prompt: the baseline for the first-person message rewrite.
const REVISION_1 = 'c646b365';

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
const caseIds = list('--cases', 'solo,cold,duo,empty');
const tones = list('--tones', 'none');
const overrideFile = option('--override-file');
const aBuiltin = args.includes('--a-builtin');
// Diagnostic: send the bare action with no player-preset rider, to weigh the rider against the prompt.
const noRider = args.includes('--no-rider');
const aWorldRev = aBuiltin ? null : option('--a-world-rev', REVISION_1);

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

// Each turn is a beat label and the player's own message, as the app sends it. `start` is the world's own
// Opening Action.
const turn = (beat, action) => ({ beat, action });
const start = turn('start', 'start');
const CASES = {
  solo: {
    entities: [lead],
    greeting,
    turns: [
      turn('question', 'Estate sale? Whose was it?'),
      turn('banter', "You keep the shop open past midnight and you're worried about *me* ruining something?"),
      turn('task', "Pass the box over, I'll open it. *I dry my hands on my coat*"),
    ],
  },
  cold: { entities: [{ ...lead, openings: undefined }], greeting: null, turns: [start, turn('question', 'Quiet night?')] },
  duo: {
    entities: [lead, second],
    greeting,
    turns: [
      turn('question', "I'll take the tea. Is Tobias still hiding in the back?"),
      turn('task', '*I hold the wet parcel out to Tobias* This one has your handwriting on it.'),
    ],
  },
  // Two entities with no greeting: weighs the greeting's format against the name-prefix rule.
  duocold: {
    entities: [{ ...lead, openings: undefined }, second],
    greeting: null,
    turns: [start, turn('question', 'Is Tobias still hiding in the back?')],
  },
  empty: { entities: [], greeting: null, turns: [start, turn('question', 'Is anyone there?')] },
};

// ---------- assembly ----------
// The traits in play: every group's default, with the picked tone trait in place of its own group's.
function activeTraits(world, tone) {
  const defaults = world.traits.filter((t) => t.isDefault);
  if (tone === 'none') return defaults;
  const trait = world.traits.find((t) => t.name.toLowerCase() === tone.toLowerCase());
  if (!trait) throw new Error(`no tone trait "${tone}"`);
  return [...defaults.filter((t) => t.groupId !== trait.groupId), trait];
}

function buildSystem(arm, world, entities, active, action, history) {
  const placeholders = world.placeholders ?? [];
  const pins = collectPins({ traits: active, disabledTraitIds: [], placeholders });
  const resolvePH = (text) => resolvePlaceholders(text, { placeholders, rolls: {}, pins });
  const overview = world.worldOverview;
  const declined = arm === 'A' && aBuiltin;
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
const BOLD_RE = /\*\*[^*]+\*\*/g;
const ACTION_RE = /\*[^*\n]+\*/g;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const shingles = (text) => {
  const words = text.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
  return new Set(words.slice(0, -2).map((_, i) => words.slice(i, i + 3).join(' ')));
};

function score(text, action, entities) {
  const quotes = text.match(QUOTE_RE) ?? [];
  const quoteChars = quotes.reduce((n, q) => n + q.length, 0);
  const noBold = text.replace(BOLD_RE, ' ');
  const actions = noBold.match(ACTION_RE) ?? [];
  const names = entities.map((e) => e.name.split(' ')[0]);
  const prefixRe = new RegExp(`^\\s*(?:\\*\\*)?(?:${names.map(escapeRe).join('|') || '(?!)'})(?:\\*\\*)?:`, 'gm');
  const prefixed = (text.match(prefixRe) ?? []).length;
  // The message minus its name prefix, and the same minus its asterisk actions: the words the entity typed.
  const body = noBold.replace(prefixRe, ' ');
  const spoken = body.replace(ACTION_RE, ' ');
  const firstPerson = (body.match(/\b(I|I'm|I've|I'll|I'd|my|me|myself|mine)\b/g) ?? []).length;
  // A third-person reference to the one entity present: its name, or a he/she pronoun. Read with one entity
  // only; with two, a pronoun may point at the other one. Counted over the whole body, and over the actions.
  const selfName = entities.length === 1 ? names[0] : null;
  const thirdIn = (part) => (entities.length > 1 ? 0
    : (part.match(/\b(she|he|her|his|him|hers|herself|himself)\b/gi) ?? []).length
      + (selfName ? (part.match(new RegExp(`\\b${escapeRe(selfName)}\\b`, 'g')) ?? []).length : 0));
  const thirdPerson = thirdIn(body);
  const thirdInActions = thirdPerson - thirdIn(spoken);
  const singles = (noBold.match(/\*/g) ?? []).length;
  // The reply is the player's own message read back: most of its word triples come from the action.
  const replyShingles = [...shingles(text)];
  const actionShingles = shingles(action);
  const echo = replyShingles.length > 0 && replyShingles.filter((s) => actionShingles.has(s)).length / replyShingles.length >= 0.5;
  const youSeen = /\byou(r|rs|rself)?\b/i.test(spoken);
  return {
    words: text.split(/\s+/).filter(Boolean).length,
    paras: text.split(/\n\s*\n/).filter((p) => p.trim()).length,
    firstPerson,
    thirdPerson,
    thirdInActions,
    quotes: quotes.length,
    quoteShare: text.length ? quoteChars / text.length : 0,
    // The message is quoted speech: it opens on a quotation mark.
    wrapped: /^\s*["“]/.test(text),
    echo,
    // The contract: the entity speaks as itself, never in third person, with no quotation marks at all.
    messageHeld: (firstPerson > 0 || youSeen) && thirdPerson === 0 && quotes.length === 0 && !echo,
    youSeen,
    actions: actions.length,
    // Every asterisk opens or closes an action: an odd count is a broken span.
    actionsBalanced: singles % 2 === 0,
    prefixed,
    // A speaker introduces itself by name, the empty-room contract.
    introduces: /\b(I'm|I am|my name is|name's|call me|it's|this is)\s+[A-Z][a-z]+/.test(text),
    // The model stepping out of the chat: a heading, a note about its own job, a request for setup.
    meta: /^\s*#|\b(narrat(e|or|ion)|please provide|scenario|as an ai)\b/im.test(spoken),
    menu: /\b(choose one|your options?|options?:|pick one)\b/i.test(spoken) || /^\s*(\d+[.)]|-|•)\s/m.test(text),
    bold: (text.match(BOLD_RE) ?? []).length,
    leak: /\{\{|<[A-Z][A-Z ]+[|>]/.test(text),
    empty: !text,
  };
}

// ---------- run ----------
const jobs = [];
for (const arm of arms) for (const caseId of caseIds) for (const tone of tones) for (let r = 0; r < runs; r++) {
  jobs.push({ arm, caseId, tone, run: r });
}

async function runJob({ arm, caseId, tone, run }) {
  const world = arm === 'A' ? worldA : worldB;
  const spec = CASES[caseId];
  const active = activeTraits(world, tone);
  const openingAction = world.worldOverview.openings?.[0]?.text ?? 'START GAME';
  const history = spec.greeting
    ? [{ role: 'user', content: 'START GAME' }, { role: 'assistant', content: spec.greeting }]
    : [];
  const turns = [];
  for (let t = 0; t < spec.turns.length; t++) {
    const { beat } = spec.turns[t];
    const action = beat === 'start' ? openingAction : spec.turns[t].action;
    const system = buildSystem(arm, world, spec.entities, active, action, history);
    const user = noRider ? action : renderPromptTemplate(defaultNarrationUserPrompt, { '<PLAYER ACTION>': action });
    let reply;
    try {
      reply = await call(system, [...history, { role: 'user', content: user }], baseSeed + run * 100 + t);
    } catch (e) {
      turns.push({ turn: t + 1, beat, action, error: String(e.message || e) });
      break;
    }
    history.push({ role: 'user', content: action }, { role: 'assistant', content: reply.text });
    turns.push({ turn: t + 1, beat, action, system: t === 0 ? system : undefined, text: reply.text,
      truncated: reply.truncated, ...score(reply.text, action, spec.entities) });
  }
  return { arm, caseId, tone, run, turns };
}

console.log(`Open Chat probe · ${endpoint} · model "${model}" · arms ${arms.join('/')} (A = ${aBuiltin ? 'built-in' : aWorldRev}) · cases ${caseIds.join(', ')} · tones ${tones.join(', ')} · ${runs} run(s)`);
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
    held: rate(turns.map((t) => t.messageHeld)),
    firstP: rate(turns.map((t) => t.firstPerson > 0)),
    thirdP: rate(turns.map((t) => t.thirdPerson > 0)),
    '3pAct': rate(turns.map((t) => t.thirdInActions > 0)),
    echo: rate(turns.map((t) => t.echo)),
    quoted: rate(turns.map((t) => t.quotes > 0)),
    'quote%': (mean(turns.map((t) => t.quoteShare)) * 100).toFixed(1),
    wrapped: rate(turns.map((t) => t.wrapped)),
    actions: mean(turns.map((t) => t.actions)).toFixed(1),
    balanced: rate(turns.map((t) => t.actionsBalanced)),
    prefixed: rate(turns.map((t) => t.prefixed > 0)),
    intro: rate(turns.map((t) => t.introduces)),
    meta: rate(turns.map((t) => t.meta)),
    menu: rate(turns.map((t) => t.menu)),
    bold: mean(turns.map((t) => t.bold)).toFixed(1),
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
await writeFile(outFile, JSON.stringify({ endpoint, model, runs, baseSeed, overrideFile, aWorldRev, aBuiltin, rows, results }, null, 2));
console.log(`prose and prompts: ${path.relative(REPO_ROOT, outFile)}`);
