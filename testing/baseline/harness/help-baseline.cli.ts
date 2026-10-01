// Help baseline — how well does Formaquestion answer the fixed question set?
//
// The set is `help-baseline-cases.json`: task questions in a player's words for every docs page, "here"
// questions that need the open Surface, follow-up pairs, questions the guide does not cover, and questions
// with the AI Language set. Each question has keyed facts; `help-baseline-score.ts` scores by text match.
//
// Each question runs in every arm inside the same batch, so the endpoint's drift hits all of them:
//   retrieval  the app's help session as it ships: the Docs Index finds the sections, one request
//   lookup     with `--lookup`: the help session in lookup mode, on an endpoint that takes function calls
//   no-docs    the control: the same model, samplers, screen line and language, with no guide text
//
// A follow-up runs after its first question in the same arm and run, with that answer as the history.
// The request body comes from the app's AI Request Spec, so the sampler pins are the app's. The probe adds
// `reasoning_effort: "none"` and turns streaming off to read the token counts.
//
// The report, per arm and question kind:
//   grounded   every keyed fact, no forbidden name, and no general-knowledge flag
//   keys met   every keyed fact and no forbidden name, flag or no flag. On the control it is the share of
//              questions a model answers right with no guide, so it shows how far the keys can be guessed
//   wrong step the answer holds a forbidden name
//   invented   the answer holds a bold name that is nowhere in the docs
//   false flag a covered question, flagged as not from the guide
//   wrong, no flag  a covered question with an answer that is not grounded and has no flag to warn the player
//   sources    the right section is among the answer's sources
//   missed flag a question the guide does not cover, with no flag
// Then the worst questions of each docs arm with a first cause. Read the answers before you name a cause.
//
// Usage: npm run probe:help -- [--endpoint URL] [--model default] [--token T] [--runs 5] [--parallel 4]
//          [--lookup] [--only id,id] [--kinds task,here,followUp,language,uncovered] [--worst 10] [--show]
//          [--rescore FILE]  (scores a saved batch again with the keys as they are now; sends nothing)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildAiRequestSpec, type AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { GENERAL_KNOWLEDGE_MARKER, readMarker } from '@/lib/formaquestion/generalKnowledge';
import { helpSystemPrompt } from '@/lib/formaquestion/helpPrompt';
import { askHelp, HELP_MAX_TOKENS, type EarlierExchange } from '@/lib/formaquestion/helpSession';
import { surfaceHint } from '@/lib/formaquestion/surfaceHint';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { RequestMessage } from '@/types';
import { BASELINE_KINDS, loadBaselineCases, type BaselineCase } from './help-baseline-cases';
import { inLanguage, scoreAnswer, summarize, worstQuestions, type ScoredRow, type Summary } from './help-baseline-score';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const rescoreFile = argVal('--rescore', '');
const only = argVal('--only', '');
const kinds = argVal('--kinds', BASELINE_KINDS.join(',')).split(',');
const worstCount = Number(argVal('--worst', '10'));
const parallel = Number(argVal('--parallel', '4'));
const show = args.includes('--show');

type Arm = 'retrieval' | 'lookup' | 'no-docs';

interface Sample {
  /** The answer text, with the general-knowledge marker removed. */
  answer: string;
  flagged: boolean;
  /** The ids of the docs sections that reached the model. */
  sources: string[];
  /** Tokens in and out, summed over the requests of the question. */
  promptTokens: number;
  answerTokens: number;
  requests: number;
}
interface Row { caseId: string; arm: Arm; run: number; sample: Sample | null; error?: string }
interface Batch { endpoint: string; model: string; runs: number; arms: Arm[]; rows: Row[] }

const index = bundledDocsIndex();
const allCases = loadBaselineCases();
const caseById = new Map(allCases.map((c) => [c.id, c]));
const picked = allCases.filter((c) => kinds.includes(c.kind) && (!only || only.split(',').includes(c.id)));
// A follow-up needs its first question in the batch.
const cases = allCases.filter((c) => picked.includes(c) || picked.some((p) => p.after === c.id));
const allDocs = index.contents()
  .flatMap((page) => index.get(page.sections.map((section) => section.id)))
  .map((section) => section.markdown)
  .join('\n');

/** The control's prompt: the help prompt's role and answer rules, without the lines that need a guide. */
const NO_DOCS_SYSTEM_PROMPT = [
  'You are the help writer for Formamorph, a text adventure app. A player asks how to use the app.',
  '',
  '- When the player asks how to do a task, answer with every step of that task as a numbered list.',
  '- Write each control name in bold.',
  '- After the steps, add one or two sentences of detail when the player needs them.',
].join('\n');

function snapshotFor(endpoint: string, model: string, token: string, tools: boolean): AiSettingsSnapshot {
  return {
    resolveTarget: () => ({
      endpointId: 'probe', url: endpoint, apiToken: token, model, maxTokens: undefined, localEngine: false,
      samplerOverrides: defaultEndpointSamplerOverrides(),
      // The lookup arm says the endpoint takes function calls, so the help session picks lookup mode.
      reasoning: tools ? { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'probe' } } : UNKNOWN_REASONING_CAPABILITY,
    }),
    thinkingMode: 'off', reasoningEffort: 'auto', reasoningEngaged: false, promptReasoning: {},
    promptReasoningBudget: {}, promptSamplers: {}, promptMaxOutput: {},
    genTemperature: 0.9, genRepetitionPenalty: 1.1, genTopP: 0.95, genTopK: 40, genMinP: 0.05,
    paragraphLimit: 'none', disableThinking: false,
  };
}

interface Completion {
  choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function: { name: string; arguments: string } }[] }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}
interface Usage { promptTokens: number; answerTokens: number; requests: number }

/** Sends one request body with streaming off and reasoning off, and adds its token counts to `usage`. */
async function send(url: RequestInfo | URL, init: RequestInit | undefined, usage: Usage): Promise<Completion | Response> {
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  const response = await fetch(url, { ...init, body: JSON.stringify({ ...body, stream: false, reasoning_effort: 'none' }) });
  if (!response.ok) return response;
  const json = await response.json() as Completion;
  usage.requests++;
  usage.promptTokens += json.usage?.prompt_tokens ?? 0;
  usage.answerTokens += json.usage?.completion_tokens ?? 0;
  return json;
}

/** A fetch for the help session: each request goes out through `send` and comes back as the stream the session reads. */
function sessionFetch(usage: Usage): typeof fetch {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    const result = await send(url, init, usage);
    if (result instanceof Response) return result;
    const choice = result.choices?.[0];
    const frame = (delta: Record<string, unknown>, finish: string | null = null) =>
      `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finish }] })}\n\n`;
    const frames = [
      ...(choice?.message?.content ? [frame({ content: choice.message.content })] : []),
      ...(choice?.message?.tool_calls ?? []).map((call, at) => frame({ tool_calls: [{ index: at, id: call.id ?? `call-${at}`, type: 'function', function: call.function }] })),
      frame({}, choice?.finish_reason ?? 'stop'),
      'data: [DONE]\n\n',
    ];
    return new Response(frames.join(''), { headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof fetch;
}

interface Target { endpoint: string; model: string; token: string }

/** One question through the app's help session. */
async function askSession(target: Target, arm: Arm, c: BaselineCase, history: EarlierExchange[]): Promise<Sample> {
  const usage: Usage = { promptTokens: 0, answerTokens: 0, requests: 0 };
  const lookup = arm === 'lookup';
  const session = askHelp({
    question: c.question, history, language: c.language, surface: c.surface, index, lookup,
    snapshot: snapshotFor(target.endpoint, target.model, target.token, lookup), fetchImpl: sessionFetch(usage),
  });
  for await (const event of session) {
    if (event.type === 'done') return { answer: event.text, flagged: event.flagged, sources: event.sources.map((section) => section.id), ...usage };
  }
  throw new Error('the help session ended with no answer');
}

/** The control: the question with its history, its screen and its language, and no guide text. */
async function askNoDocs(target: Target, c: BaselineCase, history: EarlierExchange[]): Promise<Sample> {
  const usage: Usage = { promptTokens: 0, answerTokens: 0, requests: 0 };
  const where = surfaceHint(c.surface, index)?.where;
  const messages: RequestMessage[] = [
    ...history.flatMap((exchange): RequestMessage[] => [{ role: 'user', content: exchange.question }, { role: 'assistant', content: exchange.answer }]),
    { role: 'user', content: [...(where ? [`The player asks from this screen: ${where}.`] : []), `Question: ${c.question}`].join('\n\n') },
  ];
  const spec = buildAiRequestSpec(snapshotFor(target.endpoint, target.model, target.token, false), {
    systemPrompt: helpSystemPrompt(c.language ?? '', NO_DOCS_SYSTEM_PROMPT), messages, requestType: 'help', maxTokensOverride: HELP_MAX_TOKENS,
  });
  const result = await send(spec.url, { method: 'POST', headers: spec.headers, body: JSON.stringify(spec.body) }, usage);
  if (result instanceof Response) throw new Error(`HTTP ${result.status}: ${(await result.text()).slice(0, 200)}`);
  const answer = readMarker(result.choices?.[0]?.message?.content ?? '', { final: true }).text;
  if (!answer) throw new Error('the model sent an empty answer');
  // No section reached the model, so the app would flag every answer of this arm.
  return { answer, flagged: true, sources: [], ...usage };
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

async function runBatch(): Promise<Batch> {
  const target: Target = {
    endpoint: argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions'),
    model: argVal('--model', 'default'),
    token: argVal('--token', process.env.PROBE_TOKEN ?? ''),
  };
  const runs = Number(argVal('--runs', '5'));
  const arms: Arm[] = ['retrieval', ...(args.includes('--lookup') ? ['lookup' as const] : []), 'no-docs'];
  const ask = (arm: Arm, c: BaselineCase, history: EarlierExchange[]) =>
    (arm === 'no-docs' ? askNoDocs(target, c, history) : askSession(target, arm, c, history));

  /** One question, sent once more after a failed request. */
  async function row(arm: Arm, c: BaselineCase, run: number, history: EarlierExchange[]): Promise<Row> {
    for (let attempt = 1; ; attempt++) {
      try {
        return { caseId: c.id, arm, run, sample: await ask(arm, c, history) };
      } catch (error) {
        if (attempt === 2) return { caseId: c.id, arm, run, sample: null, error: error instanceof Error ? error.message : String(error) };
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  // One job per run, question and arm, with the arms of a question next to each other in time.
  const jobs: (() => Promise<Row[]>)[] = [];
  for (let run = 1; run <= runs; run++) {
    for (const c of cases.filter((first) => first.kind !== 'followUp')) {
      for (const arm of arms) {
        jobs.push(async () => {
          const first = await row(arm, c, run, []);
          const followUps = cases.filter((next) => next.after === c.id);
          if (followUps.length === 0) return [first];
          if (!first.sample) return [first, ...followUps.map((next): Row => ({ caseId: next.id, arm, run, sample: null, error: `the first question failed: ${first.error}` }))];
          // The control keeps the marker off its history, as its answers never carry one.
          const history = [{ question: c.question, answer: first.sample.answer, flagged: arm !== 'no-docs' && first.sample.flagged }];
          const rest: Row[] = [];
          for (const next of followUps) rest.push(await row(arm, next, run, history));
          return [first, ...rest];
        });
      }
    }
  }

  console.log(`help-baseline · ${target.endpoint} · model ${target.model} · ${cases.length} questions × ${arms.length} arms × ${runs} runs`);
  const started = Date.now();
  const rows = (await pool(jobs, parallel)).flat();
  console.log(`${rows.length} answers in ${((Date.now() - started) / 1000).toFixed(0)}s, ${rows.filter((r) => r.error).length} failed`);
  return { endpoint: target.endpoint, model: target.model, runs, arms, rows };
}

const batch = rescoreFile ? JSON.parse(readFileSync(rescoreFile, 'utf8')) as Batch : await runBatch();

const scored: ScoredRow[] = batch.rows.flatMap((r) => {
  const c = caseById.get(r.caseId);
  if (!c || !r.sample || !picked.includes(c)) return [];
  return [{
    caseId: c.id,
    kind: c.kind === 'language' ? (c.asked ? 'language, asked in it' : 'language, setting only') : c.kind,
    arm: r.arm,
    run: r.run,
    score: scoreAnswer(c, { text: r.sample.answer, flagged: r.sample.flagged, sources: r.sample.sources }, allDocs),
    promptTokens: r.sample.promptTokens,
    answerTokens: r.sample.answerTokens,
    ...(c.language && { inLanguage: inLanguage(c.language, r.sample.answer) }),
  }];
});

const pct = (value: number | null) => (value === null ? '–' : `${Math.round(value * 100)}%`);
const table = (head: string[], lines: string[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...lines.map((cells) => `| ${cells.join(' | ')} |`)].join('\n');
const KIND_LABELS: Record<string, string> = {
  task: 'Task', here: 'Here', followUp: 'Follow-up', 'language, setting only': 'Language, setting only',
  'language, asked in it': 'Language, asked in it', uncovered: 'Not covered',
};
// The control gets no section, so its flag and its sources are fixed; those cells stay empty.
const summaryCells = (s: Summary, arm: Arm) => {
  const session = (value: number | null) => (arm === 'no-docs' ? '–' : pct(value));
  return [
    String(s.covered + s.uncovered), session(s.groundedCorrect), pct(s.keysMet), pct(s.wrongStep), pct(s.invented), session(s.falseFlag),
    session(s.wrongNoFlag), session(s.sourceAccuracy), session(s.missedFlag), pct(s.inLanguage), s.promptTokens === null ? '–' : `${s.promptTokens} / ${s.answerTokens}`,
  ];
};

const report: string[] = [];
const failed = batch.rows.filter((r) => r.error);
report.push(`# Help baseline\n\n${batch.endpoint} · model \`${batch.model}\` · ${batch.runs} runs per arm · ${scored.length} answers scored, ${failed.length} failed`);
for (const arm of batch.arms) {
  const ofArm = scored.filter((r) => r.arm === arm);
  const kindRows = Object.keys(KIND_LABELS).filter((kind) => ofArm.some((r) => r.kind === kind));
  report.push(`## Arm: ${arm}\n\n${table(
    ['Questions', 'Answers', 'Grounded-correct', 'Keys met', 'Wrong step', 'Invented name', 'False flag', 'Wrong, no flag', 'Right source', 'Missed flag', 'In language', 'Tokens in / out'],
    [
      ...kindRows.map((kind) => [KIND_LABELS[kind], ...summaryCells(summarize(ofArm.filter((r) => r.kind === kind)), arm)]),
      ['**All**', ...summaryCells(summarize(ofArm), arm)],
    ],
  )}`);
}
for (const arm of batch.arms.filter((a) => a !== 'no-docs')) {
  const failing = worstQuestions(scored.filter((r) => r.arm === arm), Infinity);
  const worst = failing.slice(0, worstCount);
  const causes = (['search miss', 'docs gap', 'model error'] as const).map((cause) => `${cause} ${failing.filter((q) => q.likelyCause === cause).length}`);
  if (worst.length > 0) report.push(`## Worst questions: ${arm}\n\n${failing.length} questions have a failed run. First cause: ${causes.join(', ')}.\n\n${table(
    ['Question', 'Correct', 'Facts', 'Right source', 'Flagged', 'Wrong step', 'First cause', 'Asked'],
    worst.map((q) => [q.caseId, pct(q.correct), pct(q.factShare), pct(q.sourced), pct(q.flagged), pct(q.wrongStep), q.likelyCause, caseById.get(q.caseId)?.question ?? '']),
  )}`);
}
const text = report.join('\n\n');
console.log(`\n${text}`);

if (failed.length > 0) {
  console.log('\nfailed:');
  for (const r of failed.slice(0, 20)) console.log(`  ${r.caseId} · ${r.arm} · run ${r.run}: ${r.error}`);
}
if (show) {
  for (const r of batch.rows.filter((row) => row.run === 1 && picked.some((c) => c.id === row.caseId))) {
    console.log(`\n--- ${r.caseId} · ${r.arm} ---\n${r.error ?? `${r.sample?.flagged ? `${GENERAL_KNOWLEDGE_MARKER}\n` : ''}${r.sample?.answer}`}`);
  }
}

if (!rescoreFile) {
  const outDir = path.resolve('testing/baseline/runs');
  mkdirSync(outDir, { recursive: true });
  const stem = path.join(outDir, `help-baseline-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  writeFileSync(`${stem}.json`, JSON.stringify(batch, null, 2));
  writeFileSync(`${stem}.md`, `${text}\n`);
  console.log(`\nraw answers: ${path.relative(process.cwd(), `${stem}.json`)}\nreport: ${path.relative(process.cwd(), `${stem}.md`)}`);
}
