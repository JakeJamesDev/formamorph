// Paired stat-name probe using the real request formatter, parser, and appliers over the relevance corpus.
// node testing/baseline/harness/stat-name-probe.mjs --runs 12 --endpoint https://api.lyonade.net/v1/chat/completions --model default
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const endpoint = option('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = option('--model', 'default');
const runs = Number(option('--runs', '12'));
const load = async (file) => {
  const result = await build({ entryPoints: [path.join(root, file)], bundle: true, format: 'esm', write: false,
    platform: 'node', logLevel: 'silent', alias: { '@': path.join(root, 'src') } });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};
const [names, changes, context, prompts, passes, plans, inputs, samplers] = await Promise.all([
  load('src/lib/statRequest.ts'), load('src/lib/statChanges.ts'), load('src/lib/statContext.ts'),
  load('src/components/game/GamePrompts.ts'), load('src/lib/turnPipeline/turnPasses.ts'),
  load('src/lib/turnPipeline/turnPlan.ts'), load('src/lib/turnPipeline/turnTestInputs.ts'), load('src/lib/promptSamplers.ts'),
]);
const corpus = JSON.parse(await readFile(path.join(root, 'testing/baseline/stat-relevance-cases.json'), 'utf8'));
const stats = corpus.stats.map((stat) => ({ ...stat, id: stat.name, type: 'number', regen: 0, descriptors: [],
  name: stat.name === 'Health' ? '=c=Health==' : stat.name === 'Vigor' ? '**Vigor**' : stat.name }));
const snapshot = names.createStatRequest(stats);
const cases = corpus.cases.filter((c) => ['injury', 'exertion', 'null-idle'].includes(c.name));
const pass = passes.TURN_PASSES.find((p) => p.id === 'statUpdates');
const input = inputs.testInput({ prompts: { ...inputs.TEST_PROMPTS,
  statUpdates: prompts.defaultStatUpdatesPrompt, statUpdatesUser: prompts.defaultStatUpdatesUserPrompt } });
const ctx = { '<WORLD DESCRIPTION>': corpus.world, '<TRAITS DESCRIPTION|markdown>': 'N/A', '<NOTES>': 'N/A',
  '<STATS DESCRIPTION|numbers.meaning.markdown>': context.buildStatContext(stats, { values: true, status: false, meaning: true }, 'markdown') };
const rows = [];
const started = Date.now();
const outDir = path.join(root, 'testing/baseline/runs');
await mkdir(outDir, { recursive: true });
const output = path.join(outDir, `stat-names-${started}.json`);

const reproduce = changes.applyAiStatChanges(stats, changes.parseStatUpdates('Health: -5').values);
if (reproduce.find((s) => s.id === 'Health').value !== stats.find((s) => s.id === 'Health').value) {
  throw new Error('The before arm no longer reproduces the reported name mismatch.');
}
console.log('Baseline reproduction: plain Health: -5 leaves colored Health unchanged.');
for (const c of cases) for (let run = 0; run < runs; run++) {
  for (const arm of run % 2 ? ['after', 'before'] : ['before', 'after']) {
    const material = { ...plans.emptyTurnMaterial({ action: '', effectiveAction: '', turnId: 'probe', baseCtx: ctx, destinations: [] }),
      ctx, narration: c.narration, ...(arm === 'after' ? { statRequest: snapshot } : {}) };
    const request = pass.buildRequest(input, material);
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60000), body: JSON.stringify({ model,
        messages: [{ role: 'system', content: request.systemPrompt }, ...request.messages],
        temperature: samplers.PROMPT_SAMPLER_PINS.statUpdates.temperature,
        reasoning_effort: 'none', seed: 1000 + run, max_tokens: 200, stream: false }) });
    if (!response.ok) throw new Error(`Probe request failed: HTTP ${response.status}`);
    const body = await response.json();
    const raw = body.choices?.[0]?.message?.content?.trim() ?? '';
    const parsed = changes.parseStatUpdates(raw);
    const after = arm === 'before'
      ? changes.applyAiStatChanges(changes.applyAiMaxChanges(stats, parsed.maxes), parsed.values)
      : names.applyStatResponse(stats, names.readStatResponse(raw, snapshot), new Set(stats.map((s) => s.id))).stats;
    const deltas = Object.fromEntries(after.map((s, i) => [s.id, s.value - stats[i].value]));
    const missed = Object.entries(c.expect).filter(([name, dir]) => dir === 'down' ? deltas[name] >= 0 : deltas[name] <= 0).length;
    const spurious = Object.entries(deltas).filter(([name, delta]) => delta && !(name in c.expect) && !c.allow.includes(name)).length;
    const unrecognized = names.readStatResponse(raw, snapshot).diagnostics.length;
    const row = { case: c.name, run, arm, raw, deltas, missed, spurious, unrecognized, clean: missed === 0 && spurious === 0 && unrecognized === 0 };
    rows.push(row);
    console.log(JSON.stringify(row));
    await writeFile(output, JSON.stringify({ endpoint, model, runs, rows }, null, 2));
  }
}
const totals = Object.fromEntries(['before', 'after'].map((arm) => {
  const selected = rows.filter((r) => r.arm === arm);
  return [arm, { count: selected.length, clean: selected.filter((r) => r.clean).length,
    missed: selected.reduce((n, r) => n + r.missed, 0), spurious: selected.reduce((n, r) => n + r.spurious, 0),
    unrecognized: selected.reduce((n, r) => n + r.unrecognized, 0) }];
}));
const pairs = rows.filter((r) => r.arm === 'after').map((r) => Number(r.clean) - Number(rows.find((b) => b.arm === 'before' && b.case === r.case && b.run === r.run).clean));
const difference = pairs.reduce((n, x) => n + x, 0) / pairs.length;
const margin = 1.96 * Math.sqrt(pairs.reduce((n, x) => n + (x - difference) ** 2, 0) / ((pairs.length - 1) * pairs.length));
const summary = { totals, cleanRateDifference: difference, approximatePaired95: [Math.max(-1, difference - margin), Math.min(1, difference + margin)], seconds: (Date.now() - started) / 1000 };
console.log(JSON.stringify(summary));
await writeFile(output, JSON.stringify({ endpoint, model, runs, rows, summary }, null, 2));
console.log(output);
