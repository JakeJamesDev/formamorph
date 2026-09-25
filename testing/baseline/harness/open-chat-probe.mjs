// Open Chat probe — one arm per Style trait (Chat, Plain, Literary) over the real bundled world
// (src/defaultworlds/open-chat.json) and one imported SillyTavern card (../open-chat-cards.json, read through
// the real card importer). Assembly uses the production boundaries: world migration, trait pins, placeholder
// resolution, the opening draw, the world-prompt seam, and buildNarrationPrompt.
//
// Each Style arm runs the working-tree world with that Style trait switched on in place of the group's
// default. `--baseline` adds a `rev2` arm: the revision 2 world (one first-person message frame, no Style
// pins) at its default traits, the baseline the Chat arm is held against. `--draft FILE[,FILE]` adds one arm
// per Style over each draft world file, suffixed with one prime per draft, so a draft of the voice blocks or
// the fixed text is measured in the same batch as the shipped text (the cloud endpoint drifts between batches).
//
// Cases: solo (the imported greeting is page one, then a question, banter, and a task), cold (no greeting,
// the Style's own opening starts, then a question), empty (no entity: the guard), duo and duocold (two
// entities, the name-prefix smoke case). Seeds are paired across arms. Metrics are regex counts over each
// reply: quotation marks, the entity's grammatical person outside quoted speech, the player's line restated,
// and one held-frame flag per Style. Read the dumped prose for quality.
//
// Usage: npx vite-node testing/baseline/harness/open-chat-probe.mjs -- [--endpoint URL] [--model default]
//          [--runs 2] [--styles Chat,Plain,Literary] [--baseline] [--draft FILE,FILE] [--cases solo,cold,empty]
//          [--lengths none] [--seed 11] [--concurrency 1] [--token T] [--rescore FILE]
//   --styles     Style traits to run as arms, by name.
//   --lengths    Reply Length traits to cross with every arm: none (the group's default), Short, Medium, Long.
//   --rescore    Score a stored run again with the current metrics; sends nothing.
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
import { drawOpening, openingPool } from '@/lib/openings';
import { renderBuiltins } from '@/lib/builtinPlaceholders';
import { resolveWorldPrompt, worldPromptChipValues } from '@/lib/worldPrompt';
import { HIDDEN_SETTING_DEFAULTS } from '@/lib/settingsAdvancedData';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, '../../..');
const WORLD_PATH = 'src/defaultworlds/open-chat.json';
// The revision 2 world: the first-person message frame as one prompt, the baseline for the Chat Style.
const REVISION_2 = 'a3212692';

const args = process.argv.slice(2);
const option = (name, fallback = null) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const list = (name, fallback) => option(name, fallback).split(',').map((s) => s.trim()).filter(Boolean);
const endpoint = option('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = option('--model', 'default');
const runs = Number(option('--runs', '2'));
const baseSeed = Number(option('--seed', '11'));
const concurrency = Number(option('--concurrency', '1'));
const token = option('--token', process.env.PROBE_TOKEN || '');
const styles = list('--styles', 'Chat,Plain,Literary');
const caseIds = list('--cases', 'solo,cold,empty');
const lengths = list('--lengths', 'none');
const withBaseline = args.includes('--baseline');
const draftFiles = args.includes('--draft') ? list('--draft', '') : [];
const rescoreFile = option('--rescore');

const { paragraphLimit, maxTokens } = HIDDEN_SETTING_DEFAULTS;

// ---------- fixtures ----------
const loadWorld = (text) => migrateWorld(JSON.parse(text));
const worldShipped = loadWorld(await readFile(path.join(REPO_ROOT, WORLD_PATH), 'utf8'));
const worldDrafts = await Promise.all(draftFiles.map(async (file) => loadWorld(await readFile(file, 'utf8'))));
const worldRev2 = withBaseline
  ? loadWorld(execFileSync('git', ['show', `${REVISION_2}:${WORLD_PATH}`], { cwd: REPO_ROOT, encoding: 'utf8' }))
  : null;

// An arm is a world plus the Style trait switched on in it; `none` keeps every group's default.
const ARMS = {};
for (const style of styles) ARMS[style] = { world: worldShipped, style };
worldDrafts.forEach((world, i) => { for (const style of styles) ARMS[`${style}${"'".repeat(i + 1)}`] = { world, style }; });
if (worldRev2) ARMS.rev2 = { world: worldRev2, style: 'none' };
const armIds = Object.keys(ARMS);

const cards = JSON.parse(await readFile(path.join(HARNESS_DIR, '../open-chat-cards.json'), 'utf8'))
  .map((card) => readTavernJson(JSON.stringify(card)).entity);
const [lead, second] = cards;
// Persona None: the Player Name marker reads as "you", the way play renders it.
const greeting = renderBuiltins(lead.openings[0].text, { kind: 'opening' });

// Each turn is a beat label and the player's own line, as the app sends it. `start` is the world's own
// opening, drawn per arm since the Style trait pins it.
const turn = (beat, action) => ({ beat, action });
const start = turn('start', null);
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
  duocold: {
    entities: [{ ...lead, openings: undefined }, second],
    greeting: null,
    turns: [start, turn('question', 'Is Tobias still hiding in the back?')],
  },
  empty: { entities: [], greeting: null, turns: [start, turn('question', 'Is anyone there?')] },
};

// ---------- assembly ----------
const traitNamed = (world, name) => {
  const trait = world.traits.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (!trait) throw new Error(`no trait "${name}"`);
  return trait;
};

// The traits in play: every group's default, with each picked trait in place of its own group's.
function activeTraits(world, picks) {
  let active = world.traits.filter((t) => t.isDefault);
  for (const name of picks) {
    if (name === 'none') continue;
    const trait = traitNamed(world, name);
    active = [...active.filter((t) => t.groupId !== trait.groupId), trait];
  }
  return active;
}

function pinsFor(world, active) {
  const placeholders = world.placeholders ?? [];
  const pins = collectPins({ traits: active, disabledTraitIds: [], placeholders });
  return { placeholders, pins };
}

// The world opening as play draws it under these traits: the Style's pinned text.
function drawnOpening(world, active) {
  const { placeholders, pins } = pinsFor(world, active);
  const drawn = drawOpening(openingPool({ overview: world.worldOverview }), () => 0);
  return resolvePlaceholders(drawn?.text ?? 'START GAME', { placeholders, rolls: {}, pins, player: { name: null, kind: 'opening' } });
}

function buildSystem(world, entities, active, action, history) {
  const { placeholders, pins } = pinsFor(world, active);
  const resolvePH = (text) => resolvePlaceholders(text, { placeholders, rolls: {}, pins });
  const overview = world.worldOverview;
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
  Object.assign(values, worldPromptChipValues(overview, false, resolvePH));

  return buildNarrationPrompt({
    template: resolveWorldPrompt(overview, 'narration', defaultSystemPrompt, false),
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
const FIRST_RE = /\b(I|I'm|I've|I'll|I'd|my|me|myself|mine)\b/g;
const YOU_RE = /\byou(r|rs|rself|'re|'ll|'ve|'d)?\b/gi;
const PRONOUN_RE = /\b(she|he|her|his|him|hers|herself|himself)\b/gi;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const count = (text, re) => (text.match(re) ?? []).length;
const words = (text) => text.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
const grams = (ws, n) => new Set(ws.slice(0, ws.length - n + 1).map((_, i) => ws.slice(i, i + n).join(' ')));
const overlap = (a, b) => (a.size ? [...a].filter((g) => b.has(g)).length / a.size : 0);
// The player's line as a narrator would write it back: "I look up" becomes "you look up".
const SHIFT = { i: 'you', "i'm": "you're", "i've": "you've", "i'll": "you'll", "i'd": "you'd", me: 'you', my: 'your',
  myself: 'yourself', mine: 'yours', am: 'are' };
const shifted = (ws) => ws.map((w) => SHIFT[w] ?? w);

function score(text, action, entities) {
  const quotes = text.match(QUOTE_RE) ?? [];
  const quoteChars = quotes.reduce((n, q) => n + q.length, 0);
  const noBold = text.replace(BOLD_RE, ' ');
  const actions = noBold.match(ACTION_RE) ?? [];
  const names = entities.map((e) => e.name.split(' ')[0]);
  const prefixRe = new RegExp(`^\\s*(?:\\*\\*)?(?:${names.map(escapeRe).join('|') || '(?!)'})(?:\\*\\*)?:`, 'gm');
  const prefixed = count(text, prefixRe);
  const body = noBold.replace(prefixRe, ' ');
  // The reply outside its quoted speech: who the writer is, and who it writes about.
  const narration = body.replace(QUOTE_RE, ' ');
  // A third-person reference to the one entity present: its name, or a he/she pronoun. Read with one entity
  // only; with two, a pronoun may point at the other one.
  const selfName = entities.length === 1 ? names[0] : null;
  const thirdIn = (part) => (entities.length > 1 ? 0
    : count(part, PRONOUN_RE) + (selfName ? count(part, new RegExp(`\\b${escapeRe(selfName)}\\b`, 'g')) : 0));
  const firstOut = count(narration, FIRST_RE);
  const thirdOut = thirdIn(narration);
  const youOut = count(narration, YOU_RE);
  const person = firstOut && !thirdOut ? 'first' : thirdOut && !firstOut ? 'third' : firstOut ? 'mixed' : 'none';
  // The revision 2 message terms, kept as measured there: first person anywhere in the body, and a
  // third-person reference anywhere in it.
  const firstPerson = count(body, FIRST_RE);
  const thirdPerson = thirdIn(body);
  const spoken = body.replace(ACTION_RE, ' ');
  const youSeen = YOU_RE.test(spoken);
  YOU_RE.lastIndex = 0;
  const singles = count(noBold, /\*/g);
  // The reply is the player's own line read back: most of its word triples come from the line.
  const replyWords = words(text);
  const echo = replyWords.length > 2 && overlap(grams(replyWords, 3), grams(words(action), 3)) >= 0.5;
  // The player's line restated inside the reply: half the word pairs of one of its parts (the typed words,
  // or one asterisk deed) recur, as typed or shifted to second person. Parts under three words are too
  // short to read.
  const replyPairs = grams(replyWords, 2);
  const parts = action.replace(/\[[^\]]*\]/g, ' ').split(/\*/).map(words).filter((ws) => ws.length >= 3);
  const restated = parts.some((ws) =>
    Math.max(overlap(grams(ws, 2), replyPairs), overlap(grams(shifted(ws), 2), replyPairs)) >= 0.5);
  // Whose beat opens the reply: the player's ("You ..."), the entity's (its name or a pronoun), or the
  // writer's own first person.
  const opener = body.replace(/^[\s*"“]+/, '').split(/\s+/)[0]?.replace(/[^\w']/g, '') ?? '';
  const opensWith = /^you('re|'ve|'ll|'d|r)?$/i.test(opener) ? 'you'
    : /^(I|I'm|I've|I'll|I'd|my)$/.test(opener) ? 'first'
      : (selfName && opener === selfName) || /^(she|he|the)$/i.test(opener) ? 'entity' : 'other';
  return {
    words: replyWords.length,
    paras: text.split(/\n\s*\n/).filter((p) => p.trim()).length,
    quotes: quotes.length,
    quoteShare: text.length ? quoteChars / text.length : 0,
    person,
    firstOut,
    thirdOut,
    youOut,
    restated,
    opensWith,
    echo,
    // Chat: the entity speaks as itself, never in third person, with no quotation marks at all.
    chatHeld: (firstPerson > 0 || youSeen) && thirdPerson === 0 && quotes.length === 0 && !echo,
    // Plain: quoted speech, the entity in third person around it, and the player's line left as typed.
    plainHeld: quotes.length > 0 && person === 'third' && !restated,
    // Literary: second-person narration about the player, the entity in third person, quoted speech.
    literaryHeld: youOut > 0 && person === 'third' && quotes.length > 0,
    actions: actions.length,
    // Every asterisk opens or closes an action: an odd count is a broken span.
    actionsBalanced: singles % 2 === 0,
    prefixed,
    // A speaker gives its name, the empty-room contract.
    introduces: /\b(I'm|I am|my name is|name's|call me|it's|this is)\s+[A-Z][a-z]+/.test(text),
    // The model stepping out of the chat: a heading, a note about its own job, a request for setup.
    meta: /^\s*#|\b(narrat(e|or|ion)|please provide|scenario|as an ai)\b/im.test(spoken),
    menu: /\b(choose one|your options?|options?:|pick one)\b/i.test(spoken) || /^\s*(\d+[.)]|-|•)\s/m.test(text),
    bold: count(text, BOLD_RE),
    leak: /\{\{|<[A-Z][A-Z ]+[|>]/.test(text),
    empty: !text,
  };
}

// ---------- run ----------
async function runJob({ arm, caseId, length, run }) {
  const { world, style } = ARMS[arm];
  const spec = CASES[caseId];
  const active = activeTraits(world, [style, length]);
  const history = spec.greeting
    ? [{ role: 'user', content: 'START GAME' }, { role: 'assistant', content: spec.greeting }]
    : [];
  const turns = [];
  for (let t = 0; t < spec.turns.length; t++) {
    const { beat } = spec.turns[t];
    const action = beat === 'start' ? drawnOpening(world, active) : spec.turns[t].action;
    const system = buildSystem(world, spec.entities, active, action, history);
    const user = renderPromptTemplate(defaultNarrationUserPrompt, { '<PLAYER ACTION>': action });
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
  return { arm, caseId, length, run, entities: spec.entities.length, turns };
}

let results;
let stored = null;
if (rescoreFile) {
  stored = JSON.parse(await readFile(rescoreFile, 'utf8'));
  results = stored.results.map((r) => ({
    ...r,
    turns: r.turns.map((t) => (t.error ? t : {
      ...t, ...score(t.text, t.action, Array.from({ length: r.entities ?? CASES[r.caseId].entities.length }, (_, i) => cards[i])),
    })),
  }));
  console.log(`Open Chat probe · rescoring ${rescoreFile}`);
} else {
  const jobs = [];
  for (const arm of armIds) for (const caseId of caseIds) for (const length of lengths) for (let r = 0; r < runs; r++) {
    jobs.push({ arm, caseId, length, run: r });
  }
  console.log(`Open Chat probe · ${endpoint} · model "${model}" · arms ${armIds.join('/')} · cases ${caseIds.join(', ')} · lengths ${lengths.join(', ')} · ${runs} run(s)`);
  // Warm-up, so a cold model load does not land inside the first timed job.
  await call('Reply with one word.', [{ role: 'user', content: 'ready?' }], 1).catch(() => {});
  results = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const result = await runJob(job);
      results.push(result);
      console.log(`  done ${job.arm} ${job.caseId} ${job.length} #${job.run + 1} (${results.length}/${jobs.length})`);
    }
  }));
}

// ---------- report ----------
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const rate = (xs) => `${xs.filter(Boolean).length}/${xs.length}`;
const scored = (r) => r.turns.filter((t) => !t.error);
const select = (arm, caseId, length) => results.filter((r) => r.arm === arm && (!caseId || r.caseId === caseId) && r.length === length);
const resultArms = [...new Set(results.map((r) => r.arm))];
const resultCases = [...new Set(results.map((r) => r.caseId))];
const resultLengths = [...new Set(results.map((r) => r.length))];

const rows = [];
for (const arm of resultArms) for (const caseId of resultCases) for (const length of resultLengths) {
  const turns = select(arm, caseId, length).flatMap(scored);
  if (!turns.length) continue;
  rows.push({
    arm, case: caseId, length, n: turns.length,
    words: mean(turns.map((t) => t.words)).toFixed(0),
    paras: mean(turns.map((t) => t.paras)).toFixed(1),
    quoted: rate(turns.map((t) => t.quotes > 0)),
    'quote%': (mean(turns.map((t) => t.quoteShare)) * 100).toFixed(0),
    first: rate(turns.map((t) => t.person === 'first')),
    third: rate(turns.map((t) => t.person === 'third')),
    mixed: rate(turns.map((t) => t.person === 'mixed')),
    you: rate(turns.map((t) => t.youOut > 0)),
    restated: rate(turns.map((t) => t.restated)),
    opens: ['you', 'entity', 'first'].map((who) => `${who[0]}${turns.filter((t) => t.opensWith === who).length}`).join(' '),
    chat: rate(turns.map((t) => t.chatHeld)),
    plain: rate(turns.map((t) => t.plainHeld)),
    literary: rate(turns.map((t) => t.literaryHeld)),
    actions: mean(turns.map((t) => t.actions)).toFixed(1),
    balanced: rate(turns.map((t) => t.actionsBalanced)),
    prefixed: rate(turns.map((t) => t.prefixed > 0)),
    intro: rate(turns.map((t) => t.introduces)),
    meta: rate(turns.map((t) => t.meta)),
    menu: rate(turns.map((t) => t.menu)),
    cut: rate(turns.map((t) => t.truncated)),
    leak: rate(turns.map((t) => t.leak || t.empty)),
  });
}
console.table(rows);

// Difference of per-reply means between two arms, with a 95% interval from a bootstrap that resamples whole
// chains (a chain is one run of one case), so the turns of one chain move together.
const METRICS = {
  quoted: (t) => (t.quotes > 0 ? 100 : 0),
  first: (t) => (t.person === 'first' ? 100 : 0),
  third: (t) => (t.person === 'third' ? 100 : 0),
  restated: (t) => (t.restated ? 100 : 0),
  opensYou: (t) => (t.opensWith === 'you' ? 100 : 0),
  opensFirst: (t) => (t.opensWith === 'first' ? 100 : 0),
  chat: (t) => (t.chatHeld ? 100 : 0),
  plain: (t) => (t.plainHeld ? 100 : 0),
  literary: (t) => (t.literaryHeld ? 100 : 0),
  words: (t) => t.words,
};
let rng = baseSeed;
const random = () => { rng = (rng * 1664525 + 1013904223) % 4294967296; return rng / 4294967296; };
function bootstrap(chainsA, chainsB, metric, draws = 4000) {
  const value = (chains) => mean(chains.flatMap(scored).map(metric));
  const resample = (chains) => Array.from({ length: chains.length }, () => chains[Math.floor(random() * chains.length)]);
  const diffs = Array.from({ length: draws }, () => value(resample(chainsA)) - value(resample(chainsB))).sort((a, b) => a - b);
  return { diff: value(chainsA) - value(chainsB), lo: diffs[Math.floor(draws * 0.025)], hi: diffs[Math.ceil(draws * 0.975) - 1] };
}
const fmt = ({ diff, lo, hi }) => {
  const s = (x) => (x > 0 ? '+' : '') + x.toFixed(0);
  return `${s(diff)} [${s(lo)}, ${s(hi)}]${lo > 0 || hi < 0 ? ' *' : ''}`;
};

const baseLength = resultLengths.includes('none') ? 'none' : resultLengths[0];
const pairs = [];
for (let i = 0; i < resultArms.length; i++) for (let j = i + 1; j < resultArms.length; j++) pairs.push([resultArms[i], resultArms[j]]);
if (pairs.length) {
  console.log(`\nArm differences, all cases pooled, length ${baseLength}, per-reply points (words for words); * = interval leaves out zero`);
  console.table(pairs.map(([a, b]) => {
    const row = { pair: `${a} − ${b}` };
    const ca = select(a, null, baseLength).filter((r) => scored(r).length);
    const cb = select(b, null, baseLength).filter((r) => scored(r).length);
    if (ca.length && cb.length) for (const [name, metric] of Object.entries(METRICS)) row[name] = fmt(bootstrap(ca, cb, metric));
    return row;
  }));
  console.log('\nHeld frame per case, arm − arm, points');
  console.table(pairs.flatMap(([a, b]) => resultCases.map((caseId) => {
    const row = { pair: `${a} − ${b}`, case: caseId };
    const ca = select(a, caseId, baseLength).filter((r) => scored(r).length);
    const cb = select(b, caseId, baseLength).filter((r) => scored(r).length);
    if (ca.length && cb.length) for (const name of ['chat', 'plain', 'literary', 'quoted', 'restated']) row[name] = fmt(bootstrap(ca, cb, METRICS[name]));
    return row;
  })));
}

if (resultLengths.length > 1) {
  console.log('\nReply Length per arm, solo, words (paragraphs)');
  console.table(resultArms.map((arm) => {
    const row = { arm };
    for (const length of resultLengths) {
      const turns = select(arm, 'solo', length).flatMap(scored);
      if (turns.length) row[length] = `${mean(turns.map((t) => t.words)).toFixed(0)} (${mean(turns.map((t) => t.paras)).toFixed(1)})`;
    }
    const long = select(arm, 'solo', 'Long').filter((r) => scored(r).length);
    const short = select(arm, 'solo', 'Short').filter((r) => scored(r).length);
    if (long.length && short.length) row['Long − Short'] = fmt(bootstrap(long, short, METRICS.words));
    return row;
  }));
}

const errors = results.flatMap((r) => r.turns).filter((t) => t.error);
if (errors.length) console.log(`${errors.length} errored turn(s): ${errors[0].error}`);

if (!rescoreFile) {
  const outDir = path.join(HARNESS_DIR, '../runs');
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `open-chat-probe-${model.replace(/[^\w.-]/g, '_')}-${Date.now()}.json`);
  await writeFile(outFile, JSON.stringify({ endpoint, model, runs, baseSeed, arms: armIds, draftFiles, rows, results }, null, 2));
  console.log(`prose and prompts: ${path.relative(REPO_ROOT, outFile)}`);
}
