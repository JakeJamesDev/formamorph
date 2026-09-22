// Use vite-node with a saved description batch; append --run to perform inference.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { migrateWorld } from '@/lib/version';
import { createProbeTransport, LM_STUDIO_PROBE_ENDPOINT, prepareNarrationToolCallCase, REQUIRED_LORE_RULE, ROLE_ONLY_INSTRUCTION,
  runNarrationToolCallTrial, type ProbeTrialEvidence } from './narration-tool-call-probe';

const [baselinePath, ...flags] = process.argv.slice(2);
const plain = flags.includes('--plain');
const preparation = flags.includes('--preparation');
const prerequisite = flags.includes('--prerequisite');
const decisionNotes = flags.includes('--decision-notes');
const roleOnly = flags.includes('--role-only');
const summaryLabel = flags.includes('--summary-label');
const experimentalBaseline = plain || preparation || prerequisite || decisionNotes || roleOnly || summaryLabel;
const live = flags.includes('--run');
if (!baselinePath || [plain, preparation, prerequisite, decisionNotes, roleOnly, summaryLabel].filter(Boolean).length > 1 || flags.some((flag) => !['--run', '--plain', '--preparation', '--prerequisite', '--decision-notes', '--role-only', '--summary-label'].includes(flag)) || new Set(flags).size !== flags.length) {
  throw new Error('Use <baseline.json> [--plain | --preparation | --prerequisite | --decision-notes | --role-only | --summary-label] [--run].');
}
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
  model: string; description: string; modelMetadata: unknown;
  cases: Array<{ id: string; action: string; known: string[]; required: string[] }>;
  trials: Array<{ arm: string; scenario: string; seed: number; trial: ProbeTrialEvidence }>;
};
const description = experimentalBaseline ? baseline.trials[0].trial.initialRequest.tools.find((tool) => tool.function.name === 'request_info')?.function.description : baseline.description;
if (!description) throw new Error('Baseline has no lookup description.');
const seeds = [424243, 424244];
const world = migrateWorld(JSON.parse(readFileSync('testing/baseline/sedge-landing.json', 'utf8')));
const sourceRevision = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const jobs = seeds.flatMap((seed) => baseline.cases.map((scenario) => {
  const cached = baseline.trials.filter((item) => (experimentalBaseline || item.arm === 'B') && item.seed === seed && item.scenario === scenario.id);
  if (cached.length !== 1) throw new Error(`Expected one cached baseline: ${scenario.id}/${seed}`);
  const input = { caseId: `${scenario.id}-${seed}-experimental`, action: scenario.action, world, sourceRevision,
    model: baseline.model, seed, nineCharacterCallIds: true, requestTimeoutMs: 180_000,
    experiment: { thinking: true, knownEntityNames: scenario.known, requestInfoDescription: description,
      ...(preparation || prerequisite || decisionNotes || roleOnly || summaryLabel ? { outputMode: 'text' as const } : {}),
      ...(prerequisite || decisionNotes || roleOnly || summaryLabel ? { preparationGoal: true } : {}),
      ...(decisionNotes || roleOnly || summaryLabel ? { requiredLore: true } : {}),
      ...(roleOnly || summaryLabel ? { decisionNotes: true } : {}), ...(summaryLabel ? { roleOnly: true } : {}) } };
  const original = prepareNarrationToolCallCase({ ...input, ...(experimentalBaseline ? { promptMode: 'experimental' as const } : {}) }).request;
  if (!isDeepStrictEqual(original, cached[0].trial.initialRequest)) throw new Error('Cached baseline request drifted.');
  const trialInput = { ...input, experiment: { ...input.experiment, ...(plain ? { outputMode: 'text' as const } : {}),
    ...(preparation ? { preparationGoal: true } : {}), ...(prerequisite ? { requiredLore: true } : {}),
    ...(decisionNotes ? { decisionNotes: true } : {}), ...(roleOnly ? { roleOnly: true } : {}), ...(summaryLabel ? { summaryLabel: true } : {}) } };
  const experimental = prepareNarrationToolCallCase({ ...trialInput, promptMode: 'experimental' }).request;
  const normalized = structuredClone(experimental);
  if (summaryLabel) {
    const before = original.messages[0].content ?? '';
    const after = normalized.messages[0].content ?? '';
    if ((after.match(/ {2}- \*\*summary:\*\*/g) ?? []).length !== 3
      || after.replaceAll('  - **summary:**', '  - **description:**') !== before) throw new Error('Changes outside entity labels.');
    normalized.messages[0] = original.messages[0];
  } else if (roleOnly) {
    const context = original.messages[0].content?.match(/## Game World\n[\s\S]*?(?=## Preparation\n)/)?.[0].trim();
    if (!context || normalized.messages[0].content?.trim() !== `${ROLE_ONLY_INSTRUCTION}\n\n${context}`) throw new Error('Role-only context or instruction drifted.');
    normalized.messages[0] = original.messages[0];
  } else if (prerequisite) {
    const system = normalized.messages[0].content ?? '';
    if (!system.includes(REQUIRED_LORE_RULE)) throw new Error('Prerequisite rule missing.');
    normalized.messages[0].content = system.replace(REQUIRED_LORE_RULE, 'When a needed entry is missing, request it before composing the scene.');
  } else if (preparation || decisionNotes) {
    const section = /## Preparation\n[\s\S]*?(?=## Output\n)/;
    const oldSystem = original.messages[0].content ?? '';
    const newSystem = normalized.messages[0].content ?? '';
    if (!section.test(oldSystem) || !section.test(newSystem)
      || oldSystem.replace(section, '') !== newSystem.replace(section, '')) throw new Error('Changes outside preparation.');
    if (decisionNotes && (!oldSystem.includes(REQUIRED_LORE_RULE) || !newSystem.includes(REQUIRED_LORE_RULE))) throw new Error('Retrieval rule changed.');
    normalized.messages[0] = original.messages[0];
  } else if (plain) normalized.tools = [...normalized.tools, ...original.tools.filter((tool) => tool.function.name === 'write')];
  else {
    normalized.messages[0] = original.messages[0];
    normalized.messages[1] = original.messages[1];
  }
  if (!isDeepStrictEqual(normalized, original)) throw new Error('Non-prompt controls differ.');
  return { input: trialInput, scenario: scenario.id, required: scenario.required, baseline: cached[0].trial, prepared: experimental };
}));
const path = `testing/baseline/runs/narration-tool-call-probe/experimental-${summaryLabel ? 'summary-label-' : roleOnly ? 'role-only-' : decisionNotes ? 'decision-notes-' : prerequisite ? 'prerequisite-' : preparation ? 'preparation-goal-' : plain ? 'plain-' : ''}${live ? 'batch' : 'preparation'}-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`;
const trials: Array<{ scenario: string; seed: number; trial: ProbeTrialEvidence }> = [];
const started = performance.now();
let modelMetadata: unknown = null;
const save = () => writeFileSync(path, `${JSON.stringify({ baselinePath, sourceRevision, preparationGoal: preparation || prerequisite || decisionNotes, requiredLore: prerequisite || decisionNotes, decisionNotes,
  roleOnly: roleOnly || summaryLabel, summaryLabel,
  outputMode: experimentalBaseline ? 'text' : 'write', model: baseline.model,
  seeds, cases: baseline.cases, plannedTrials: jobs.length, modelMetadata, durationMs: performance.now() - started,
  pairs: jobs.map(({ input, ...rest }) => ({ seed: input.seed, ...rest })), trials }, null, 2)}\n`);
if (live) {
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
