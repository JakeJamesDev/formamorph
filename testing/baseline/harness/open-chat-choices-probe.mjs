// Open Chat choices probe — A/B the Open Chat world's choices prompt against a baseline, over the real
// bundled world (src/defaultworlds/open-chat.json) and one imported SillyTavern card
// (../open-chat-cards.json, read through the real card importer). Assembly uses the production boundaries:
// world migration, the world-prompt seam, choicesSystemPrompt, and parseChoices.
//
//   Arm A = the world's choices prompt at --a-world-rev (default: the revision 1 prompt), or the built-in
//           choices prompt with --a-builtin (what a player gets after the per-world opt-out).
//   Arm B = the world's own choices prompt in the working tree, or --override-file.
//
// A choice in revision 2 is the message the player could send back, typed bare, or a deed between
// asterisks. Each case is one fixed reply in the revision 2 frame: a first-person message from the entity
// with its actions between asterisks. `greeting` is the imported greeting as page one, in the card's own
// shape. `question` and `greeting` put a question to the player and want a typed message. `duo` has two
// entities, each with a name-prefixed message. `empty` has no entity: the false-positive guard, nobody is
// there to message. Seeds are paired across arms. Metrics are regex counts; read the printed choices.
//
// Usage: npx vite-node testing/baseline/harness/open-chat-choices-probe.mjs -- [--endpoint URL]
//          [--model default] [--runs 2] [--arms A,B] [--cases question,banter] [--seed 11]
//          [--concurrency 1] [--override-file FILE] [--a-world-rev REV] [--a-builtin] [--rescore FILE]
//          [--token T] [--quiet]
//   --override-file  Draft choices prompt for arm B, in place of the one stored on the world.
//   --a-world-rev    Arm A reads the world from this git revision.
//   --quiet          Prints progress and the table, not each choice.
//   --rescore        A stored run file: scores its replies again with the current metrics, sends nothing.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultChoicesPrompt, defaultChoicesUserPrompt } from '@/components/game/GamePrompts';
import { migrateWorld } from '@/lib/version';
import { readTavernJson } from '@/lib/tavernCard';
import { parseChoices } from '@/lib/choices';
import { choicesSystemPrompt, TURN_PASS_CAPS } from '@/lib/turnPipeline/turnPasses';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { ALL_PROMPT_VARIABLES, variableVariantIds, withVariant } from '@/lib/promptVariables';
import { expandScopedTokens, buildLocationContext, renderEntityRoster } from '@/lib/locationContext';
import { personaContextValues } from '@/lib/personaContext';
import { resolvePlaceholders } from '@/lib/placeholders';
import { renderUserMacro } from '@/lib/userMacro';
import { resolveWorldPrompt, worldPromptChipValues, setWorldPromptOverride } from '@/lib/worldPrompt';

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, '../../..');
const WORLD_PATH = 'src/defaultworlds/open-chat.json';
// The revision 1 choices prompt: the baseline for the message rewrite.
const REVISION_1 = '535e7b50';

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
const overrideFile = option('--override-file');
const aBuiltin = args.includes('--a-builtin');
const aWorldRev = aBuiltin ? null : option('--a-world-rev', REVISION_1);
const quiet = args.includes('--quiet');
const rescoreFile = option('--rescore');

// ---------- fixtures ----------
const loadWorld = (text) => migrateWorld(JSON.parse(text));
const worldB = loadWorld(await readFile(path.join(REPO_ROOT, WORLD_PATH), 'utf8'));
if (overrideFile) {
  const text = (await readFile(overrideFile, 'utf8')).replace(/\r\n/g, '\n').trimEnd();
  worldB.worldOverview.promptOverrides =
    setWorldPromptOverride(worldB.worldOverview.promptOverrides, 'choices', { text, enabled: true });
}
const worldA = aWorldRev
  ? loadWorld(execFileSync('git', ['show', `${aWorldRev}:${WORLD_PATH}`], { cwd: REPO_ROOT, encoding: 'utf8' }))
  : worldB;
const [lead, second] = JSON.parse(await readFile(path.join(HARNESS_DIR, '../open-chat-cards.json'), 'utf8'))
  .map((card) => readTavernJson(JSON.stringify(card)).entity);

const CASES = {
  // Page one: the imported greeting, in the card's own shape, is the message the first choices answer.
  greeting: { entities: [lead], wantsMessage: true, reply: renderUserMacro(lead.openings[0].text, { kind: 'opening' }) },
  question: {
    entities: [lead], wantsMessage: true,
    reply: '*I slide a chipped mug across the counter and wrap both hands around my own.* Go on, then. You\'ve come in every Thursday for a year and I still don\'t know what you do all day. What is it that keeps you out this late?\n\n*I wait, one eyebrow up, while the rain ticks against the window behind you.*',
  },
  banter: {
    entities: [lead], wantsMessage: true,
    reply: '*I don\'t look up as your hand closes on the green cloth spine.* That one\'s not for sale. I know, I know, it has a price in it. The price is a lie I tell to people I don\'t like. *I turn a page of the ledger.* You can read it here. It doesn\'t leave the shop, and mind the fern somebody pressed between the endpapers.',
  },
  task: {
    entities: [lead], wantsMessage: false,
    reply: '*I set the estate box on the counter between us and hand you the letter opener, handle first.* Your turn. My hands are full of tea. It\'s been sealed twice, so go slow, and whatever is in there isn\'t books. *I nod at the box as something inside shifts, soft and heavy.*',
  },
  duo: {
    entities: [lead, second], wantsMessage: true,
    reply: 'Tobias: *I come in backwards through the door, shaking water off my jacket.* Maren! Tell me you didn\'t open it without me. *I see you and grin, already pulling off a glove to shake your hand.* Oh, good, a witness. Has she told you whose estate it was? She won\'t tell me.\n\nMaren: Because you\'d tell the whole street. *I look at you over the rim of my mug, and I haven\'t decided whose side I want you on.*',
  },
  // Nobody is present. The world's Opening Action ran, so the scene is the near-empty location.
  empty: {
    entities: [], wantsMessage: false,
    reply: 'You look up. The room is quiet, and nobody answers. A chair stands pushed back from a table, a coat still over its arm, and a door at the far side is open a hand\'s width. The air smells of rain. Whoever was here left without hurry, and not long ago.',
  },
};
const caseIds = list('--cases', Object.keys(CASES).join(','));

// ---------- assembly ----------
function buildMessages(arm, entities, reply) {
  const world = arm === 'A' ? worldA : worldB;
  const placeholders = world.placeholders ?? [];
  const resolvePH = (text) => resolvePlaceholders(text, { placeholders, rolls: {}, pins: {} });
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
  for (const key in values) values[key] = resolvePH(values[key]);
  Object.assign(values, worldPromptChipValues(overview, declined, resolvePH));

  const template = resolveWorldPrompt(overview, 'choices', defaultChoicesPrompt, declined);
  return {
    system: choicesSystemPrompt(template, 'English', values),
    user: renderPromptTemplate(defaultChoicesUserPrompt, { '<NARRATION>': reply, '<PLAYER ACTION>': '' }),
  };
}

// Choices carry no sampler pin, so the request sends no temperature: the endpoint's own value applies.
async function call(system, user, seed) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: TURN_PASS_CAPS.choices, stream: false, seed, reasoning_effort: 'none',
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const choice = body.choices?.[0];
  return {
    text: (choice?.message?.content ?? '').trim(),
    cut: choice?.finish_reason === 'length',
    tokens: body.usage?.completion_tokens ?? 0,
  };
}

// ---------- metrics ----------
const ACTION_RE = /\*[^*\n]+\*/g;
const wordCount = (s) => (s.trim().match(/\S+/g) ?? []).length;
const contentWords = (s) => new Set(s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
const dice = (a, b) => {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return (2 * shared) / (a.size + b.size);
};
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A line that is not a choice at all: the parser keeps it, so the player would see it as a button.
const JUNK = /^\s*(#{1,6}\s|(here (are|is)|here'?s|your options|options?\b|choices?\b|option \d|choose\b|possible (actions|replies|messages))|.*:\s*$)|\{\{|<[A-Z][A-Z ]+[|>]/i;
// Reported speech as the lead of a line: the choice tells what I say instead of being it.
const SAY_LEAD = /^\s*I (?:\w+ly )?(say|says|ask|asks|tell|tells|reply|replies|answer|answers|respond|responds|remark|remarks|admit|admits|explain|explains|insist|insists)\b/i;
// A deed typed bare ("I walk to the door"): "I" and a verb that is not something people say about
// themselves, addressed to nobody. The typed option should be words sent; a deed sits between asterisks.
const I_VERB = /^I (?:\w+ly )?(\w+)\b(?!')/;
const SAID_OF_SELF = /^(am|was|work|think|know|believe|see|feel|live|prefer|say|have|had|want|need|like|love|hate|guess|suppose|mean|read|came|heard|saw|thought|do|did|can|could|would|should|will|might|must|just|mostly|rarely|never|always|still|bet|hope|wish|doubt|promise|swear|told|said|owe|collect|write|teach|drive|sell|fix|run|keep|get|got|remember|forget|understand|agree|trust|figure|imagine|wonder|admit|hear|miss|appreciate|accept|insist|suspect|reckon)$/i;
const isBareDeed = (typed) => {
  const verb = typed.replaceAll('’', "'").match(I_VERB)?.[1];
  return Boolean(verb) && !SAID_OF_SELF.test(verb) && !/\byou(r|rs)?\b/i.test(typed);
};
// A softer reading of reported speech: a reporting verb anywhere outside the deeds.
const REPORTED = /\b(ask|tell|say|answer|reply|admit|explain|confess|insist|agree|tease|joke|greet|thank|promise|assure|remind|warn)s?\b/i;

function scoreLine(line, entities) {
  const stars = (line.match(/\*/g) ?? []).length;
  const unbalanced = stars % 2 === 1;
  const deeds = unbalanced ? [] : (line.match(ACTION_RE) ?? []);
  // The typed words: the line minus its deeds.
  const typed = line.replace(ACTION_RE, ' ').replace(/\s+/g, ' ').trim();
  const junk = JUNK.test(line);
  const quoted = /["“”]/.test(line);
  const sayLead = SAY_LEAD.test(line);
  const deedOnly = !unbalanced && deeds.length > 0 && typed === '';
  const message = !junk && !unbalanced && typed !== '';
  const bareDeed = message && !sayLead && isBareDeed(typed);
  // A break of the player's voice: the entity as the speaker or actor, or "I notices".
  const names = entities.map((e) => e.name.split(' ')[0].replace(/[^\w]/g, ''));
  const third = new RegExp(`^(?:she|he|they|${names.map(escapeRe).join('|') || '(?!)'})\\s+(?:\\w+ly\\s+)?\\w+(?:s|es|ed)\\b`, 'i');
  const entitySpeaks = new RegExp(
    `\\b(she|he|they|${names.map(escapeRe).join('|') || '(?!)'})\\s+(?:\\w+ly\\s+)?(says?|asks?|replies|answers|adds?|snorts?)\\b`, 'i').test(typed);
  // The words the player wrote: the typed text, or the deed inside its asterisks.
  const own = deedOnly ? deeds[0].slice(1, -1) : typed;
  const narrated = third.test(own);
  const agreement = /^I (?:\w+ly )?(?!was\b|always\b|sometimes\b|perhaps\b|has\b)\w+(?<![su])s\b/.test(own);
  const voiced = !junk && !unbalanced && !entitySpeaks && !narrated && !agreement;
  return {
    line, words: wordCount(line), junk, quoted, sayLead, deedOnly, message, bareDeed, unbalanced, voiced, agreement,
    // A message that also carries a deed: allowed, and longer than the words alone.
    mixed: message && deeds.length > 0,
    reported: message && !sayLead && REPORTED.test(typed),
    typedWords: wordCount(typed),
  };
}

function scoreRun(raw, entities) {
  const lines = parseChoices(raw).map((line) => scoreLine(line, entities));
  const sets = lines.map((l) => contentWords(l.line));
  const pairs = sets.flatMap((a, i) => sets.slice(i + 1).map((b) => dice(a, b)));
  return {
    lines,
    count: lines.length,
    // The parser never fails; success means it kept at least 3 lines and every one is a usable choice.
    parsed: lines.length >= 3 && lines.every((l) => !l.junk && !l.unbalanced),
    // The prompt asks for 3 to 5. The parser keeps up to 6.
    inRange: lines.length >= 3 && lines.length <= 5,
    overlap: pairs.length ? pairs.reduce((a, b) => a + b, 0) / pairs.length : 0,
  };
}

// ---------- run ----------
const jobs = [];
for (const arm of arms) for (const caseId of caseIds) for (let r = 0; r < runs; r++) jobs.push({ arm, caseId, run: r });

async function runJob({ arm, caseId, run }) {
  const spec = CASES[caseId];
  const { system, user } = buildMessages(arm, spec.entities, spec.reply);
  try {
    const reply = await call(system, user, baseSeed + run);
    return { arm, caseId, run, system: run === 0 ? system : undefined, raw: reply.text, cut: reply.cut,
      tokens: reply.tokens, ...scoreRun(reply.text, spec.entities) };
  } catch (e) {
    return { arm, caseId, run, error: String(e.message || e) };
  }
}

const results = [];
if (rescoreFile) {
  // Stored replies through the current metrics: no request is sent.
  const stored = JSON.parse(await readFile(rescoreFile, 'utf8')).results;
  for (const r of stored) {
    results.push(r.error ? r : { ...r, ...scoreRun(r.raw, CASES[r.caseId].entities) });
  }
  jobs.length = 0;
  console.log(`Open Chat choices probe · rescore of ${rescoreFile}`);
} else {
  console.log(`Open Chat choices probe · ${endpoint} · model "${model}" · arms ${arms.join('/')} (A = ${aBuiltin ? 'built-in' : aWorldRev}) · cases ${caseIds.join(', ')} · ${runs} run(s)`);
  // Warm-up, so a cold model load does not land inside the first timed job.
  await call('Reply with one word.', 'ready?', 1).catch(() => {});
}

let next = 0;
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    results.push(await runJob(job));
    if (quiet) console.log(`  done ${job.arm} ${job.caseId} #${job.run + 1} (${results.length}/${jobs.length})`);
  }
}));

// ---------- report ----------
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const rate = (xs) => `${xs.filter(Boolean).length}/${xs.length}`;
const pct = (xs) => (xs.length ? `${Math.round((xs.filter(Boolean).length / xs.length) * 100)}%` : '-');

if (!quiet) {
  for (const arm of arms) for (const caseId of caseIds) {
    console.log(`\n######## ${arm} · ${caseId}`);
    for (const r of results.filter((x) => x.arm === arm && x.caseId === caseId).sort((a, b) => a.run - b.run)) {
      if (r.error) { console.log(`  #${r.run + 1} ERROR: ${r.error}`); continue; }
      console.log(`  #${r.run + 1} ${r.count} choices${r.parsed ? '' : ' (PARSE!)'} · ${r.tokens} tok${r.cut ? ' (CUT!)' : ''}`);
      for (const l of r.lines) {
        const flags = [
          l.deedOnly ? 'deed' : l.mixed ? 'mixed' : l.message ? 'message' : 'other',
          l.quoted ? 'QUOTED!' : '', l.sayLead ? 'SAY-LEAD!' : '', l.bareDeed ? 'BARE-DEED!' : '', l.unbalanced ? 'STARS!' : '',
          l.voiced ? '' : 'VOICE!', l.junk ? 'JUNK!' : '',
        ];
        console.log(`      [${String(l.words).padStart(2)}w ${flags.filter(Boolean).join(' ')}] ${l.line}`);
      }
    }
  }
}

const summarize = (label, rs) => {
  const lines = rs.flatMap((r) => r.lines);
  return {
    ...label, runs: rs.length,
    parsed: rate(rs.map((r) => r.parsed)),
    '3-5': rate(rs.map((r) => r.inRange)),
    'choices/run': mean(rs.map((r) => r.count)).toFixed(1),
    message: pct(lines.map((l) => l.message)),
    deed: pct(lines.map((l) => l.deedOnly)),
    mixed: pct(lines.map((l) => l.mixed)),
    quoted: pct(lines.map((l) => l.quoted)),
    sayLead: pct(lines.map((l) => l.sayLead)),
    bareDeed: pct(lines.map((l) => l.bareDeed)),
    reported: pct(lines.map((l) => l.reported)),
    voiced: pct(lines.map((l) => l.voiced)),
    stars: lines.filter((l) => l.unbalanced).length,
    agreement: lines.filter((l) => l.agreement).length,
    'runs w/ message': rate(rs.map((r) => r.lines.some((l) => l.message))),
    words: mean(lines.map((l) => l.words)).toFixed(1),
    maxWords: Math.max(0, ...lines.map((l) => l.words)),
    '>10w': pct(lines.map((l) => l.words > 10)),
    '>25w': lines.filter((l) => l.words > 25).length,
    overlap: mean(rs.map((r) => r.overlap)).toFixed(2),
    cut: rate(rs.map((r) => r.cut)),
  };
};
const ok = results.filter((r) => !r.error);
const rows = [];
for (const arm of arms) {
  for (const caseId of caseIds) {
    const rs = ok.filter((r) => r.arm === arm && r.caseId === caseId);
    if (rs.length) rows.push(summarize({ arm, case: caseId }, rs));
  }
  const entityRuns = ok.filter((r) => r.arm === arm && CASES[r.caseId].entities.length);
  if (entityRuns.length) rows.push(summarize({ arm, case: 'ALL with an entity' }, entityRuns));
  // The replies that invite a message back: each run wants at least one typed message.
  const messageRuns = ok.filter((r) => r.arm === arm && CASES[r.caseId].wantsMessage);
  if (messageRuns.length) rows.push(summarize({ arm, case: 'ALL that invite a message' }, messageRuns));
}
console.log('');
console.table(rows);
const errors = results.filter((r) => r.error);
if (errors.length) console.log(`${errors.length} errored run(s): ${errors[0].error}`);

if (!rescoreFile) {
  const outDir = path.join(HARNESS_DIR, '../runs');
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `open-chat-choices-probe-${model.replace(/[^\w.-]/g, '_')}-${Date.now()}.json`);
  await writeFile(outFile, JSON.stringify({ endpoint, model, runs, baseSeed, overrideFile, aWorldRev, aBuiltin, rows, results }, null, 2));
  console.log(`choices and prompts: ${path.relative(REPO_ROOT, outFile)}`);
}
