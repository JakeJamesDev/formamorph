// Run with vite-node testing/baseline/harness/narration-tool-description.cli.ts --run <loaded-model>.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { migrateWorld } from '@/lib/version';
import {
  createProbeTransport, LM_STUDIO_PROBE_ENDPOINT, MAIN_ACTION,
  prepareNarrationToolCallCase, runNarrationToolCallTrial,
  type ProbeTrialEvidence,
} from './narration-tool-call-probe';

const description = "Retrieve full authored descriptions for world entities you plan to portray. The available summaries identify entities but omit their detailed lore. Use this tool when that entity's full description is not already in context. Supply names from the available-entity list.";
const cases = [
  { id: 'greeting', action: MAIN_ACTION, known: [], required: ['Bram', 'Odette'] },
  { id: 'odette', action: 'I approach the woman smoking eels and quietly study her face and hair while asking how she prepares the fish.', known: [], required: ['Odette'] },
  { id: 'ferry', action: 'I examine the rope ferry closely, checking its construction and how many people it can carry.', known: [], required: ['Rope Ferry'] },
  { id: 'environment', action: 'I keep my attention on the pale water and the dock planks, silently studying their colors and textures without interacting with anyone.', known: [], required: [] },
  { id: 'cached-bram', action: 'I ask the ferryman when he stops making crossings and study his sleeve and jewelry as he replies.', known: ['Bram'], required: ['Bram'] },
  { id: 'mixed-cache', action: MAIN_ACTION, known: ['Bram'], required: ['Bram', 'Odette'] },
];
const seeds = [424243, 424244, 424245, 424246];
const args = process.argv.slice(2);
const live = args[0] === '--run';
if ((live && args.length !== 2) || (!live && args.length)) throw new Error('Use no arguments for preparation, or --run <loaded-model>.');
const model = args[1] ?? 'g4-meromero-v2-31b-i1';
const sourceRevision = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const world = migrateWorld(JSON.parse(readFileSync('testing/baseline/sedge-landing.json', 'utf8')));
const jobs = seeds.flatMap((seed, seedIndex) => cases.flatMap((scenario, caseIndex) =>
  ((seedIndex + caseIndex) % 2 ? ['B', 'A'] : ['A', 'B']).map((arm) => ({
    arm, scenario, seed,
    input: {
      caseId: `${scenario.id}-${seed}-${arm}`, action: scenario.action, world, sourceRevision, model, seed,
      nineCharacterCallIds: true, requestTimeoutMs: 180_000,
      experiment: { thinking: true, knownEntityNames: scenario.known,
        ...(arm === 'B' ? { requestInfoDescription: description } : {}),
      },
    },
  })),
));
const prepared = jobs.map(({ input }) => prepareNarrationToolCallCase(input));
for (let index = 0; index < prepared.length; index += 2) {
  const requests = prepared.slice(index, index + 2).map(({ request }) => {
    const copy = structuredClone(request);
    copy.tools[0].function.description = '';
    return JSON.stringify(copy);
  });
  if (requests[0] !== requests[1]) throw new Error('A/B requests differ outside the lookup description.');
}
const outputDir = 'testing/baseline/runs/narration-tool-call-probe';
mkdirSync(outputDir, { recursive: true });
const path = `${outputDir}/description-${live ? 'expanded' : 'preparation'}-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`;
const trials: Array<{ arm: string; scenario: string; seed: number; trial: ProbeTrialEvidence }> = [];
let modelMetadata: unknown = null;
const started = performance.now();
const save = () => writeFileSync(path, `${JSON.stringify({
  sourceRevision, model, description, cases, seeds, modelMetadata,
  initialRequestPairsVerified: 24, plannedTrials: 48, durationMs: performance.now() - started,
  prepared: live ? undefined : prepared, trials,
}, null, 2)}\n`);
if (live) {
  const response = await fetch('http://127.0.0.1:1234/api/v1/models', { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Model inventory HTTP ${response.status}`);
  const inventory = await response.json() as { models: Array<{ key: string; loaded_instances: Array<{ id: string }> }> };
  modelMetadata = inventory.models.find((item) => item.loaded_instances.some(({ id }) => id === model));
  if (!modelMetadata) throw new Error(`Requested model is not loaded: ${model}`);
  const transport = createProbeTransport({ endpoint: LM_STUDIO_PROBE_ENDPOINT });
  for (const job of jobs) {
    const trial = await runNarrationToolCallTrial({ ...job.input, transport });
    trials.push({ arm: job.arm, scenario: job.scenario.id, seed: job.seed, trial });
    save();
    console.log(`${trials.length}/48 ${trial.caseId}: ${trial.status}, lookups=${trial.lookupCount}, ${(trial.durationMs / 1000).toFixed(1)}s`);
    if (['endpoint_rejection', 'transport_error', 'request_timeout'].includes(trial.failure?.kind ?? '')) break;
  }
}
save();
console.log(path);
