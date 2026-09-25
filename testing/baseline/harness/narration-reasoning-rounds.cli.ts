// Reasoning kept between tool rounds against omitted, on the selection fixture.
// Run with vite-node: no flag prepares only, --run infers, --score <batch> prints the tables of a saved batch.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { createSelectionWorld, RETRIEVAL_FIRST_DESCRIPTION, SELECTION_CASES } from './narration-selection-fixture';
import { normalizedFirstResponse, scoreSelectionTrial, summarizeArm, type ArmSummary, type ScoredTrial } from './narration-selection-score';
import { createProbeTransport, LM_STUDIO_PROBE_ENDPOINT, prepareNarrationToolCallCase, runNarrationToolCallTrial, type ProbeMessage, type ProbeRequest, type ProbeTrialEvidence } from './narration-tool-call-probe';

const ARMS = ['control', 'kept'] as const;
type Arm = typeof ARMS[number];
// Each first continuation of the kept arm is re-sent at one output token in three shapes; prompt tokens tell whether the field is rendered.
const FIELD_VARIANTS = ['as_sent', 'stripped', 'renamed'] as const;
type FieldVariant = typeof FIELD_VARIANTS[number];

interface TrialRecord { arm: Arm; scenario: string; seed: number; trial: ProbeTrialEvidence }
interface FieldCheck { scenario: string; seed: number; variant: FieldVariant; reasoningChars: number; status: number; promptTokens: number | null; body?: unknown }
interface Batch { sourceRevision: string; model: string; modelMetadata: unknown; description: string; cases: typeof SELECTION_CASES; seeds: number[];
  prepared: ProbeRequest[]; plannedTrials: number; durationMs: number; trials: TrialRecord[]; fieldChecks: FieldCheck[] }

const args = process.argv.slice(2);
const scorePath = args[0] === '--score' && args.length === 2 ? args[1] : '';
if (!scorePath && args.some((arg) => arg !== '--run')) throw new Error('Use [--run] or --score <batch>.');
const live = args.includes('--run');

function score(batch: Batch): { scored: ScoredTrial[]; summaries: Record<Arm, ArmSummary> } {
  const scored = batch.trials.map(({ arm, scenario, seed, trial }) => {
    const required = batch.cases.find((item) => item.id === scenario)?.required ?? [];
    const pair = batch.trials.find((item) => item.arm !== arm && item.scenario === scenario && item.seed === seed);
    const firstResponseMatchesPair = !!pair && isDeepStrictEqual(normalizedFirstResponse(trial), normalizedFirstResponse(pair.trial));
    return scoreSelectionTrial(trial, required, { arm, scenario, seed, firstResponseMatchesPair });
  });
  const summaries = Object.fromEntries(ARMS.map((arm) => [arm, summarizeArm(scored.filter((item) => item.arm === arm))])) as Record<Arm, ArmSummary>;
  return { scored, summaries };
}

function report(batch: Batch): string {
  const { scored, summaries } = score(batch);
  const lines = ['| Arm | Completed | Involved fetched | Unneeded | Unmatched | Duplicates | First-round reasoning | Later reasoning | First response equals pair | Failures |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const arm of ARMS) {
    const s = summaries[arm];
    lines.push(`| ${arm} | ${s.completed}/${s.trials} | ${s.involvedFetched}/${s.involvedTotal} | ${s.unneeded} | ${s.unmatched} | ${s.duplicates} | ${s.firstRoundReasoning} | ${s.laterReasoning} | ${s.firstResponseMatchesPair}/${s.trials} | ${Object.entries(s.failures).map(([kind, count]) => `${kind} ${count}`).join(', ') || 'none'} |`);
  }
  lines.push('', '| Case / seed | Arm | Completed | Involved | Unneeded | Rounds | First-round reasoning | Later reasoning | Prompt tokens per round | Finish |', '|---|---|---|---:|---:|---:|---:|---:|---|---|');
  for (const item of scored) {
    lines.push(`| ${item.scenario} / ${item.seed} | ${item.arm} | ${item.completed ? 'yes' : `no (${item.failure})`} | ${item.involvedFetched}/${item.involvedTotal} | ${item.unneeded} | ${item.rounds} | ${item.firstRoundReasoning} | ${item.laterReasoning} | ${item.promptTokens.join(', ')} | ${item.finishReason ?? '-'} |`);
  }
  if (batch.fieldChecks.length) {
    lines.push('', '| Case / seed | Reasoning chars | as_sent prompt tokens | stripped | renamed | Status |', '|---|---:|---:|---:|---:|---|');
    const keys = [...new Set(batch.fieldChecks.map((check) => `${check.scenario} / ${check.seed}`))];
    for (const key of keys) {
      const checks = batch.fieldChecks.filter((check) => `${check.scenario} / ${check.seed}` === key);
      const cell = (variant: FieldVariant) => { const check = checks.find((item) => item.variant === variant); return check ? (check.promptTokens ?? `HTTP ${check.status}`) : '-'; };
      lines.push(`| ${key} | ${checks[0].reasoningChars} | ${cell('as_sent')} | ${cell('stripped')} | ${cell('renamed')} | ${checks.map((check) => check.status).join('/')} |`);
    }
  }
  return lines.join('\n');
}

if (scorePath) {
  console.log(report(JSON.parse(readFileSync(scorePath, 'utf8')) as Batch));
} else {
  const model = 'g4-meromero-v2-31b-i1';
  const sourceRevision = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const world = createSelectionWorld();
  const seeds = [424243, 424244];
  const jobs = seeds.flatMap((seed, si) => SELECTION_CASES.flatMap((scenario, ci) => ((si + ci) % 2 ? [...ARMS].reverse() : [...ARMS]).map((arm) => ({
    arm, scenario: scenario.id, required: scenario.required, seed,
    input: { caseId: `${scenario.id}-${seed}-${arm}`, action: scenario.action, world, sourceRevision, model, seed,
      nineCharacterCallIds: true, requestTimeoutMs: 180_000, promptMode: 'experimental' as const,
      experiment: { thinking: true, roleOnly: true, outputMode: 'text' as const, summaryLabel: true,
        entityDefinition: true, sectionDefinitions: true, entityHeader: true, requestInfoName: 'get_entity' as const,
        requestInfoParameter: 'name' as const, requestInfoDescription: RETRIEVAL_FIRST_DESCRIPTION,
        ...(arm === 'control' ? { omitPriorReasoning: true } : {}) } },
  }))));

  // Arms differ only from the first continuation on; every first request is shared.
  const prepared = jobs.map(({ input }) => prepareNarrationToolCallCase(input).request);
  for (let i = 0; i < prepared.length; i += ARMS.length) {
    if (!isDeepStrictEqual(prepared[i], prepared[i + 1])) throw new Error('Arms differ in the first request.');
  }

  const path = `testing/baseline/runs/narration-tool-call-probe/reasoning-rounds-${live ? 'batch' : 'preparation'}-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`;
  const batch: Batch = { sourceRevision, model, modelMetadata: null, description: RETRIEVAL_FIRST_DESCRIPTION, cases: SELECTION_CASES, seeds,
    prepared, plannedTrials: jobs.length, durationMs: 0, trials: [], fieldChecks: [] };
  const started = performance.now();
  const save = () => { batch.durationMs = performance.now() - started; writeFileSync(path, JSON.stringify(batch, null, 2) + '\n'); };

  const fieldCheck = async (record: TrialRecord) => {
    const continuation = record.trial.requests[1]?.request;
    if (!continuation) return;
    const assistant = continuation.messages.find((message) => message.role === 'assistant');
    const reasoning = typeof assistant?.reasoning_content === 'string' ? assistant.reasoning_content : '';
    for (const variant of FIELD_VARIANTS) {
      const messages = structuredClone(continuation.messages).map((message): ProbeMessage => {
        if (message.role !== 'assistant' || variant === 'as_sent') return message;
        const { reasoning_content: content, ...rest } = message;
        return variant === 'stripped' ? rest : { ...rest, reasoning: content } as ProbeMessage;
      });
      const body: Record<string, unknown> = { ...continuation, messages, max_tokens: 1 };
      const response = await fetch(LM_STUDIO_PROBE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) });
      const text = await response.text();
      let parsed: unknown = text;
      try { parsed = JSON.parse(text); } catch { /* keep the raw body */ }
      const usage = typeof parsed === 'object' && parsed !== null && 'usage' in parsed ? (parsed as { usage?: { prompt_tokens?: unknown } }).usage : undefined;
      const promptTokens = typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null;
      batch.fieldChecks.push({ scenario: record.scenario, seed: record.seed, variant, reasoningChars: reasoning.length, status: response.status, promptTokens, ...(response.ok ? {} : { body: parsed }) });
      save();
      console.log(`field check ${record.scenario}-${record.seed} ${variant}: HTTP ${response.status}, prompt_tokens=${promptTokens}`);
    }
  };

  if (live) {
    const response = await fetch('http://127.0.0.1:1234/api/v1/models', { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Inventory HTTP ${response.status}`);
    const inventory = await response.json() as { models: Array<{ loaded_instances: Array<{ id: string }> }> };
    batch.modelMetadata = inventory.models.find((item) => item.loaded_instances.some(({ id }) => id === model));
    if (!batch.modelMetadata) throw new Error(`Model is not loaded: ${model}`);
    const transport = createProbeTransport({ endpoint: LM_STUDIO_PROBE_ENDPOINT });
    save();
    for (const [index, job] of jobs.entries()) {
      const trial = await runNarrationToolCallTrial({ ...job.input, transport });
      if (!isDeepStrictEqual(trial.initialRequest, prepared[index])) throw new Error('Actual request differs from preparation.');
      batch.trials.push({ arm: job.arm, scenario: job.scenario, seed: job.seed, trial });
      save();
      console.log(`${batch.trials.length}/${jobs.length} ${job.input.caseId}: ${trial.status}, fetched=[${trial.toolResults.map((r) => r.term).join(', ')}] required=[${job.required.join(', ')}], ${(trial.durationMs / 1000).toFixed(1)}s`);
      if (['endpoint_rejection', 'transport_error', 'request_timeout'].includes(trial.failure?.kind ?? '')) break;
    }
    for (const record of batch.trials) if (record.arm === 'kept') await fieldCheck(record);
    console.log(report(batch));
  }
  save();
  console.log(path);
}
