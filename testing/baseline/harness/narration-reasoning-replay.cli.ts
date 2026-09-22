// Run with vite-node; --run sends only continuations after saved first responses.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { createSelectionWorld, SELECTION_CASES, APPEARANCE_DESCRIPTION } from './narration-selection-fixture';
import { CONTINUATION_EXAMPLE, EXPANDED_CONTINUATION_EXAMPLE } from './narration-continuation-example';
import { createProbeTransport, LM_STUDIO_PROBE_ENDPOINT, prepareNarrationToolCallCase, runNarrationToolCallTrial, type ProbeTrialEvidence } from './narration-tool-call-probe';

const args = process.argv.slice(2);
if (new Set(args).size !== args.length || args.some(arg => !['--run', '--example', '--expanded-example'].includes(arg)) || (args.includes('--example') && args.includes('--expanded-example'))) throw new Error('Use [--example | --expanded-example] [--run].');
const live = args.includes('--run');
const expandedExample = args.includes('--expanded-example');
const example = args.includes('--example') || expandedExample;
const demonstration = expandedExample ? EXPANDED_CONTINUATION_EXAMPLE : CONTINUATION_EXAMPLE;
const cachedBaselinePath = expandedExample ? 'testing/baseline/runs/narration-tool-call-probe/selection-example-batch-2026-09-23T05-45-09-595Z.json' : example ? 'testing/baseline/runs/narration-tool-call-probe/selection-replay-batch-2026-09-23T05-32-42-732Z.json' : 'testing/baseline/runs/narration-tool-call-probe/selection-appearance-batch-2026-09-23T04-36-30-432Z.json';
const cached = JSON.parse(readFileSync(cachedBaselinePath, 'utf8')) as { model: string; modelMetadata: unknown; seeds: number[]; trials: Array<{ arm: string; scenario: string; seed: number; trial: ProbeTrialEvidence }> };
const sourceRevision = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const world = createSelectionWorld();
const jobs = cached.trials.filter(x => x.arm === 'B').map(baseline => {
  const scenario = SELECTION_CASES.find(c => c.id === baseline.scenario)!;
  const input = { caseId: `${scenario.id}-${baseline.seed}-B`, action: scenario.action, world, sourceRevision, model: cached.model, seed: baseline.seed,
    nineCharacterCallIds: true, requestTimeoutMs: 180_000, promptMode: 'experimental' as const,
    experiment: { thinking: true, roleOnly: true, outputMode: 'text' as const, summaryLabel: true,
      entityDefinition: true, sectionDefinitions: true, entityHeader: true, requestInfoName: 'get_entity' as const,
      requestInfoParameter: 'name' as const, requestInfoDescription: APPEARANCE_DESCRIPTION, omitPriorReasoning: true,
      ...(example ? { continuationExample: demonstration } : {}) } };
  const prepared = prepareNarrationToolCallCase(input).request;
  if (!isDeepStrictEqual(prepared, baseline.trial.initialRequest)) throw new Error('Cached initial request drifted.');
  return { baseline, input, prepared };
});
const path = `testing/baseline/runs/narration-tool-call-probe/selection-${expandedExample ? 'expanded-example' : example ? 'example' : 'replay'}-${live ? 'batch' : 'preparation'}-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`;
const trials: Array<{ arm: string; scenario: string; seed: number; trial: ProbeTrialEvidence }> = [];
let modelMetadata: unknown = null;
let liveRequests = 0;
const started = performance.now();
const save = () => writeFileSync(path, JSON.stringify({ sourceRevision, model: cached.model, modelMetadata, world, cachedBaselinePath,
  descriptions: { A: APPEARANCE_DESCRIPTION, B: APPEARANCE_DESCRIPTION }, cases: SELECTION_CASES, seeds: cached.seeds,
  prepared: jobs.flatMap(j => [j.prepared, j.prepared]), continuationExample: example ? demonstration : null,
  reusedFirstResponses: true, liveRequests, durationMs: performance.now() - started, trials }, null, 2) + '\n');
if (live) {
  const response = await fetch('http://127.0.0.1:1234/api/v1/models', { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Inventory HTTP ${response.status}`);
  const inventory = await response.json() as { models: Array<{ loaded_instances: Array<{ id: string }> }> };
  modelMetadata = inventory.models.find(m => m.loaded_instances.some(i => i.id === cached.model));
  if (!modelMetadata || !isDeepStrictEqual(modelMetadata, cached.modelMetadata)) throw new Error('Loaded model metadata differs.');
  const transport = createProbeTransport({ endpoint: LM_STUDIO_PROBE_ENDPOINT });
  save();
  for (const { baseline, input, prepared } of jobs) {
    let calls = 0;
    const trial = await runNarrationToolCallTrial({ ...input, transport: { async send(request, options) {
      calls++;
      if (calls === 1) {
        if (!isDeepStrictEqual(request, prepared)) throw new Error('Initial replay request drifted.');
        return structuredClone(baseline.trial.requests[0].response);
      }
      if (calls === 2) {
        const expected = structuredClone(baseline.trial.requests[1].request);
        for (const message of expected.messages) {
          if (message.role !== 'assistant') continue;
          delete (message as typeof message & { reasoning_content?: unknown }).reasoning_content;
          delete (message as typeof message & { reasoning?: unknown }).reasoning;
        }
        const actual = structuredClone(request);
        if (expandedExample) {
          for (const message of actual.messages) {
            delete message.reasoning_content;
            delete (message as typeof message & { reasoning?: unknown }).reasoning;
          }
        } else if (example) {
          if (actual.messages.slice(1, 5).map(m => m.role).join(',') !== 'user,assistant,tool,assistant') throw new Error('Example sequence missing.');
          actual.messages.splice(1, CONTINUATION_EXAMPLE.length);
          for (const message of actual.messages) {
            for (const call of message.tool_calls ?? []) call.id = (parseInt(call.id, 36) - 1).toString(36).padStart(9, '0');
            if (message.tool_call_id) message.tool_call_id = (parseInt(message.tool_call_id, 36) - 1).toString(36).padStart(9, '0');
          }
        }
        if (!isDeepStrictEqual(actual, expected)) throw new Error('Continuation differs outside the selected ablation.');
      }
      liveRequests++;
      return transport.send(request, options);
    } } });
    trials.push({ ...baseline, arm: 'A' }, { ...baseline, arm: 'B', trial });
    save();
    console.log(`${trials.length}/24 ${input.caseId}: ${trial.status}, lookups=${trial.lookupCount}, live=${calls - 1}`);
    if (['endpoint_rejection', 'transport_error', 'request_timeout'].includes(trial.failure?.kind ?? '')) break;
  }
}
save();
console.log(path);
