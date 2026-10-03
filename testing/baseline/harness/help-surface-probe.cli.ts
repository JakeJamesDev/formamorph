// Surface-hint probe: does naming the open screen and holding its mapped section help a "here" question?
//
// Each question runs in two arms inside the same batch, so the endpoint's drift hits both:
//   hint      the app's help session with the Surface the player has open
//   no-hint   the same session with no Surface
//
// Checks, by text match: `facts` is the share of the keyed control names in the answer, `complete` is all of
// them, `steps` is a numbered list, `reached` is the mapped section among the answer's sources.
//
// Usage: npx vite-node testing/baseline/harness/help-surface-probe.cli.ts --
//          [--endpoint URL] [--model default] [--token T] [--runs 8] [--parallel 4] [--show]
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { askHelp } from '@/lib/formaquestion/helpSession';
import { DEFAULT_HELP_SETTINGS } from '@/lib/formaquestion/helpSettings';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { factShare, mean, pct, probeSnapshot } from './help-probe-shared';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const token = argVal('--token', process.env.PROBE_TOKEN ?? '');
const runs = Number(argVal('--runs', '8'));
const parallel = Number(argVal('--parallel', '4'));
const show = args.includes('--show');

interface Case {
  id: string;
  question: string;
  surface: Surface;
  /** The section a correct answer comes from. */
  section: string;
  facts: string[];
}
const open = (screen: SurfaceId, dialog: SurfaceId | null, ...tabs: SurfaceId[]): Surface => ({ screen, dialog, tabs });
const cases: Case[] = [
  { id: 'display-tab', question: 'What does this tab do?', surface: open('mainMenu', 'settings', 'settings.display'), section: 'Settings#display', facts: ['Theme', 'Font', 'Background Music'] },
  { id: 'endpoints-tab', question: 'What is on this tab?', surface: open('mainMenu', 'settings', 'settings.endpoints'), section: 'Settings#endpoints', facts: ['Text', 'Image', 'Demo AI'] },
  { id: 'library-here', question: 'What can I do here?', surface: open('mainMenu', null, 'mainMenu.worlds'), section: 'Library#the-library-tabs', facts: ['Worlds', 'Entities', 'Dictionaries', 'Avatars'] },
  { id: 'prompt-options', question: 'What are these tabs for?', surface: open('mainMenu', 'settings', 'settings.prompts', 'settingsPromptSurfaces.options'), section: 'Prompts#the-surfaces-of-a-prompt', facts: ['Anatomy', 'System Prompt', 'User Message', 'Options'] },
  { id: 'bench-triggers', question: 'How do I use this?', surface: open('worldEditor' as SurfaceId, null, 'worldEditorBench.triggers'), section: 'Test-Bench#triggers', facts: ['Entities Present', 'Dictionary', 'Rendered Context', 'History'] },
];

const index = bundledDocsIndex();
const snapshot = probeSnapshot({ endpoint, model, token });

type Arm = 'hint' | 'no-hint';
const ARMS: Arm[] = ['hint', 'no-hint'];

interface Sample { answer: string; sources: string[]; promptTokens: number }

/** One question through the app's help session. Each request goes out with streaming off, to read the token count. */
async function run(arm: Arm, c: Case): Promise<Sample> {
  let promptTokens = 0;
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    const response = await fetch(url, { ...init, body: JSON.stringify({ ...body, stream: false, reasoning_effort: 'none' }) });
    if (!response.ok) return response;
    const json = await response.json() as { choices?: { message?: { content?: string | null }; finish_reason?: string }[]; usage?: { prompt_tokens?: number } };
    promptTokens += json.usage?.prompt_tokens ?? 0;
    const frame = (delta: Record<string, unknown>, finish: string | null = null) => `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finish }] })}\n\n`;
    const content = json.choices?.[0]?.message?.content;
    return new Response([...(content ? [frame({ content })] : []), frame({}, json.choices?.[0]?.finish_reason ?? 'stop'), 'data: [DONE]\n\n'].join(''), { headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof fetch;
  let answer = '';
  let sources: string[] = [];
  for await (const event of askHelp({ question: c.question, settings: DEFAULT_HELP_SETTINGS, snapshot, index, fetchImpl, ...(arm === 'hint' && { surface: c.surface }) })) {
    if (event.type !== 'done') continue;
    answer = event.text;
    sources = event.sources.map((section) => section.id);
  }
  return { answer, sources, promptTokens };
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

interface Row { c: Case; arm: Arm; run: number; sample: Sample | null; error?: string }
const jobs: (() => Promise<Row>)[] = [];
for (let n = 1; n <= runs; n++) {
  for (const c of cases) {
    for (const arm of ARMS) {
      jobs.push(async () => {
        try {
          return { c, arm, run: n, sample: await run(arm, c) };
        } catch (error) {
          return { c, arm, run: n, sample: null, error: error instanceof Error ? error.message : String(error) };
        }
      });
    }
  }
}

console.log(`help-surface-probe · ${endpoint} · model ${model} · ${cases.length} cases × ${ARMS.length} arms × ${runs} runs`);
const rows = await pool(jobs, parallel);
console.log(`${rows.length} requests, ${rows.filter((r) => r.error).length} failed`);

function summarize(arm: Arm, ids: ReadonlySet<string>) {
  const ok = rows.filter((r) => ids.has(r.c.id) && r.arm === arm && r.sample);
  const lower = (r: Row) => r.sample!.answer.toLowerCase();
  const share = mean(ok.map((r) => factShare(r.c.facts, r.sample!.answer)));
  return {
    n: ok.length,
    facts: pct(share * ok.length, ok.length),
    complete: pct(ok.filter((r) => r.c.facts.every((f) => lower(r).includes(f.toLowerCase()))).length, ok.length),
    reached: pct(ok.filter((r) => r.sample!.sources.includes(r.c.section)).length, ok.length),
    tokens: Math.round(ok.reduce((sum, r) => sum + r.sample!.promptTokens, 0) / Math.max(1, ok.length)),
  };
}

console.log('\ncase             arm      n  facts complete reached  prompt tok');
for (const c of cases) {
  for (const arm of ARMS) {
    const m = summarize(arm, new Set([c.id]));
    console.log(`${c.id.padEnd(16)} ${arm.padEnd(8)} ${String(m.n).padStart(2)} ${m.facts} ${m.complete.padStart(8)} ${m.reached.padStart(7)}  ${m.tokens}`);
  }
}
console.log('\nTOTALS');
for (const arm of ARMS) {
  const m = summarize(arm, new Set(cases.map((c) => c.id)));
  console.log(`${arm.padEnd(8)} n=${m.n}  facts ${m.facts}  complete ${m.complete}  reached ${m.reached}  tok ${m.tokens}`);
}
if (show) for (const r of rows.filter((x) => x.run === 1)) console.log(`\n--- ${r.c.id} · ${r.arm}\n${r.sample?.answer ?? r.error}`);
