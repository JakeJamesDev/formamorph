// Run with vite-node; --run sends twelve player turns to the loaded local model.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { CONTINUATION_EXAMPLE, SELECTION_EXAMPLE } from './narration-continuation-example';
import { createSelectionWorld, SELECTION_CASES, APPEARANCE_DESCRIPTION } from './narration-selection-fixture';
import { createProbeTransport, LM_STUDIO_PROBE_ENDPOINT, runNarrationToolCallTrial, type ProbeTrialEvidence } from './narration-tool-call-probe';

const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => arg !== '--run')) throw new Error('Use [--run].');
const live = args.includes('--run');
const baselinePath = 'testing/baseline/runs/narration-tool-call-probe/selection-expanded-example-batch-2026-09-23T05-57-03-770Z.json';
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { model: string; modelMetadata: unknown };
const sourceRevision = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const world = createSelectionWorld();
const cases = ['healer', 'environment', 'cobbler'].map(id => SELECTION_CASES.find(c => c.id === id)!);
const seeds = [424243, 424244];
const examples = { A: CONTINUATION_EXAMPLE, B: SELECTION_EXAMPLE };
const trials: Array<{ arm: string; scenario: string; seed: number; turn: number; trial: ProbeTrialEvidence }> = [];
const path = `testing/baseline/runs/narration-tool-call-probe/selection-chain-${live ? 'batch' : 'preparation'}-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`;
const started = performance.now();
let modelMetadata: unknown = null;
const save = () => writeFileSync(path, JSON.stringify({ sourceRevision, model: baseline.model, modelMetadata, seeds, cases, world, examples, durationMs: performance.now() - started, trials }, null, 2) + '\n');
if (live) {
  const response = await fetch('http://127.0.0.1:1234/api/v1/models', { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Inventory HTTP ${response.status}`);
  const inventory = await response.json() as { models: Array<{ loaded_instances: Array<{ id: string }> }> };
  modelMetadata = inventory.models.find(m => m.loaded_instances.some(i => i.id === baseline.model));
  if (!modelMetadata || !isDeepStrictEqual(modelMetadata, baseline.modelMetadata)) throw new Error('Loaded model metadata differs.');
  const transport = createProbeTransport({ endpoint: LM_STUDIO_PROBE_ENDPOINT });
  save();
  for (const seed of seeds) {
    const histories: Record<'A' | 'B', Array<{ role: 'user' | 'assistant'; content: string }>> = { A: [], B: [] };
    const stopped = new Set<string>();
    for (const [turn, scenario] of cases.entries()) {
      for (const arm of (seed === seeds[0] ? ['A', 'B'] : ['B', 'A']) as Array<'A' | 'B'>) {
        if (stopped.has(arm)) continue;
        const trial = await runNarrationToolCallTrial({ caseId: `${seed}-${turn + 1}-${arm}`, action: scenario.action, world, sourceRevision,
          model: baseline.model, seed, transport, nineCharacterCallIds: true, requestTimeoutMs: 180_000, promptMode: 'experimental',
          experiment: { thinking: true, roleOnly: true, outputMode: 'text', summaryLabel: true, entityDefinition: true,
            sectionDefinitions: true, entityHeader: true, requestInfoName: 'get_entity', requestInfoParameter: 'name',
            requestInfoDescription: APPEARANCE_DESCRIPTION, omitPriorReasoning: true, exampleFromStart: true,
            continuationExample: examples[arm], storyHistory: histories[arm] } });
        trials.push({ arm, scenario: scenario.id, seed, turn: turn + 1, trial });
        if (trial.status === 'succeeded' && trial.narration) histories[arm].push({ role: 'user', content: scenario.action }, { role: 'assistant', content: trial.narration });
        else stopped.add(arm);
        save();
        console.log(`${trials.length}/12 ${trial.caseId}: ${trial.status}, lookups=${trial.toolResults.map(r => r.term).join(',')}`);
        if (['endpoint_rejection', 'transport_error', 'request_timeout'].includes(trial.failure?.kind ?? '')) throw new Error(`Stopping: ${trial.failure?.message}`);
      }
    }
  }
}
save();
console.log(path);
