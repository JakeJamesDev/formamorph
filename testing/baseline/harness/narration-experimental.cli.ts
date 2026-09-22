// Use vite-node with a saved description batch; append --run to perform inference.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { migrateWorld } from '@/lib/version';
import { createProbeTransport, LM_STUDIO_PROBE_ENDPOINT, prepareNarrationToolCallCase, REQUIRED_LORE_RULE, ROLE_ONLY_INSTRUCTION, ENTITY_DEFINITION, SECTION_DEFINITIONS, ENTITY_SECTION_SCOPE,
  runNarrationToolCallTrial, type ProbeTrialEvidence } from './narration-tool-call-probe';

const [baselinePath, ...flags] = process.argv.slice(2);
const plain = flags.includes('--plain');
const preparation = flags.includes('--preparation');
const prerequisite = flags.includes('--prerequisite');
const decisionNotes = flags.includes('--decision-notes');
const roleOnly = flags.includes('--role-only');
const summaryLabel = flags.includes('--summary-label');
const mentionTool = flags.includes('--mention-tool');
const entityDefinition = flags.includes('--entity-definition');
const entityDiagnostic = flags.includes('--entity-diagnostic');
const noExample = flags.includes('--no-example');
const sectionDefinitions = flags.includes('--section-definitions');
const entityHeader = flags.includes('--entity-header');
const entityTool = flags.includes('--entity-tool');
const entityParameter = flags.includes('--entity-parameter');
const entityFull = flags.includes('--entity-full');
const namingStudy = entityHeader || entityTool || entityParameter || entityFull;
const fullDescription = `Purpose: Retrieve an entity's full authored entry. Entity summaries help you select what to include in the scene.
Use when: Before mentioning a selected entity in narration, whether by name or indirect reference, unless its full entry is already in context.
Input: name — the entity's name from the entity list.
Output: JSON with a matches array. Each match contains id, name, and the full authored description when provided by the author. An empty matches array means no matching entity was found.`;
const entityStudy = entityDefinition || entityDiagnostic || noExample || sectionDefinitions || namingStudy;
const diagnosticQuestion = 'What does “entity” mean in this request, and which supplied entries does it include?';
const mentionDescription = 'Retrieve an entity\'s full authored entry before mentioning it in narration, including indirect references such as “the ferryman.” Entity summaries help you select what to include in the scene. For each selected entity, retrieve its entry unless the full entry is already in context. Supply its name from the entity list.';
const experimentalBaseline = plain || preparation || prerequisite || decisionNotes || roleOnly || summaryLabel || mentionTool || entityStudy;
const live = flags.includes('--run');
if (!baselinePath || [plain, preparation, prerequisite, decisionNotes, roleOnly, summaryLabel, mentionTool, entityDefinition, entityDiagnostic, noExample, sectionDefinitions, entityHeader, entityTool, entityParameter, entityFull].filter(Boolean).length > 1 || flags.some((flag) => !['--run', '--plain', '--preparation', '--prerequisite', '--decision-notes', '--role-only', '--summary-label', '--mention-tool', '--entity-definition', '--entity-diagnostic', '--no-example', '--section-definitions', '--entity-header', '--entity-tool', '--entity-parameter', '--entity-full'].includes(flag)) || new Set(flags).size !== flags.length) {
  throw new Error('Use <baseline.json> [--plain | --preparation | --prerequisite | --decision-notes | --role-only | --summary-label | --mention-tool | --entity-definition | --entity-diagnostic | --no-example | --section-definitions | --entity-header | --entity-tool | --entity-parameter | --entity-full] [--run].');
}
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
  model: string; description: string; modelMetadata: unknown;
  cases: Array<{ id: string; action: string; known: string[]; required: string[] }>;
  trials: Array<{ arm: string; scenario: string; seed: number; trial: ProbeTrialEvidence }>;
};
const description = experimentalBaseline ? baseline.trials[0].trial.initialRequest.tools.find((tool) => ['request_info', 'get_entity'].includes(tool.function.name))?.function.description : baseline.description;
if (!description) throw new Error('Baseline has no lookup description.');
const neutralDescription = description.replace('including indirect references such as “the ferryman.”', 'whether by name or indirect reference.');
if (noExample && neutralDescription === description) throw new Error('Expected fixture-specific example is missing from baseline.');
const seeds = [424243, 424244];
const world = migrateWorld(JSON.parse(readFileSync('testing/baseline/sedge-landing.json', 'utf8')));
const sourceRevision = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const jobs = seeds.flatMap((seed) => baseline.cases.filter((scenario) => !entityDiagnostic || scenario.id === 'greeting').map((scenario) => {
  const cached = baseline.trials.filter((item) => (experimentalBaseline || item.arm === 'B') && item.seed === seed && item.scenario === scenario.id);
  if (cached.length !== 1) throw new Error(`Expected one cached baseline: ${scenario.id}/${seed}`);
  const input = { caseId: `${scenario.id}-${seed}-experimental`, action: scenario.action, world, sourceRevision,
    model: baseline.model, seed, nineCharacterCallIds: true, requestTimeoutMs: 180_000,
    experiment: { thinking: true, knownEntityNames: scenario.known, requestInfoDescription: description,
      ...(preparation || prerequisite || decisionNotes || roleOnly || summaryLabel || mentionTool || entityStudy ? { outputMode: 'text' as const } : {}),
      ...(prerequisite || decisionNotes || roleOnly || summaryLabel || mentionTool || entityStudy ? { preparationGoal: true } : {}),
      ...(decisionNotes || roleOnly || summaryLabel || mentionTool || entityStudy ? { requiredLore: true } : {}),
      ...(roleOnly || summaryLabel || mentionTool || entityStudy ? { decisionNotes: true } : {}), ...(summaryLabel || mentionTool || entityStudy ? { roleOnly: true } : {}), ...(mentionTool || entityStudy ? { summaryLabel: true } : {}), ...(noExample || sectionDefinitions || namingStudy ? { entityDefinition: true } : {}), ...(namingStudy ? { sectionDefinitions: true } : {}), ...(entityParameter ? { requestInfoName: 'get_entity' as const } : {}) } };
  const original = prepareNarrationToolCallCase({ ...input, ...(experimentalBaseline ? { promptMode: 'experimental' as const } : {}) }).request;
  if (!isDeepStrictEqual(original, cached[0].trial.initialRequest)) throw new Error('Cached baseline request drifted.');
  const trialInput = { ...input, ...(entityDiagnostic ? { action: diagnosticQuestion } : {}), experiment: { ...input.experiment, ...(plain ? { outputMode: 'text' as const } : {}),
    ...(preparation ? { preparationGoal: true } : {}), ...(prerequisite ? { requiredLore: true } : {}),
    ...(decisionNotes ? { decisionNotes: true } : {}), ...(roleOnly ? { roleOnly: true } : {}), ...(summaryLabel ? { summaryLabel: true } : {}), ...(mentionTool ? { requestInfoDescription: mentionDescription } : {}), ...(entityDefinition ? { entityDefinition: true } : {}), ...(noExample ? { requestInfoDescription: neutralDescription } : {}), ...(sectionDefinitions ? { sectionDefinitions: true } : {}), ...(entityHeader ? { entityHeader: true } : {}), ...(entityTool ? { requestInfoName: 'get_entity' as const } : {}), ...(entityParameter ? { requestInfoParameter: 'name' as const } : {}), ...(entityFull ? { entityHeader: true, requestInfoName: 'get_entity' as const, requestInfoParameter: 'name' as const, requestInfoDescription: fullDescription } : {}) } };
  const experimental = prepareNarrationToolCallCase({ ...trialInput, promptMode: 'experimental' }).request;
  const normalized = structuredClone(experimental);
  if (entityFull) {
    const tool = normalized.tools.find((tool) => tool.function.name === 'get_entity');
    if (!tool || tool.function.description !== fullDescription || !('name' in tool.function.parameters.properties)) throw new Error('Combined tool changes missing.');
    tool.function = structuredClone(original.tools[0].function);
    const system = normalized.messages[0].content ?? '';
    if (!system.includes('## Entities in the Current Location\n')) throw new Error('Combined header missing.');
    normalized.messages[0].content = system.replace('## Entities in the Current Location\n', '## Characters and Things That May Appear in This Location\n');
    for (const message of normalized.messages) for (const call of message.tool_calls ?? []) {
      if (call.function.name !== 'get_entity') throw new Error('Combined cached call name drifted.');
      call.function.name = 'request_info';
      call.function.arguments = JSON.stringify({ term: (JSON.parse(call.function.arguments) as { name: string }).name });
    }
  } else if (entityHeader) {
    const system = normalized.messages[0].content ?? '';
    if (!system.includes('## Entities in the Current Location\n')) throw new Error('Entity header missing.');
    normalized.messages[0].content = system.replace('## Entities in the Current Location\n', '## Characters and Things That May Appear in This Location\n');
  } else if (entityTool || entityParameter) {
    const tool = normalized.tools.find((tool) => tool.function.name === 'get_entity');
    if (!tool) throw new Error('Renamed tool missing.');
    if (entityTool) tool.function.name = 'request_info';
    else {
      if (!('name' in tool.function.parameters.properties)) throw new Error('Name parameter missing.');
      tool.function.parameters = original.tools[0].function.parameters;
    }
    for (const message of normalized.messages) for (const call of message.tool_calls ?? []) {
      if (call.function.name !== 'get_entity') throw new Error('Cached call name drifted.');
      if (entityTool) call.function.name = 'request_info';
      else call.function.arguments = JSON.stringify({ term: (JSON.parse(call.function.arguments) as { name: string }).name });
    }
  } else if (sectionDefinitions) {
    let system = normalized.messages[0].content ?? '';
    for (const [header, definition] of Object.entries(SECTION_DEFINITIONS)) {
      if ((original.messages[0].content ?? '').includes(`## ${header}\n`)) {
        const insertion = `## ${header}\n${definition}\n\n`;
        if (!system.includes(insertion)) throw new Error(`Missing definition: ${header}`);
        system = system.replace(insertion, `## ${header}\n`);
      }
    }
    if (!system.includes(`${ENTITY_SECTION_SCOPE}\n`)) throw new Error('Entity scope missing.');
    normalized.messages[0].content = system.replace(`${ENTITY_SECTION_SCOPE}\n`, '');
  } else if (noExample) {
    const tool = normalized.tools.find((tool) => tool.function.name === 'request_info');
    if (!tool || tool.function.description !== neutralDescription) throw new Error('Neutral description missing.');
    tool.function.description = description;
  } else if (entityDefinition) {
    const system = normalized.messages[0].content ?? '';
    if (!system.includes(ENTITY_DEFINITION)) throw new Error('Entity definition missing.');
    normalized.messages[0].content = system.replace(`${ENTITY_DEFINITION}\n\n`, '');
  } else if (entityDiagnostic) {
    if (normalized.messages[1].content !== diagnosticQuestion) throw new Error('Diagnostic question missing.');
    normalized.messages[1] = original.messages[1];
  } else if (mentionTool) {
    const tool = normalized.tools.find((tool) => tool.function.name === 'request_info');
    if (!tool || tool.function.description !== mentionDescription) throw new Error('Mention tool description missing.');
    tool.function.description = description;
  } else if (summaryLabel) {
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
const path = `testing/baseline/runs/narration-tool-call-probe/experimental-${entityFull ? 'entity-full-' : entityHeader ? 'entity-header-' : entityTool ? 'entity-tool-' : entityParameter ? 'entity-parameter-' : sectionDefinitions ? 'section-definitions-' : noExample ? 'no-example-' : entityDefinition ? 'entity-definition-' : entityDiagnostic ? 'entity-diagnostic-' : mentionTool ? 'mention-tool-' : summaryLabel ? 'summary-label-' : roleOnly ? 'role-only-' : decisionNotes ? 'decision-notes-' : prerequisite ? 'prerequisite-' : preparation ? 'preparation-goal-' : plain ? 'plain-' : ''}${live ? 'batch' : 'preparation'}-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`;
const trials: Array<{ scenario: string; seed: number; trial: ProbeTrialEvidence }> = [];
const started = performance.now();
let modelMetadata: unknown = null;
const save = () => writeFileSync(path, `${JSON.stringify({ baselinePath, sourceRevision, preparationGoal: preparation || prerequisite || decisionNotes, requiredLore: prerequisite || decisionNotes, decisionNotes,
  roleOnly: roleOnly || summaryLabel || mentionTool || entityStudy, summaryLabel: summaryLabel || mentionTool || entityStudy, mentionTool, entityDefinition: entityDefinition || noExample || sectionDefinitions || namingStudy, entityDiagnostic, noExample, sectionDefinitions: sectionDefinitions || namingStudy, entityHeader, entityTool, entityParameter, entityFull,
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
