// Use vite-node with a saved description batch; append --run to perform inference.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { migrateWorld } from '@/lib/version';
import { createProbeTransport, LM_STUDIO_PROBE_ENDPOINT, prepareNarrationToolCallCase,
  runNarrationToolCallTrial, type ProbeTrialEvidence } from './narration-tool-call-probe';

const [baselinePath, flag] = process.argv.slice(2);
if (!baselinePath || (flag && flag !== '--run') || process.argv.slice(2).length > 2) {
  throw new Error('Use <saved-description-batch.json> [--run].');
}
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
  model: string; description: string; modelMetadata: unknown;
  cases: Array<{ id: string; action: string; known: string[]; required: string[] }>;
  trials: Array<{ arm: string; scenario: string; seed: number; trial: ProbeTrialEvidence }>;
};
const seeds = [424243, 424244];
const world = migrateWorld(JSON.parse(readFileSync('testing/baseline/sedge-landing.json', 'utf8')));
const sourceRevision = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const jobs = seeds.flatMap((seed) => baseline.cases.map((scenario) => {
  const cached = baseline.trials.filter((item) => item.arm === 'B' && item.seed === seed && item.scenario === scenario.id);
  if (cached.length !== 1) throw new Error(`Expected one cached baseline: ${scenario.id}/${seed}`);
  const input = { caseId: `${scenario.id}-${seed}-experimental`, action: scenario.action, world, sourceRevision,
    model: baseline.model, seed, nineCharacterCallIds: true, requestTimeoutMs: 180_000,
    experiment: { thinking: true, knownEntityNames: scenario.known, requestInfoDescription: baseline.description } };
  const original = prepareNarrationToolCallCase(input).request;
  if (!isDeepStrictEqual(original, cached[0].trial.initialRequest)) throw new Error('Cached baseline request drifted.');
  const experimental = prepareNarrationToolCallCase({ ...input, promptMode: 'experimental' }).request;
  const normalized = structuredClone(experimental);
  normalized.messages[0] = original.messages[0];
  normalized.messages[1] = original.messages[1];
  if (!isDeepStrictEqual(normalized, original)) throw new Error('Non-prompt controls differ.');
  return { input, scenario: scenario.id, required: scenario.required, baseline: cached[0].trial, prepared: experimental };
}));
const path = `testing/baseline/runs/narration-tool-call-probe/experimental-${flag ? 'batch' : 'preparation'}-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`;
const trials: Array<{ scenario: string; seed: number; trial: ProbeTrialEvidence }> = [];
const started = performance.now();
let modelMetadata: unknown = null;
const save = () => writeFileSync(path, `${JSON.stringify({ baselinePath, sourceRevision, model: baseline.model,
  seeds, cases: baseline.cases, plannedTrials: jobs.length, modelMetadata, durationMs: performance.now() - started,
  pairs: jobs.map(({ input, ...rest }) => ({ seed: input.seed, ...rest })), trials }, null, 2)}\n`);
if (flag) {
  const response = await fetch('http://127.0.0.1:1234/api/v1/models', { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Inventory HTTP ${response.status}`);
  const inventory = await response.json() as { models: Array<{ loaded_instances: Array<{ id: string }> }> };
  modelMetadata = inventory.models.find((item) => item.loaded_instances.some(({ id }) => id === baseline.model));
  if (!modelMetadata) throw new Error(`Model is not loaded: ${baseline.model}`);
  if (!isDeepStrictEqual(modelMetadata, baseline.modelMetadata)) throw new Error('Model metadata changed; cached comparison needs review.');
  const transport = createProbeTransport({ endpoint: LM_STUDIO_PROBE_ENDPOINT });
  save();
  for (const job of jobs) {
    const trial = await runNarrationToolCallTrial({ ...job.input, promptMode: 'experimental', transport });
    trials.push({ scenario: job.scenario, seed: job.input.seed, trial });
    save();
    console.log(`${trials.length}/${jobs.length} ${trial.caseId}: ${trial.status}, lookups=${trial.lookupCount}, ${(trial.durationMs / 1000).toFixed(1)}s`);
    if (['endpoint_rejection', 'transport_error', 'request_timeout'].includes(trial.failure?.kind ?? '')) break;
  }
}
save();
console.log(path);
