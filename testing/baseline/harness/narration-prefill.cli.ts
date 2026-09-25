// Reasoning-prefill × entity-order study on the selection fixture. Run with vite-node; append --run for inference.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { createSelectionWorld, INCLUSION_DESCRIPTION, SELECTION_CASES } from './narration-selection-fixture';
import { createProbeTransport, LM_STUDIO_PROBE_ENDPOINT, prepareNarrationToolCallCase, runNarrationToolCallTrial, type ProbeTrialEvidence } from './narration-tool-call-probe';

// Gemma 4 opens thinking with this token (model chat_template.jinja).
const CHANNEL_OPEN = '<|channel>thought\n';
export const PREFILLS = {
  question: 'Before planning the scene, which entities does this action involve, and which of their full entries do I need?',
  intent: 'First, I will identify the entities this action involves and retrieve their full entries before planning the scene.',
} as const;
const ARMS = ['control', ...Object.keys(PREFILLS)] as Array<'control' | keyof typeof PREFILLS>;
const ORDERS = ['forward', 'reversed'] as const;

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--run')) throw new Error('Use [--run].');
const live = args.includes('--run');
const model = 'g4-meromero-v2-31b-i1';
const sourceRevision = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const worlds = { forward: createSelectionWorld(), reversed: createSelectionWorld() };
// Rendered entity sections follow world.entities order.
worlds.reversed.entities.reverse();
const entityOrder = Object.fromEntries(ORDERS.map((order) => [order,
  worlds[order].entities.filter((entity) => entity.locations?.includes('loc-sedge')).map((entity) => entity.name)]));
const seeds = [424243, 424244];
const jobs = seeds.flatMap((seed) => ORDERS.flatMap((order) => SELECTION_CASES.flatMap((scenario) => ARMS.map((arm) => ({
  arm, order, scenario: scenario.id, required: scenario.required, seed,
  input: { caseId: `${scenario.id}-${seed}-${order}-${arm}`, action: scenario.action, world: worlds[order], sourceRevision, model, seed,
    nineCharacterCallIds: true, requestTimeoutMs: 180_000, promptMode: 'experimental' as const,
    experiment: { thinking: true, roleOnly: true, outputMode: 'text' as const, summaryLabel: true,
      entityDefinition: true, sectionDefinitions: true, entityHeader: true, requestInfoName: 'get_entity' as const,
      requestInfoParameter: 'name' as const, requestInfoDescription: INCLUSION_DESCRIPTION,
      ...(arm === 'control' ? {} : { reasoningPrefill: { channelOpen: CHANNEL_OPEN, text: PREFILLS[arm] } }) } },
})))));

// Arms differ only by the round-0 prefill; orders only by entity sequence.
const prepared = jobs.map(({ input }) => prepareNarrationToolCallCase(input).request);
for (let i = 0; i < prepared.length; i += ARMS.length) {
  if (!prepared.slice(i, i + ARMS.length).every((request) => isDeepStrictEqual(request, prepared[i]))) throw new Error('Arms differ before prefill.');
}
const rendered = (order: typeof ORDERS[number]) => prepared[jobs.findIndex((job) => job.order === order)].messages[0].content ?? '';
for (const order of ORDERS) {
  const positions = entityOrder[order].map((name) => rendered(order).indexOf(`**${name}**`));
  if (positions.some((at, i) => at < 0 || (i > 0 && at < positions[i - 1]))) throw new Error(`Rendered ${order} order does not match the list.`);
}

const path = `testing/baseline/runs/narration-tool-call-probe/prefill-order-${live ? 'batch' : 'preparation'}-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`;
const trials: Array<{ arm: string; order: string; scenario: string; seed: number; trial: ProbeTrialEvidence }> = [];
let modelMetadata: unknown = null;
const started = performance.now();
const save = () => writeFileSync(path, JSON.stringify({ sourceRevision, model, modelMetadata, prefills: PREFILLS, channelOpen: CHANNEL_OPEN,
  entityOrder, cases: SELECTION_CASES, seeds, prepared, plannedTrials: jobs.length, durationMs: performance.now() - started, trials }, null, 2) + '\n');
if (live) {
  const response = await fetch('http://127.0.0.1:1234/api/v1/models', { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Inventory HTTP ${response.status}`);
  const inventory = await response.json() as { models: Array<{ loaded_instances: Array<{ id: string }> }> };
  modelMetadata = inventory.models.find((item) => item.loaded_instances.some(({ id }) => id === model));
  if (!modelMetadata) throw new Error(`Model is not loaded: ${model}`);
  const transport = createProbeTransport({ endpoint: LM_STUDIO_PROBE_ENDPOINT });
  save();
  for (const [index, job] of jobs.entries()) {
    const trial = await runNarrationToolCallTrial({ ...job.input, transport });
    const expected = structuredClone(prepared[index]);
    if (job.input.experiment.reasoningPrefill) expected.messages.push({ role: 'assistant', content: `${CHANNEL_OPEN}${job.input.experiment.reasoningPrefill.text}` });
    if (!isDeepStrictEqual(trial.initialRequest, expected)) throw new Error('Actual request differs from preparation.');
    trials.push({ arm: job.arm, order: job.order, scenario: job.scenario, seed: job.seed, trial });
    save();
    console.log(`${trials.length}/${jobs.length} ${job.input.caseId}: ${trial.status}, fetched=[${trial.toolResults.map((r) => r.term).join(', ')}] required=[${job.required.join(', ')}], ${(trial.durationMs / 1000).toFixed(1)}s`);
    if (['endpoint_rejection', 'transport_error', 'request_timeout'].includes(trial.failure?.kind ?? '')) break;
  }
}
save();
console.log(path);
