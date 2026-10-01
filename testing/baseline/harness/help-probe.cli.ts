// Help probe — does the Formaquestion help prompt answer from the docs sections it is given?
//
// Each question runs in two arms inside the same batch, so the endpoint's drift hits both:
//   docs     the app's own request: the help prompt, plus the sections the Docs Index finds for the question
//   no-docs  the control: the same model and samplers, the question alone, no guide text
//   alt      with `--alt FILE`: the docs arm with the system prompt from FILE, to compare two wordings
//
// The request body comes from the app's AI Request Spec, so the sampler pins are the app's. The probe adds
// `reasoning_effort: "none"` and turns streaming off to read the token counts.
//
// Checks, all by text match, none by a model:
//   retrieval   the expected section is among the sections sent (docs arm; the same for every run)
//   facts       share of the keyed control names in the answer; `complete` = all of them
//   bold        share of the keyed names written in bold, as the guide writes them
//   steps       the answer has a numbered list
//   declined    the answer says the guide does not cover the question. Wanted on a case with no section,
//               and a fault on a covered case
//   invented    bold names in the answer that are nowhere in the docs
//
// Usage: npx vite-node testing/baseline/harness/help-probe.cli.ts --
//          [--endpoint URL] [--model default] [--token T] [--runs 5] [--only backup-docs,regen-player]
//          [--parallel 4] [--alt FILE] [--show]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildAiRequestSpec, type AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { HELP_SYSTEM_PROMPT, helpUserMessage } from '@/lib/formaquestion/helpPrompt';
import { HELP_MAX_TOKENS, helpSections } from '@/lib/formaquestion/helpSession';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';

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

interface HelpCase {
  id: string;
  wording: 'docs' | 'player';
  question: string;
  /** The section a correct answer comes from. Absent on a question the guide does not cover. */
  section?: string;
  facts: string[];
}
type Arm = 'docs' | 'no-docs' | 'alt';
const ARMS: Arm[] = altFile ? ['docs', 'alt', 'no-docs'] : ['docs', 'no-docs'];
const ALT_SYSTEM_PROMPT = altFile ? readFileSync(altFile, 'utf8').trim() : '';

const BASELINE = path.resolve('testing/baseline');
const allCases = (JSON.parse(readFileSync(path.join(BASELINE, 'help-cases.json'), 'utf8')) as { cases: HelpCase[] }).cases;
const cases = only ? allCases.filter((c) => only.split(',').includes(c.id)) : allCases;

const index = bundledDocsIndex();
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

const snapshot: AiSettingsSnapshot = {
  resolveTarget: () => ({
    endpointId: 'probe', url: endpoint, apiToken: token, model, maxTokens: undefined, localEngine: false,
    samplerOverrides: defaultEndpointSamplerOverrides(), reasoning: UNKNOWN_REASONING_CAPABILITY,
  }),
  thinkingMode: 'off', reasoningEffort: 'auto', reasoningEngaged: false, promptReasoning: {},
  promptReasoningBudget: {}, promptSamplers: {}, promptMaxOutput: {},
  genTemperature: 0.9, genRepetitionPenalty: 1.1, genTopP: 0.95, genTopK: 40, genMinP: 0.05,
  paragraphLimit: 'none', disableThinking: false,
};

interface Sample {
  answer: string;
  promptTokens: number | null;
  answerTokens: number | null;
  finish: string | null;
}

async function request(arm: Arm, c: HelpCase): Promise<Sample> {
  const sections = helpSections(index, c.question);
  const spec = buildAiRequestSpec(snapshot, arm !== 'no-docs'
    ? { systemPrompt: arm === 'alt' ? ALT_SYSTEM_PROMPT : HELP_SYSTEM_PROMPT, messages: [{ role: 'user', content: helpUserMessage(c.question, sections) }], requestType: 'help', maxTokensOverride: HELP_MAX_TOKENS }
    : { systemPrompt: NO_DOCS_SYSTEM_PROMPT, messages: [{ role: 'user', content: `Question: ${c.question}` }], requestType: 'help', maxTokensOverride: HELP_MAX_TOKENS });
  const response = await fetch(spec.url, {
    method: 'POST',
    headers: spec.headers,
    body: JSON.stringify({ ...spec.body, stream: false, reasoning_effort: 'none' }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const json = await response.json() as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    answer: json.choices?.[0]?.message?.content ?? '',
    promptTokens: json.usage?.prompt_tokens ?? null,
    answerTokens: json.usage?.completion_tokens ?? null,
    finish: json.choices?.[0]?.finish_reason ?? null,
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
}

function score(c: HelpCase, answer: string): Score {
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

const retrieval = new Map(cases.map((c) => {
  const sections = helpSections(index, c.question);
  return [c.id, { ids: sections.map((s) => s.id), chars: sections.reduce((sum, s) => sum + s.markdown.length, 0), hit: c.section ? sections.some((s) => s.id === c.section) : null }];
}));

// One job per run, case and arm, with the two arms of a question next to each other in time.
const jobs: (() => Promise<Row>)[] = [];
for (let run = 1; run <= runs; run++) {
  for (const c of cases) {
    for (const arm of ARMS) {
      jobs.push(async () => {
        try {
          const sample = await request(arm, c);
          return { caseId: c.id, arm, run, sample, score: score(c, sample.answer) };
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

const pct = (n: number, d: number) => (d === 0 ? '  –' : `${Math.round((100 * n) / d).toString().padStart(3)}%`);
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** The metrics of one arm over a set of cases, as printable cells. */
function summarize(arm: Arm, caseIds: ReadonlySet<string>) {
  const scored = rows.filter((r) => caseIds.has(r.caseId) && r.arm === arm && r.score && r.sample);
  const scores = scored.map((r) => r.score as Score);
  const n = scores.length;
  const share = (pick: (s: Score) => boolean) => pct(scores.filter(pick).length, n);
  return {
    n,
    facts: pct(mean(scores.map((s) => s.facts)) * n, n),
    complete: share((s) => s.complete),
    bold: pct(mean(scores.map((s) => s.bold)) * n, n),
    steps: share((s) => s.steps),
    declined: share((s) => s.declined),
    invented: mean(scores.map((s) => s.invented)).toFixed(2),
    empty: scores.filter((s) => s.empty).length,
    tokens: `${Math.round(mean(scored.map((r) => r.sample?.promptTokens ?? 0)))}/${Math.round(mean(scored.map((r) => r.sample?.answerTokens ?? 0)))}`,
  };
}

console.log('\ncase                     arm      hit  facts complete bold steps declined invented  prompt/answer tok');
for (const c of cases) {
  for (const arm of ARMS) {
    const m = summarize(arm, new Set([c.id]));
    const hit = retrieval.get(c.id)?.hit;
    console.log([
      c.id.padEnd(24), arm.padEnd(8), (arm !== 'no-docs' ? (hit === null ? ' –' : hit ? 'yes' : ' NO') : '   ').padEnd(4),
      m.facts, m.complete.padStart(8), m.bold, m.steps.padStart(5), m.declined.padStart(8), m.invented.padStart(8), `  ${m.tokens}`,
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
    `declined ${m.declined}`, `invented ${m.invented}`, `empty ${m.empty}`, `tok ${m.tokens}`,
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
