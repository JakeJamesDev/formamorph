// Help probe — does the Formaquestion help prompt answer from the docs sections it is given?
//
// Each question runs in two arms inside the same batch, so the endpoint's drift hits both:
//   docs     the app's own request: the help prompt, plus the sections the Docs Index finds for the question
//   no-docs  the control: the same model and samplers, the question alone, no guide text
//   alt      with `--alt FILE`: the docs arm with the system prompt from FILE, to compare two wordings
//   before   with `--before REF`: the docs arm with the sections the Docs Index at commit REF finds, to
//            compare a search change
//   session  with `--session`: the app's help session in retrieval mode, with the lookup arm's settings and
//            endpoint and the lookup off. The control for the lookup switch: same search sources, same face call
//   lookup   with `--lookup`: the app's help session in lookup mode, on an endpoint that takes function
//            calls. The model reads the sections it picks, in more than one round
//   lookup22 with `--lookup22`: the lookup arm with ticket 22's request (lookupControl.ts), the control for a
//            change to lookup mode
//   mismatch with `--flag`: the docs arm with the sections of another covered case, so the guide text does
//            not cover the question. The control for the general-knowledge flag: same question, wrong docs
//
// The request body comes from the app's AI Request Spec, so the sampler pins are the app's. The probe adds
// `reasoning_effort: "none"` and turns streaming off to read the token counts.
//
// Checks, all by text match, none by a model:
//   retrieval   the expected section is among the sections sent (docs arm; the same for every run)
//   reached     the expected section is among the answer's sources (session arms; per run), with the
//               function calls and the requests of the question, and the tokens in per request kind
//               (pick, answer, face, lookup)
//   facts       share of the keyed control names in the answer; `complete` = all of them
//   bold        share of the keyed names written in bold, as the guide writes them
//   steps       the answer has a numbered list
//   declined    the answer says the guide does not cover the question. Wanted on a case with no section,
//               and a fault on a covered case
//   invented    bold names in the answer that are nowhere in the docs
//   flagged     the app's general-knowledge flag: the answer has the marker, or no section reached the model.
//               Wanted on a case with no section and on the mismatch arm, and a fault on a covered case
//   first       of the marked answers, the share with the marker on the first line, where the prompt asks.
//               Not on the session arms, whose session removes the marker
//
// Usage: npx vite-node testing/baseline/harness/help-probe.cli.ts --
//          [--endpoint URL] [--model default] [--token T] [--runs 5] [--only backup-docs,regen-player]
//          [--parallel 4] [--alt FILE] [--before REF] [--session] [--lookup] [--lookup22] [--flag] [--show]
//          [--cases FILE]  (a case with no `wording` counts as player wording, no `facts` as none)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildAiRequestSpec } from '@/lib/aiRequest/aiRequestSpec';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { HELP_SYSTEM_PROMPT, helpUserMessage } from '@/lib/formaquestion/helpPrompt';
import { isGeneralKnowledge, readMarker } from '@/lib/formaquestion/generalKnowledge';
import { askHelp, helpSections } from '@/lib/formaquestion/helpSession';
import { DOCS_LOOKUP } from '@/lib/formaquestion/docsLookup';
import { DEFAULT_HELP_OPTIONS } from '@/lib/formaquestion/helpPresets';
import { helpSettingsOf } from '@/lib/formaquestion/helpSettings';
import { mean, pct, probeSnapshot } from './help-probe-shared';
import { askHelpContentsLookup } from './lookupControl';
import { refDocsIndex } from './refDocsIndex';

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
const only = argVal('--only', '');
const show = args.includes('--show');
const altFile = argVal('--alt', '');
const beforeRef = argVal('--before', '');
const withSession = args.includes('--session');
const withLookup = args.includes('--lookup');
const withLookup22 = args.includes('--lookup22');
const withFlag = args.includes('--flag');

interface HelpCase {
  id: string;
  wording: 'docs' | 'player';
  question: string;
  /** The section a correct answer comes from. Absent on a question the guide does not cover. */
  section?: string;
  facts: string[];
}
type Arm = 'docs' | 'no-docs' | 'alt' | 'before' | 'session' | 'lookup' | 'lookup22' | 'mismatch';
const ARMS: Arm[] = [
  'docs', ...(altFile ? ['alt' as const] : []), ...(beforeRef ? ['before' as const] : []), ...(withSession ? ['session' as const] : []), ...(withLookup ? ['lookup' as const] : []), ...(withLookup22 ? ['lookup22' as const] : []), ...(withFlag ? ['mismatch' as const] : []), 'no-docs',
];
/** An arm that runs a help session, and reports the sections it reached. */
const isSession = (arm: Arm) => arm === 'session' || arm === 'lookup' || arm === 'lookup22';
const ALT_SYSTEM_PROMPT = altFile ? readFileSync(altFile, 'utf8').trim() : '';

const BASELINE = path.resolve('testing/baseline');
const allCases = (JSON.parse(readFileSync(path.join(BASELINE, argVal('--cases', 'help-cases.json')), 'utf8')) as { cases: Partial<HelpCase>[] }).cases
  .map((c): HelpCase => ({ id: c.id ?? '', question: c.question ?? '', section: c.section, wording: c.wording ?? 'player', facts: c.facts ?? [] }));
const cases = only ? allCases.filter((c) => only.split(',').includes(c.id)) : allCases;

/**
 * The mismatch arm's partner of a case: the next covered case, in file order, whose section is on another
 * page. Its sections stand in for the case's own, so the guide text does not cover the question.
 */
function mismatchPartner(c: HelpCase): HelpCase {
  const coveredAll = allCases.filter((other) => other.section);
  const start = coveredAll.findIndex((other) => other.id === c.id);
  const page = (other: HelpCase) => other.section?.split('#')[0];
  for (let step = 1; step < coveredAll.length; step++) {
    const other = coveredAll[(start + step) % coveredAll.length];
    if (page(other) !== page(c)) return other;
  }
  throw new Error(`no mismatch partner for ${c.id}`);
}

const index = bundledDocsIndex();
const beforeIndex = beforeRef ? (await refDocsIndex(beforeRef)).index : index;
/** The Docs Index an arm searches. */
const indexOf = (arm: Arm) => (arm === 'before' ? beforeIndex : index);
const allDocs = index.contents()
  .flatMap((page) => index.get(page.sections.map((section) => section.id)))
  .map((section) => section.markdown)
  .join('\n')
  .toLowerCase();

/** The control's prompt: the help prompt's role and answer rules, without the lines that need a guide. */
const NO_DOCS_SYSTEM_PROMPT = [
  'You are the help writer for Formamorph, a text adventure app. A player asks how to use the app.',
  '',
  '- When the player asks how to do a task, answer with every step of that task as a numbered list.',
  '- Write each control name in bold.',
  '- After the steps, add one or two sentences of detail when the player needs them.',
].join('\n');

const snapshot = probeSnapshot({ endpoint, model, token });

interface Sample {
  answer: string;
  /** Tokens in and out, summed over the requests of the question. */
  promptTokens: number | null;
  answerTokens: number | null;
  finish: string | null;
  /** The docs sections that reached the model. */
  sentSections: number;
  /** Session arms: the session's flag, since the session removes the marker. */
  flagged?: boolean;
  /** Session arms: the answer's sources, the function calls the model made, and the requests sent. */
  sources?: string[];
  calls?: string[];
  requests?: number;
  /** Session arms: the requests and tokens in of each request kind. */
  kinds?: Partial<Record<RequestKind, KindTally>>;
}

/**
 * What a session request is for: the AI Picks request, the first answer request, or the round after a lookup
 * call or another call. A round after a lookup call and another call counts as lookup. With the default
 * settings, the only other call is the face call.
 */
type RequestKind = 'pick' | 'answer' | 'face' | 'lookup';
const REQUEST_KINDS: RequestKind[] = ['pick', 'answer', 'face', 'lookup'];
interface KindTally { requests: number; promptTokens: number }
const NO_TALLY: KindTally = { requests: 0, promptTokens: 0 };

interface Completion {
  choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function: { name: string; arguments: string } }[] }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** The same endpoint, with a record that says it takes function calls: the help session picks lookup mode. */
const lookupSnapshot = probeSnapshot({ endpoint, model, token }, true);

/**
 * One question through a help session: the app's in either mode, or ticket 22's. Each request of the session
 * goes out with streaming off, so the token counts come back, and returns to the session as the stream it expects.
 */
async function sessionRequest(arm: Arm, c: HelpCase): Promise<Sample> {
  let promptTokens = 0;
  let answerTokens = 0;
  let requests = 0;
  const calls: string[] = [];
  const kinds: NonNullable<Sample['kinds']> = {};
  // The pick request offers no function. With the default settings, every answer request offers the face call.
  let nextAnswerKind: RequestKind = 'answer';
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    const isAnswer = body.tools !== undefined;
    const kind: RequestKind = isAnswer ? nextAnswerKind : 'pick';
    const response = await fetch(url, { ...init, body: JSON.stringify({ ...body, stream: false, reasoning_effort: 'none' }) });
    if (!response.ok) return response;
    requests++;
    const json = await response.json() as Completion;
    const tokensIn = json.usage?.prompt_tokens ?? 0;
    promptTokens += tokensIn;
    answerTokens += json.usage?.completion_tokens ?? 0;
    const tally = kinds[kind] ??= { ...NO_TALLY };
    tally.requests++;
    tally.promptTokens += tokensIn;
    const choice = json.choices?.[0];
    const toolCalls = choice?.message?.tool_calls ?? [];
    calls.push(...toolCalls.map((call) => call.function.arguments));
    if (isAnswer && toolCalls.length > 0) nextAnswerKind = toolCalls.some((call) => call.function.name === DOCS_LOOKUP.name) ? 'lookup' : 'face';
    const frame = (delta: Record<string, unknown>, finish: string | null = null) =>
      `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finish }] })}\n\n`;
    const frames = [
      ...(choice?.message?.content ? [frame({ content: choice.message.content })] : []),
      ...toolCalls.map((call, at) => frame({ tool_calls: [{ index: at, id: call.id ?? `call-${at}`, type: 'function', function: call.function }] })),
      frame({}, choice?.finish_reason ?? 'stop'),
      'data: [DONE]\n\n',
    ];
    return new Response(frames.join(''), { headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof fetch;

  let answer = '';
  let sources: string[] = [];
  let flagged = false;
  const request = { question: c.question, snapshot: lookupSnapshot, index, fetchImpl };
  const session = arm === 'lookup22' ? askHelpContentsLookup(request) : askHelp({ ...request, settings: helpSettingsOf({ lookup: arm === 'lookup' }) });
  for await (const event of session) {
    if (event.type !== 'done') continue;
    answer = event.text;
    sources = event.sources.map((section) => section.id);
    flagged = event.flagged;
  }
  return { answer, promptTokens, answerTokens, finish: null, sentSections: sources.length, flagged, sources, calls, requests, kinds };
}

async function request(arm: Arm, c: HelpCase): Promise<Sample> {
  if (isSession(arm)) return sessionRequest(arm, c);
  const sections = arm === 'no-docs' ? [] : helpSections(indexOf(arm), (arm === 'mismatch' ? mismatchPartner(c) : c).question);
  const spec = buildAiRequestSpec(snapshot, arm !== 'no-docs'
    ? { systemPrompt: arm === 'alt' ? ALT_SYSTEM_PROMPT : HELP_SYSTEM_PROMPT, messages: [{ role: 'user', content: helpUserMessage(c.question, sections) }], requestType: 'help', maxTokensOverride: DEFAULT_HELP_OPTIONS.answer.maxTokens }
    : { systemPrompt: NO_DOCS_SYSTEM_PROMPT, messages: [{ role: 'user', content: `Question: ${c.question}` }], requestType: 'help', maxTokensOverride: DEFAULT_HELP_OPTIONS.answer.maxTokens });
  const response = await fetch(spec.url, {
    method: 'POST',
    headers: spec.headers,
    body: JSON.stringify({ ...spec.body, stream: false, reasoning_effort: 'none' }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const json = await response.json() as Completion;
  return {
    answer: json.choices?.[0]?.message?.content ?? '',
    promptTokens: json.usage?.prompt_tokens ?? null,
    answerTokens: json.usage?.completion_tokens ?? null,
    finish: json.choices?.[0]?.finish_reason ?? null,
    sentSections: sections.length,
  };
}

const DECLINED = /(does not|doesn't|do not|don't|not) (\w+ )?(cover|mention|include|contain|explain|describe|detail|provide|address)|no (information|section|mention)|not covered/i;
const boldNames = (text: string) => [...text.matchAll(/\*\*([^*\n]+)\*\*/g)].map((m) => m[1].trim().replace(/[:.,]$/, ''));

interface Score {
  facts: number;
  complete: boolean;
  bold: number;
  steps: boolean;
  declined: boolean;
  invented: number;
  empty: boolean;
  flagged: boolean;
  /** The marker came in, on the first line of the answer. Null with no marker. */
  first: boolean | null;
}

function score(c: HelpCase, sample: Sample): Score {
  const raw = sample.answer.trim();
  const { text: answer, marked } = readMarker(raw, { final: true });
  const lower = answer.toLowerCase();
  const bolds = boldNames(answer);
  const boldLower = bolds.map((name) => name.toLowerCase());
  const found = c.facts.filter((fact) => lower.includes(fact.toLowerCase()));
  const inBold = c.facts.filter((fact) => boldLower.some((name) => name.includes(fact.toLowerCase())));
  return {
    facts: c.facts.length ? found.length / c.facts.length : 0,
    complete: c.facts.length > 0 && found.length === c.facts.length,
    bold: c.facts.length ? inBold.length / c.facts.length : 0,
    steps: /^\s*1[.)]\s/m.test(answer),
    declined: DECLINED.test(answer),
    invented: boldLower.filter((name) => name.length > 1 && !allDocs.includes(name)).length,
    empty: !answer.trim(),
    flagged: sample.flagged ?? isGeneralKnowledge(marked, sample.sentSections),
    first: marked ? readMarker(raw.split('\n')[0], { final: true }).marked : null,
  };
}

/** Runs the jobs with at most `limit` in flight. */
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

interface Row { caseId: string; arm: Arm; run: number; sample: Sample | null; score: Score | null; error?: string }

const retrievalOf = (docsIndex: typeof index) => new Map(cases.map((c) => {
  const sections = helpSections(docsIndex, c.question);
  return [c.id, { ids: sections.map((s) => s.id), chars: sections.reduce((sum, s) => sum + s.markdown.length, 0), hit: c.section ? sections.some((s) => s.id === c.section) : null }];
}));
const retrieval = retrievalOf(index);
const retrievalByIndex = new Map([[index, retrieval], [beforeIndex, beforeIndex === index ? retrieval : retrievalOf(beforeIndex)]]);

// One job per run, case and arm, with the two arms of a question next to each other in time.
const jobs: (() => Promise<Row>)[] = [];
for (let run = 1; run <= runs; run++) {
  for (const c of cases) {
    for (const arm of ARMS) {
      jobs.push(async () => {
        try {
          const sample = await request(arm, c);
          return { caseId: c.id, arm, run, sample, score: score(c, sample) };
        } catch (error) {
          return { caseId: c.id, arm, run, sample: null, score: null, error: error instanceof Error ? error.message : String(error) };
        }
      });
    }
  }
}

console.log(`help-probe · ${endpoint} · model ${model} · ${cases.length} cases × ${ARMS.length} arms × ${runs} runs`);
const started = Date.now();
const rows = await pool(jobs, parallel);
console.log(`${rows.length} requests in ${((Date.now() - started) / 1000).toFixed(0)}s, ${rows.filter((r) => r.error).length} failed`);

/** The metrics of one arm over a set of cases, as printable cells. */
function summarize(arm: Arm, caseIds: ReadonlySet<string>) {
  const ran = rows.filter((r) => caseIds.has(r.caseId) && r.arm === arm);
  const scored = ran.filter((r) => r.score && r.sample);
  const scores = scored.map((r) => r.score as Score);
  // A failed run counts against every share.
  const n = ran.length;
  const share = (pick: (s: Score) => boolean) => pct(scores.filter(pick).length, n);
  const sum = (value: (s: Score) => number) => scores.reduce((total, s) => total + value(s), 0);
  return {
    n,
    facts: pct(sum((s) => s.facts), n),
    complete: share((s) => s.complete),
    bold: pct(sum((s) => s.bold), n),
    steps: share((s) => s.steps),
    declined: share((s) => s.declined),
    invented: mean(scores.map((s) => s.invented)).toFixed(2),
    empty: scores.filter((s) => s.empty).length,
    flagged: share((s) => s.flagged),
    first: pct(scores.filter((s) => s.first === true).length, scores.filter((s) => s.first !== null).length),
    tokens: `${Math.round(mean(scored.map((r) => r.sample?.promptTokens ?? 0)))}/${Math.round(mean(scored.map((r) => r.sample?.answerTokens ?? 0)))}`,
    // Session arms: the runs whose sources hold the expected section, then calls and requests per question.
    reached: pct(scored.filter((r) => { const want = caseById.get(r.caseId)?.section; return !!want && r.sample?.sources?.includes(want); }).length, n),
    calls: mean(scored.map((r) => r.sample?.calls?.length ?? 0)).toFixed(1),
    requests: mean(scored.map((r) => r.sample?.requests ?? 1)).toFixed(1),
    // Session arms: per request kind, the requests and the tokens in per question.
    kinds: REQUEST_KINDS.map((kind) => {
      const tallies = scored.map((r) => r.sample?.kinds?.[kind] ?? NO_TALLY);
      return `${kind} ${mean(tallies.map((t) => t.requests)).toFixed(1)}×${Math.round(mean(tallies.map((t) => t.promptTokens)))}`;
    }).join(' '),
    failed: n - scored.length,
  };
}
const caseById = new Map(cases.map((c) => [c.id, c]));

console.log('\ncase                     arm      hit  facts complete bold steps declined invented flagged  prompt/answer tok');
for (const c of cases) {
  for (const arm of ARMS) {
    const m = summarize(arm, new Set([c.id]));
    const hit = retrievalByIndex.get(indexOf(arm))?.get(c.id)?.hit;
    const sent = arm === 'no-docs' ? '   ' : hit === null ? ' –' : isSession(arm) ? m.reached : hit ? 'yes' : ' NO';
    console.log([
      c.id.padEnd(24), arm.padEnd(8), sent.padEnd(4),
      m.facts, m.complete.padStart(8), m.bold, m.steps.padStart(5), m.declined.padStart(8), m.invented.padStart(8), m.flagged.padStart(7), `  ${m.tokens}`,
      ...(isSession(arm) ? [`  ${m.calls} calls, ${m.requests} requests`] : []),
    ].join(' '));
  }
}

/** Totals for one arm over the cases a filter keeps. */
function totals(label: string, arm: Arm, keep: (c: HelpCase) => boolean) {
  const m = summarize(arm, new Set(cases.filter(keep).map((c) => c.id)));
  if (m.n === 0) return;
  console.log([
    `${label} · ${arm}`.padEnd(44), `n=${m.n}`.padEnd(6),
    `facts ${m.facts}`, `complete ${m.complete}`, `bold ${m.bold}`, `steps ${m.steps}`,
    `declined ${m.declined}`, `invented ${m.invented}`, `flagged ${m.flagged}`, `first ${m.first}`, `empty ${m.empty}`, `failed ${m.failed}`, `tok ${m.tokens}`,
    ...(isSession(arm) ? [`reached ${m.reached}`, `calls ${m.calls}`, `requests ${m.requests}`, `tok in by kind ${m.kinds}`] : []),
  ].join('  '));
}

const covered = (c: HelpCase) => c.section !== undefined;
const hit = (c: HelpCase) => retrieval.get(c.id)?.hit === true;
console.log('\nTOTALS');
for (const arm of ARMS) {
  totals('covered, all', arm, covered);
  totals('covered, docs wording', arm, (c) => covered(c) && c.wording === 'docs');
  totals('covered, player wording', arm, (c) => covered(c) && c.wording === 'player');
  totals('covered, right section sent', arm, (c) => covered(c) && hit(c));
  totals('covered, right section NOT sent', arm, (c) => covered(c) && !hit(c));
  totals('not covered', arm, (c) => !covered(c));
}
const coveredCases = cases.filter(covered);
console.log(`\nretrieval: right section sent for ${coveredCases.filter(hit).length}/${coveredCases.length} covered questions`
  + ` (docs wording ${coveredCases.filter((c) => c.wording === 'docs' && hit(c)).length}/${coveredCases.filter((c) => c.wording === 'docs').length},`
  + ` player wording ${coveredCases.filter((c) => c.wording === 'player' && hit(c)).length}/${coveredCases.filter((c) => c.wording === 'player').length})`);

if (show) {
  for (const row of rows.filter((r) => r.run === 1)) {
    console.log(`\n--- ${row.caseId} · ${row.arm} ---\n${row.error ?? row.sample?.answer}`);
  }
}

const outDir = path.join(BASELINE, 'runs');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `help-probe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(outFile, JSON.stringify({ endpoint, model, runs, retrieval: Object.fromEntries(retrieval), rows }, null, 2));
console.log(`\nraw answers: ${path.relative(process.cwd(), outFile)}`);
