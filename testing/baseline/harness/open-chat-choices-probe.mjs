// Open Chat choices probe — A/B the Open Chat world's choices prompt against the built-in one, over the real
// bundled world (src/defaultworlds/open-chat.json) and one imported SillyTavern card
// (../open-chat-cards.json, read through the real card importer). Assembly uses the production boundaries:
// world migration, the world-prompt seam, choicesSystemPrompt, and parseChoices.
//
//   Arm A = the built-in choices prompt over the world (what a player gets after the per-world opt-out).
//   Arm B = the world's own choices prompt.
//
// Each case is one fixed narration passage in the Open Chat frame (second person, dialogue-led), written as
// standard prose. `question` and `greeting` put a question to the player and want a spoken choice. `empty`
// has no entity: the false-positive guard, nobody is there to speak to. Seeds are paired across arms.
// Metrics are regex counts; read the printed choices for quality.
//
// Usage: npx vite-node testing/baseline/harness/open-chat-choices-probe.mjs -- [--endpoint URL]
//          [--model default] [--runs 2] [--arms A,B] [--cases question,banter] [--seed 11]
//          [--concurrency 1] [--override-file FILE] [--rescore FILE] [--token T] [--quiet]
//   --override-file  Draft choices prompt for arm B, in place of the one stored on the world.
//   --quiet          Prints progress and the table, not each choice.
//   --rescore        A stored run file: scores its replies again with the current metrics, sends nothing.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
const quiet = args.includes('--quiet');
const rescoreFile = option('--rescore');

// ---------- fixtures ----------
const world = migrateWorld(JSON.parse(await readFile(path.join(REPO_ROOT, 'src/defaultworlds/open-chat.json'), 'utf8')));
if (overrideFile) {
  const text = (await readFile(overrideFile, 'utf8')).replace(/\r\n/g, '\n').trimEnd();
  world.worldOverview.promptOverrides =
    setWorldPromptOverride(world.worldOverview.promptOverrides, 'choices', { text, enabled: true });
}
const [lead, second] = JSON.parse(await readFile(path.join(HARNESS_DIR, '../open-chat-cards.json'), 'utf8'))
  .map((card) => readTavernJson(JSON.stringify(card)).entity);

const CASES = {
  // Page one: the imported greeting is the scene the first choices answer.
  greeting: { entities: [lead], wantsSpeech: true, narration: renderUserMacro(lead.openings[0].text, { kind: 'opening' }) },
  question: {
    entities: [lead], wantsSpeech: true,
    narration: 'Maren slides a chipped mug across the counter and wraps both hands around her own. Steam fogs the glasses she has finally remembered to pull down. "Go on, then," she says. "You\'ve come in every Thursday for a year and I still don\'t know what you do all day. What is it that keeps you out this late?"\n\nRain ticks against the window behind you. She waits, one eyebrow up.',
  },
  banter: {
    entities: [lead], wantsSpeech: true,
    narration: '"That one\'s not for sale," Maren says, without looking up, as your hand closes on the green cloth spine. "I know, I know. It has a price in it. The price is a lie I tell to people I don\'t like." She turns a page of the ledger. "You can read it here. It doesn\'t leave the shop."\n\nThe book is heavier than it looks, and someone has pressed a fern between the endpapers.',
  },
  task: {
    entities: [lead], wantsSpeech: false,
    narration: 'Maren sets the estate box on the counter between you and hands you the letter opener, handle first. The tape is old and yellow, and it has been sealed twice. "Your turn," she says. "My hands are full of tea."\n\nSomething inside shifts when you tilt the box, soft and heavy, not like books at all.',
  },
  duo: {
    entities: [lead, second], wantsSpeech: true,
    narration: 'The door bangs open and Tobias comes in backwards, shaking water off his jacket like a dog. "Maren! Tell me you didn\'t open it without me." He sees you and grins, already pulling off a glove to shake your hand. "Oh, good, a witness. Has she told you whose estate it was? She won\'t tell me."\n\n"Because you\'d tell the whole street," Maren says into her mug. She looks at you over the rim, and it is not clear whose side she wants you on.',
  },
  // Nobody is present. The world's Opening Action ran, so the scene is the near-empty location.
  empty: {
    entities: [], wantsSpeech: false,
    narration: 'You look up. The room is quiet, and nobody answers. A chair stands pushed back from a table, a coat still over its arm, and a door at the far side is open a hand\'s width. The air smells of rain. Whoever was here left without hurry, and not long ago.',
  },
};
const caseIds = list('--cases', Object.keys(CASES).join(','));

// ---------- assembly ----------
function buildMessages(arm, entities, narration) {
  const placeholders = world.placeholders ?? [];
  const resolvePH = (text) => resolvePlaceholders(text, { placeholders, rolls: {}, pins: {} });
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
  for (const key in values) values[key] = resolvePH(values[key]);
  Object.assign(values, worldPromptChipValues(overview, declined, resolvePH));

  const template = resolveWorldPrompt(overview, 'choices', defaultChoicesPrompt, declined);
  return {
    system: choicesSystemPrompt(template, 'English', values),
    user: renderPromptTemplate(defaultChoicesUserPrompt, { '<NARRATION>': narration, '<PLAYER ACTION>': '' }),
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
const QUOTE_RE = /["“][^"”\n]*["”]/g;
const wordCount = (s) => (s.trim().match(/\S+/g) ?? []).length;
const contentWords = (s) => new Set(s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
const dice = (a, b) => {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return (2 * shared) / (a.size + b.size);
};

// A line that is not a choice at all: the parser keeps it, so the player would see it as a button.
const JUNK = /^\s*(#{1,6}\s|(here (are|is)|here'?s|your options|options?\b|choices?\b|option \d|choose\b|possible (actions|replies))|.*:\s*$)|\{\{|<[A-Z][A-Z ]+[|>]/i;
// A deed in quotation marks ("I move to the chair."): a quote that opens with "I" and a verb, speaks to
// nobody, and whose verb is not one people say about themselves ("I work nights", "I think so").
const QUOTED_I_VERB = /^["“]I (?:\w+ly )?(\w+)\b(?!')/;
const SAID_OF_SELF = /^(am|was|work|think|know|believe|see|feel|live|prefer|say|have|had|want|need|like|love|hate|guess|suppose|mean|read|came|heard|saw|thought|do|did|can|could|would|should|will|might|must|just|mostly|rarely|never|always|still|bet|hope|wish|doubt|promise|swear|told|said|owe|collect|write|teach|drive|sell|fix|run|keep)$/i;
const isQuotedDeed = (quote) => {
  const verb = quote.replaceAll('’', "'").match(QUOTED_I_VERB)?.[1];
  return Boolean(verb) && !SAID_OF_SELF.test(verb) && !/\byou(r|rs)?\b/i.test(quote);
};
// Reported speech: the built-in form of a spoken choice.
const REPORTED = /\b(ask|tell|say|answer|reply|admit|explain|confess|insist|agree|tease|joke|greet|thank|promise|assure|remind|warn)s?\b/i;

function scoreLine(line, entities) {
  const quotes = line.match(QUOTE_RE) ?? [];
  const outside = line.replace(QUOTE_RE, ' ').trim();
  const unbalanced = ((line.match(/["“”]/g) ?? []).length % 2) === 1;
  const junk = JUNK.test(line) || unbalanced;
  const quotedDeed = quotes.some(isQuotedDeed);
  const spoken = quotes.length > 0 && !quotedDeed;
  // The player's voice: a spoken line, or first-person text outside the quotes. Every flag below is a break.
  const firstPerson = /^(I|I'|I’|My)\b/.test(outside) || /\b(I|my|me)\b/.test(outside);
  const secondPerson = /\byou(r|rs|rself)?\b/i.test(outside) && !/\bI\b/.test(outside);
  const speakers = ['she', 'he', 'they', ...entities.map((e) => e.name.split(' ')[0].replace(/[^\w]/g, ''))];
  const entitySpeaks = new RegExp(
    `\\b(${speakers.join('|')})\\s+(?:\\w+ly\\s+)?(says?|asks?|replies|answers|adds?|snorts?)\\b`, 'i').test(outside);
  // "I notices": the verb after "I" written in third person.
  const agreement = /^I (?:\w+ly )?(?!was\b|always\b|sometimes\b|perhaps\b|has\b)\w+(?<![su])s\b/.test(outside);
  const voiced = !junk && !quotedDeed && !secondPerson && !entitySpeaks && !agreement
    && (outside === '' ? spoken : firstPerson);
  return {
    line, words: wordCount(line), spoken, junk, voiced, quotedDeed, agreement,
    // A deed after the closing quotation mark: still a spoken choice, but longer than the line alone.
    tail: spoken && outside !== '',
    // Single asterisks reach the choice button as literal characters.
    asterisks: /(^|[^*])\*(?!\*)/.test(line),
    reported: !spoken && REPORTED.test(outside),
    spokenWords: quotes.reduce((n, q) => n + wordCount(q), 0),
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
    parsed: lines.length >= 3 && lines.every((l) => !l.junk),
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
  const { system, user } = buildMessages(arm, spec.entities, spec.narration);
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
  console.log(`Open Chat choices probe · ${endpoint} · model "${model}" · arms ${arms.join('/')} · cases ${caseIds.join(', ')} · ${runs} run(s)`);
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
        const flags = [l.spoken ? 'spoken' : l.quotedDeed ? 'QUOTED-DEED!' : l.reported ? 'reported' : 'action', l.voiced ? '' : 'VOICE!', l.junk ? 'JUNK!' : ''];
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
    voiced: pct(lines.map((l) => l.voiced)),
    spoken: pct(lines.map((l) => l.spoken)),
    tail: pct(lines.map((l) => l.tail)),
    reported: pct(lines.map((l) => l.reported)),
    quotedDeed: lines.filter((l) => l.quotedDeed).length,
    agreement: lines.filter((l) => l.agreement).length,
    asterisks: lines.filter((l) => l.asterisks).length,
    'runs w/ spoken': rate(rs.map((r) => r.lines.some((l) => l.spoken))),
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
  // The scenes that invite a reply: each run wants at least one spoken choice.
  const speechRuns = ok.filter((r) => r.arm === arm && CASES[r.caseId].wantsSpeech);
  if (speechRuns.length) rows.push(summarize({ arm, case: 'ALL that invite speech' }, speechRuns));
}
console.log('');
console.table(rows);
const errors = results.filter((r) => r.error);
if (errors.length) console.log(`${errors.length} errored run(s): ${errors[0].error}`);

if (!rescoreFile) {
  const outDir = path.join(HARNESS_DIR, '../runs');
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `open-chat-choices-probe-${model.replace(/[^\w.-]/g, '_')}-${Date.now()}.json`);
  await writeFile(outFile, JSON.stringify({ endpoint, model, runs, baseSeed, overrideFile, rows, results }, null, 2));
  console.log(`choices and prompts: ${path.relative(REPO_ROOT, outFile)}`);
}
