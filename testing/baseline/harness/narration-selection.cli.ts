// Run with vite-node; append --run for the paired local-model experiment.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { createSelectionWorld, SELECTION_CASES, SELECTION_DESCRIPTIONS, INCLUSION_DESCRIPTION, RETRIEVAL_FIRST_DESCRIPTION, APPEARANCE_DESCRIPTION } from './narration-selection-fixture';
import { createProbeTransport, LM_STUDIO_PROBE_ENDPOINT, prepareNarrationToolCallCase, runNarrationToolCallTrial, type ProbeTrialEvidence } from './narration-tool-call-probe';

const args = process.argv.slice(2);
if (new Set(args).size !== args.length || args.some((arg) => !['--run', '--include', '--retrieve-first', '--appearance'].includes(arg)) || args.filter((arg) => arg !== '--run').length > 1) throw new Error('Use [--include | --retrieve-first | --appearance] [--run].');
const live = args.includes('--run');
const inclusion = args.includes('--include');
const retrievalFirst = args.includes('--retrieve-first');
const appearance = args.includes('--appearance');
const descriptions = { ...SELECTION_DESCRIPTIONS, ...(inclusion ? { B: INCLUSION_DESCRIPTION } : {}), ...(retrievalFirst ? { A: INCLUSION_DESCRIPTION, B: RETRIEVAL_FIRST_DESCRIPTION } : {}), ...(appearance ? { A: RETRIEVAL_FIRST_DESCRIPTION, B: APPEARANCE_DESCRIPTION } : {}) };
const cachedArm = retrievalFirst || appearance ? 'B' : 'A';
const cachedBaselinePath = appearance ? 'testing/baseline/runs/narration-tool-call-probe/selection-retrieve-first-batch-2026-09-23T04-11-20-893Z.json' : retrievalFirst ? 'testing/baseline/runs/narration-tool-call-probe/selection-include-batch-2026-09-23T03-53-24-862Z.json' : inclusion ? 'testing/baseline/runs/narration-tool-call-probe/selection-scope-batch-2026-09-22T20-47-19-042Z.json' : null;
const cached = cachedBaselinePath ? JSON.parse(readFileSync(cachedBaselinePath, 'utf8')) as { modelMetadata: unknown; trials: Array<{ arm: string; scenario: string; seed: number; trial: ProbeTrialEvidence }> } : null;
const model = 'g4-meromero-v2-31b-i1';
const previous = JSON.parse(readFileSync('testing/baseline/runs/narration-tool-call-probe/experimental-entity-full-batch-2026-09-22T20-20-39-880Z.json', 'utf8')) as { modelMetadata: unknown; pairs: Array<{ prepared: { tools: Array<{ function: { description: string } }> } }> };
if (previous.pairs[0].prepared.tools[0].function.description !== SELECTION_DESCRIPTIONS.A) throw new Error('Control description drifted.');
const sourceRevision = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const world = createSelectionWorld();
const seeds = [424243, 424244];
const jobs = seeds.flatMap((seed, si) => SELECTION_CASES.flatMap((scenario, ci) =>
  ((si + ci) % 2 ? ['B', 'A'] as const : ['A', 'B'] as const).map((arm) => ({
    arm, scenario: scenario.id, seed,
    input: { caseId: `${scenario.id}-${seed}-${arm}`, action: scenario.action, world, sourceRevision, model, seed,
      nineCharacterCallIds: true, requestTimeoutMs: 180_000, promptMode: 'experimental' as const,
      experiment: { thinking: true, roleOnly: true, outputMode: 'text' as const, summaryLabel: true,
        entityDefinition: true, sectionDefinitions: true, entityHeader: true, requestInfoName: 'get_entity' as const,
        requestInfoParameter: 'name' as const, requestInfoDescription: descriptions[arm] } },
  }))));
const prepared = jobs.map(({ input }) => prepareNarrationToolCallCase(input).request);
for (let i = 0; i < prepared.length; i += 2) {
  const pair = prepared.slice(i, i + 2).map((request) => {
    const copy = structuredClone(request);
    copy.tools[0].function.description = '';
    return copy;
  });
  if (!isDeepStrictEqual(pair[0], pair[1])) throw new Error('Pair differs outside lookup description.');
}
for (const [index, job] of jobs.entries()) {
  if (!cached || job.arm !== 'A') continue;
  const matches = cached.trials.filter((item) => item.arm === cachedArm && item.scenario === job.scenario && item.seed === job.seed);
  if (matches.length !== 1 || !isDeepStrictEqual(matches[0].trial.initialRequest, prepared[index])) throw new Error('Cached control request drifted.');
}
const path = `testing/baseline/runs/narration-tool-call-probe/selection-${appearance ? 'appearance' : retrievalFirst ? 'retrieve-first' : inclusion ? 'include' : 'scope'}-${live ? 'batch' : 'preparation'}-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`;
const trials: Array<{ arm: string; scenario: string; seed: number; trial: ProbeTrialEvidence }> = [];
let modelMetadata: unknown = null;
const started = performance.now();
const save = () => writeFileSync(path, JSON.stringify({ sourceRevision, model, modelMetadata, world,
  descriptions, cachedBaselinePath, cachedArm, cases: SELECTION_CASES, seeds, prepared, plannedTrials: jobs.length, plannedLiveTrials: cached ? jobs.length / 2 : jobs.length,
  durationMs: performance.now() - started, trials }, null, 2) + '\n');
if (live) {
  const response = await fetch('http://127.0.0.1:1234/api/v1/models', { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Inventory HTTP ${response.status}`);
  const inventory = await response.json() as { models: Array<{ loaded_instances: Array<{ id: string }> }> };
  modelMetadata = inventory.models.find((item) => item.loaded_instances.some(({ id }) => id === model));
  if (!modelMetadata || !isDeepStrictEqual(modelMetadata, previous.modelMetadata)) throw new Error('Loaded model metadata differs from the previous experiment.');
  if (cached && !isDeepStrictEqual(modelMetadata, cached.modelMetadata)) throw new Error('Cached model metadata differs.');
  const transport = createProbeTransport({ endpoint: LM_STUDIO_PROBE_ENDPOINT });
  save();
  for (const [index, job] of jobs.entries()) {
    const cachedTrial = cached && job.arm === 'A' ? cached.trials.find((item) => item.arm === cachedArm && item.scenario === job.scenario && item.seed === job.seed)?.trial : undefined;
    const trial = cachedTrial ?? await runNarrationToolCallTrial({ ...job.input, transport });
    if (!isDeepStrictEqual(trial.initialRequest, prepared[index])) throw new Error('Actual request differs from preparation.');
    trials.push({ arm: job.arm, scenario: job.scenario, seed: job.seed, trial });
    save();
    console.log(`${trials.length}/${jobs.length} ${job.input.caseId}${cachedTrial ? ' [cached]' : ''}: ${trial.status}, lookups=${trial.lookupCount}, ${(trial.durationMs / 1000).toFixed(1)}s`);
    if (['endpoint_rejection', 'transport_error', 'request_timeout'].includes(trial.failure?.kind ?? '')) break;
  }
}
save();
console.log(path);
