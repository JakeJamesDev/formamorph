// Create probe — does a Create question in the World Editor come back with valid entity blocks that fit the world?
//
// Every case runs in every arm inside the same batch, so the endpoint's drift hits them all. The classifier
// request gets a canned Create label and the pick requests no pick, so only the Create request varies:
//   shipped   the app's help session with the Default preset, Creation and the Intent Classifier on
//   aa        the same session again: the A/A control, whose spread is the noise floor
//   schema    the shipped Create request with the entity rider swapped for a JSON instruction and the strict
//             schema (Q35's control arm); its fields are written back as blocks and read by the same parser
//   full      the Intent Classifier off: the full request with the entity rider (Q64), reported, never gated
//   fn        the shipped session on an endpoint known to take function calls: the face function and Tools go out
//   novoice   the Create prompt with the Mascot Voice frame written out without its guide line (only through `--arms`)
//   t<temp>   with `--temps 0.5,0.9`: the shipped arm at that Create temperature
//   <name>    with `--alt FILE,FILE`: per file, the Create prompt is the file's text; `--rider-alt FILE` swaps the
//             entity rider
//
// Refusal cases ask from a screen with no World Editor, on the shipped and aa arms only: the reply passes when it
// says something, names the World Editor and drafts no block.
//
// Scores (help-create-score.ts): blocks and valid blocks by `readEntityBlock` (Q61), stray draft fences, block
// count against the ask, and the token cap. With `--judge`, the endpoint grades each valid draft's fit to the
// world (Q62's machine stand-in); the user's hand grade decides the bar. Bars on shipped: ≥ 90% of blocks
// valid, ≥ 80% fit.
//
// Usage: npx vite-node testing/baseline/harness/help-create-probe.cli.ts --
//          [--endpoint URL] [--model default] [--token T] [--runs 5] [--parallel 4] [--only id,id] [--set dev|blind]
//          [--arms a,b] [--temps 0.5,0.9] [--alt FILE,FILE] [--rider-alt FILE] [--judge] [--grade FILE] [--show]
//        PROBE_ROUNDS=FILE appends each request's body and completion to FILE as one JSON line.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { responseFormat } from '@/lib/aiRequest/responseSchema';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { ENTITY_RIDER, type EntityDraft } from '@/lib/formaquestion/entityBlock';
import { HELP_CHIP, frameVoice, renderHelpPrompt } from '@/lib/formaquestion/helpChips';
import { createContextOf, createUserMessage } from '@/lib/formaquestion/helpCreate';
import { DEFAULT_HELP_PROMPTS, HELP_PICK_SYSTEM_PROMPT } from '@/lib/formaquestion/helpPrompt';
import { DEFAULT_HELP_OPTIONS, type HelpPresetStore } from '@/lib/formaquestion/helpPresets';
import { askHelp, type EarlierExchange } from '@/lib/formaquestion/helpSession';
import { helpSettingsOf, type HelpSettings } from '@/lib/formaquestion/helpSettings';
import type { OpenWorld } from '@/lib/formaquestion/helpWorld';
import type { WorldIndexInput } from '@/lib/formaquestion/worldIndex';
import { DEFAULT_MASCOT_RIG } from '@/lib/formaquestion/mascot';
import { DEFAULT_MASCOT_NAME } from '@/lib/formaquestion/mascotPresets';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { emptyToolSnapshot } from '@/lib/tools/toolSnapshot';
import { CREATE_SCHEMA, readFitGrade, type FitGrade, schemaAsBlocks, scoreCreateReply, scoreRefusal, type CreateScore, type RefusalScore } from './help-create-score';
import { noUsage, pct, probeSnapshot, send, sessionFetch, type Completion, type Usage } from './help-probe-shared';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const token = argVal('--token', process.env.PROBE_TOKEN ?? '');
const runs = Number(argVal('--runs', '5'));
const parallel = Number(argVal('--parallel', '4'));
const only = argVal('--only', '').split(',').filter(Boolean);
const set = argVal('--set', '');
const show = args.includes('--show');
const judge = args.includes('--judge');
const gradeFile = argVal('--grade', '');
const temps = argVal('--temps', '').split(',').filter(Boolean).map(Number);
const altFiles = argVal('--alt', '').split(',').filter(Boolean);
const riderAltFile = argVal('--rider-alt', '');
const armList = argVal('--arms', '').split(',').filter(Boolean);

interface CreateCase {
  id: string; set: 'dev' | 'blind'; kind: 'single' | 'several' | 'redraft' | 'refusal';
  world?: string; surface?: Surface; blocks: number; message: string; earlier?: string; earlierAnswer?: string;
}
const CASES_FILE = path.resolve('testing/baseline/help-create-cases.json');
const allCases = (JSON.parse(readFileSync(CASES_FILE, 'utf8')) as { cases: CreateCase[] }).cases;
const cases = allCases.filter((c) => (!only.length || only.includes(c.id)) && (!set || c.set === set));

const altName = (file: string) => path.basename(file, path.extname(file));
type Arm = string;
const ALL_ARMS: Arm[] = ['shipped', 'aa', 'schema', 'full', 'fn', 'novoice', ...temps.map((t) => `t${t}`), ...altFiles.map(altName), ...(riderAltFile ? [altName(riderAltFile)] : [])];
const ARMS = armList.length ? ALL_ARMS.filter((arm) => armList.includes(arm)) : ALL_ARMS.filter((arm) => arm !== 'novoice');
const REFUSAL_ARMS = new Set<Arm>(['shipped', 'aa']);

/** The Create prompt with the Mascot Voice frame written out, less the line about the guide's control names. */
const NO_GUIDE_VOICE = DEFAULT_HELP_PROMPTS.create.replace(
  HELP_CHIP.voice,
  frameVoice(DEFAULT_MASCOT_RIG.voice, DEFAULT_MASCOT_NAME).replace(/ Start with the answer, and write each step and control name as the guide writes it\./, ''),
);
if (NO_GUIDE_VOICE === DEFAULT_HELP_PROMPTS.create || NO_GUIDE_VOICE.includes('as the guide writes it')) {
  console.error('help-create-probe: the novoice arm needs the Create prompt to carry the Mascot Voice chip and its guide line');
  process.exit(1);
}

/** Settings with Creation on, the Intent Classifier as `classify`, and the Default preset with `create` and `temperature`. */
function settingsOf({ classify = true, create = DEFAULT_HELP_PROMPTS.create, temperature = DEFAULT_HELP_OPTIONS.create.temperature } = {}): HelpSettings {
  const presets: HelpPresetStore = {
    activeId: 'probe',
    presets: [{ id: 'probe', name: 'Probe', prompts: { ...DEFAULT_HELP_PROMPTS, create }, options: { ...DEFAULT_HELP_OPTIONS, create: { ...DEFAULT_HELP_OPTIONS.create, temperature } } }],
  };
  return helpSettingsOf({ presets, creation: true, intentClassifier: classify });
}
const SETTINGS: Record<Arm, HelpSettings> = {
  shipped: settingsOf(), aa: settingsOf(), schema: settingsOf(), full: settingsOf({ classify: false }), fn: settingsOf(),
  novoice: settingsOf({ create: NO_GUIDE_VOICE }),
  ...Object.fromEntries(temps.map((t) => [`t${t}`, settingsOf({ temperature: t })])),
  ...Object.fromEntries(altFiles.map((file) => [altName(file), settingsOf({ create: readFileSync(file, 'utf8').trim() })])),
  ...(riderAltFile ? { [altName(riderAltFile)]: settingsOf() } : {}),
};
const riderAlt = riderAltFile ? readFileSync(riderAltFile, 'utf8').trim() : '';

const ENTITIES_TAB: Surface = { screen: 'worldEditor', dialog: null, tabs: ['worldEditor.entities'] };
const SCHEMA_LINE = 'Reply with one JSON object: an `entities` list that holds each entity the player asks for, with its name and its AI description of one to four sentences.';
const INTENT_PROMPT = renderHelpPrompt(DEFAULT_HELP_PROMPTS.intent);

const worlds = new Map<string, WorldIndexInput>();
const worldOf = (name: string): WorldIndexInput => {
  if (!worlds.has(name)) worlds.set(name, JSON.parse(readFileSync(path.resolve(`src/defaultworlds/${name}.json`), 'utf8')) as WorldIndexInput);
  return worlds.get(name)!;
};
const index = bundledDocsIndex();
const snapshot = probeSnapshot({ endpoint, model, token });
const fnSnapshot = probeSnapshot({ endpoint, model, token }, true);

const sse = (content: string) => new Response(
  `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`,
  { headers: { 'Content-Type': 'text/event-stream' } },
);

/** The function names each arm's first Create request offered. */
const offered = new Map<Arm, string[]>();

interface SentBody { messages: { role: string; content: unknown }[]; response_format?: unknown }

interface Sample { answer: string; finish: string | null; usage: Usage; createRequest: boolean }

/** One case through the app's help session. The classifier and pick requests are canned; the rest goes to the endpoint. */
async function ask(arm: Arm, c: CreateCase): Promise<Sample> {
  const usage = noUsage();
  let finish: string | null = null;
  let createRequest = false;
  const real = sessionFetch(usage, (body, completion) => {
    finish = completion.choices?.[0]?.finish_reason ?? null;
    if (process.env.PROBE_ROUNDS) appendFileSync(process.env.PROBE_ROUNDS, `${JSON.stringify({ arm, caseId: c.id, body, completion })}\n`);
  });
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as SentBody;
    const system = String(body.messages[0]?.content);
    if (system === INTENT_PROMPT) return sse(body.response_format ? '{"intent":"Create","secondAsk":"no"}' : 'Intent: Create\nSecond ask: no');
    if (system === HELP_PICK_SYSTEM_PROMPT) return sse('No section of the list answers the question.');
    const last = body.messages.at(-1)!;
    const isCreate = typeof last.content === 'string' && last.content.includes(ENTITY_RIDER);
    createRequest ||= isCreate && !!c.world;
    if (isCreate && !offered.has(arm)) offered.set(arm, ((body as { tools?: { function: { name: string } }[] }).tools ?? []).map((t) => t.function.name));
    if (isCreate && arm === 'schema') {
      last.content = String(last.content).replace(ENTITY_RIDER, SCHEMA_LINE);
      body.response_format = responseFormat(CREATE_SCHEMA);
    } else if (isCreate && riderAlt && arm === altName(riderAltFile)) {
      last.content = String(last.content).replace(ENTITY_RIDER, riderAlt);
    }    return real(url, { ...init, body: JSON.stringify(body) });
  }) as typeof fetch;
  const authored = c.world ? worldOf(c.world) : undefined;
  const world: OpenWorld | undefined = authored && {
    // Create runs no code test, so the stat-code source is never read.
    lean: 'editor', snapshot: emptyToolSnapshot, authored: () => authored as never, world: () => authored,
  };
  const history: EarlierExchange[] = c.earlier && c.earlierAnswer ? [{ question: c.earlier, answer: c.earlierAnswer }] : [];
  let answer = '';
  for await (const event of askHelp({ question: c.message, history, settings: SETTINGS[arm], snapshot: arm === 'fn' ? fnSnapshot : snapshot, index, fetchImpl, surface: c.surface ?? ENTITIES_TAB, world })) {
    if (event.type === 'done') answer = event.text;
  }
  return { answer: arm === 'schema' && c.world ? schemaAsBlocks(answer) : answer, finish, usage, createRequest };
}

const JUDGE_PROMPT = [
  'You check entities drafted for a text adventure world. An entity is a character, creature or other being the narrator plays.',
  '',
  'A draft fits when all of these hold:',
  "- It belongs in the world's setting and keeps the world's tone, as the world's description and sample entities show them.",
  "- Its name follows the style of the world's names, and no entity of the world already uses it.",
  '- It is what the author asked for. For a change to an earlier draft, it makes the asked change.',
  '',
  'Answer with two lines: "Fit: yes" or "Fit: no", then "Why:" and one sentence.',
].join('\n');

/** The endpoint's fit grade of one draft, or null when its reply holds no grade. */
async function gradeFit(c: CreateCase, draft: EntityDraft): Promise<FitGrade | null> {
  const context = createContextOf(worldOf(c.world!));
  const ask = c.earlier ? `${c.earlier}\nThen: ${c.message}` : c.message;
  const user = `${createUserMessage(ask, context)}\n\nDraft:\nName: ${draft.name}\nAI Description: ${draft.aiDescription}`;
  const result = await send(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: JUDGE_PROMPT }, { role: 'user', content: user }], temperature: 0, max_tokens: 120 }),
  }, noUsage());
  if (result instanceof Response) return null;
  return readFitGrade((result as Completion).choices?.[0]?.message?.content ?? '');
}

async function pool<T>(jobs: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (next < jobs.length) {
      const at = next++;
      results[at] = await jobs[at]();
    }
  }));
  return results;
}

interface Row {
  caseId: string; set: CreateCase['set']; kind: CreateCase['kind']; arm: Arm; run: number;
  answer?: string; finish?: string | null; createRequest?: boolean;
  score?: CreateScore; refusal?: RefusalScore; fits?: (FitGrade | null)[]; error?: string;
}

const jobs: (() => Promise<Row>)[] = [];
for (let run = 1; run <= runs; run++) {
  for (const c of cases) {
    for (const arm of ARMS) {
      if (c.kind === 'refusal' && !REFUSAL_ARMS.has(arm)) continue;
      jobs.push(async () => {
        const row: Row = { caseId: c.id, set: c.set, kind: c.kind, arm, run };
        try {
          const sample = await ask(arm, c);
          Object.assign(row, { answer: sample.answer, finish: sample.finish, createRequest: sample.createRequest });
          if (c.kind === 'refusal') row.refusal = scoreRefusal(sample.answer);
          else {
            row.score = scoreCreateReply(sample.answer, c.blocks, createContextOf(worldOf(c.world!)).entityNames);
            if (judge) row.fits = await Promise.all(row.score.drafts.map((draft) => gradeFit(c, draft)));
          }
        } catch (error: unknown) {
          row.error = error instanceof Error ? error.message : String(error);
        }
        const s = row.score;
        const line = row.error ? `ERROR ${row.error}`
          : row.refusal ? `refusal ${row.refusal.pass ? 'pass' : 'FAIL'}${row.refusal.noBlock ? '' : ' drafted'}${row.refusal.namesEditor ? '' : ' no-editor'}`
          : `${s!.valid}/${s!.blocks} valid${s!.countMatch ? '' : ' count'}${s!.strays ? ` strays ${s!.strays}` : ''}${row.finish === 'length' ? ' CAP' : ''}${row.createRequest || arm === 'full' ? '' : ' NO-CREATE'}${s?.duplicates.some(Boolean) ? ` DUP ${s.duplicates.filter(Boolean).length}` : ''}${row.fits ? ` fit ${row.fits.filter((f) => f?.fit).length}/${row.fits.length}` : ''}`;
        console.log(`[${run}] ${arm.padEnd(8)} ${c.id.padEnd(18)} ${line}`);
        if (show) console.log(`${row.answer ?? ''}\n---`);
        return row;
      });
    }
  }
}

console.log(`help-create-probe: ${cases.length} cases × ${runs} runs, arms ${ARMS.join(', ')}, ${endpoint} (${model})${judge ? ', judged' : ''}`);
const started = Date.now();
const rows = await pool(jobs, parallel);

/** One arm's numbers over a set of rows. */
function summary(arm: Arm, list: Row[]) {
  const scored = list.filter((r) => r.arm === arm && r.score);
  const blocks = scored.reduce((n, r) => n + r.score!.blocks, 0);
  const valid = scored.reduce((n, r) => n + r.score!.valid, 0);
  const fits = scored.flatMap((r) => r.fits ?? []);
  // A judged draft fits only with a new name: the judge misses names the world already uses.
  const fitsNew = scored.flatMap((r) => (r.fits ?? []).map((f, at) => !!f?.fit && !r.score!.duplicates[at]));
  const refusals = list.filter((r) => r.arm === arm && r.refusal);
  return {
    replies: scored.length, blocks, valid,
    dup: scored.reduce((n, r) => n + r.score!.duplicates.filter(Boolean).length, 0),
    fitNew: fitsNew.filter(Boolean).length,
    empty: scored.filter((r) => r.score!.blocks === 0).length,
    strays: scored.reduce((n, r) => n + r.score!.strays, 0),
    count: scored.filter((r) => r.score!.countMatch).length,
    cap: scored.filter((r) => r.finish === 'length').length,
    fit: fits.filter((f) => f?.fit).length, graded: fits.filter(Boolean).length,
    refused: refusals.filter((r) => r.refusal!.pass).length, refusals: refusals.length,
    errors: list.filter((r) => r.arm === arm && r.error).length,
  };
}

/** Each run's valid-block share on an arm, and with `--judge` its fit+new share: the spread the A/A arm sets. */
const perRun = (arm: Arm, list: Row[]) => Array.from({ length: runs }, (_, at) => {
  const s = summary(arm, list.filter((r) => r.run === at + 1));
  const valid = s.blocks ? Math.round((100 * s.valid) / s.blocks) : NaN;
  return judge ? `${valid}/${s.graded ? Math.round((100 * s.fitNew) / s.graded) : NaN}` : String(valid);
});

for (const [label, list] of [['all', rows], ['dev', rows.filter((r) => r.set === 'dev')], ['blind', rows.filter((r) => r.set === 'blind')]] as const) {
  console.log(`\n== ${label}`);
  console.log('arm       replies  valid/blocks       empty strays count  cap   dup  fit (judge)   fit+new   refusal  errors  per run: valid% (/fit+new% judged)');
  for (const arm of ARMS) {
    const s = summary(arm, list);
    console.log(`${arm.padEnd(9)} ${String(s.replies).padStart(7)}  ${pct(s.valid, s.blocks)} ${`${s.valid}/${s.blocks}`.padEnd(9)} ${String(s.empty).padStart(5)} ${String(s.strays).padStart(6)} ${pct(s.count, s.replies)} ${String(s.cap).padStart(4)} ${pct(s.dup, s.valid)}  ${judge ? `${pct(s.fit, s.graded)} ${`${s.fit}/${s.graded}`.padEnd(8)}  ${pct(s.fitNew, s.graded)}  ` : '   –                   '}  ${s.refusals ? pct(s.refused, s.refusals) : '   –'}  ${String(s.errors).padStart(6)}  ${perRun(arm, list).join(' ')}`);
  }
}
console.log(`\n${rows.length} replies in ${Math.round((Date.now() - started) / 1000)} s`);
for (const [arm, names] of offered) console.log(`${arm} offers: ${names.join(", ") || "no functions"}`);

const dir = path.resolve('.scratch/create-probe');
mkdirSync(dir, { recursive: true });
const dump = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(dump, JSON.stringify({ endpoint, model, runs, arms: ARMS, rows }, null, 2));
console.log(`dump: ${dump}`);

// The hand-grade sample: every valid draft of the shipped arm's first run, with the judge's grade beside it and
// empty spot-check and user columns, as create-grade.md lays them out.
if (gradeFile) {
  const byId = new Map(allCases.map((c) => [c.id, c]));
  let row = 0;
  const lines = rows.filter((r) => r.arm === 'shipped' && r.run === 1 && r.score).flatMap((r) => {
    const c = byId.get(r.caseId)!;
    return r.score!.drafts.map((draft, at) => {
      const grade = r.fits?.[at];
      const ask = c.earlier ? `${c.earlier} → ${c.message}` : c.message;
      const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
      const dup = r.score!.duplicates[at] ? ' ⚠️ name already in the world' : '';
      return `| ${++row} | ${c.id} | ${c.world} | ${cell(ask)} | **${cell(draft.name)}**${dup}: ${cell(draft.aiDescription)} | ${grade ? `${grade.fit ? '✅' : '❌'} ${cell(grade.why)}` : '–'} |  |  |`;
    });
  });
  writeFileSync(gradeFile, `${lines.join('\n')}\n`);
  console.log(`grade rows: ${gradeFile} (${lines.length})`);
}
