import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { migrateWorld } from '@/lib/version';
import {
  LM_STUDIO_PROBE_ENDPOINT,
  LM_STUDIO_PROBE_SEED,
  MINIMAL_TOOL_ACTION,
  createProbeTransport,
  prepareNarrationToolCallReview,
  runNarrationToolCallBatch,
  runNarrationToolCallTrial,
  type ProbeTrialEvidence,
} from './narration-tool-call-probe';

const root = process.cwd();
const localRequestTimeoutMs = 180_000;
const args = process.argv.slice(2);
const cloud = args.length === 1 && args[0] === '--cloud';
const localModel = args[0] === '--lm-studio' && args.length === 2 ? args[1].trim() : '';
const minimalModel = args[0] === '--minimal-tools' && args.length === 2 ? args[1].trim() : '';
if (args.length && !cloud && !localModel && !minimalModel) {
  throw new Error('Use --cloud, --lm-studio <model>, or --minimal-tools <model>.');
}

const sourceRevision = execFileSync('git', [
  '-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'rev-parse', 'HEAD',
], { cwd: root, encoding: 'utf8' }).trim();
const fixturePath = path.join(root, 'testing', 'baseline', 'sedge-landing.json');
const world = migrateWorld(JSON.parse(readFileSync(fixturePath, 'utf8')));
async function runMinimalBatch() {
  const started = performance.now();
  const trials: ProbeTrialEvidence[] = [];
  const transport = createProbeTransport({ endpoint: LM_STUDIO_PROBE_ENDPOINT });
  for (let run = 1; run <= 2; run++) {
    const trial = await runNarrationToolCallTrial({
      caseId: `minimal-${run}`,
      action: MINIMAL_TOOL_ACTION,
      sourceRevision,
      world,
      transport,
      model: minimalModel,
      seed: LM_STUDIO_PROBE_SEED,
      promptMode: 'minimal',
      nineCharacterCallIds: true,
      requestTimeoutMs: localRequestTimeoutMs,
    });
    trials.push(trial);
    if (trial.failure?.kind === 'endpoint_rejection') break;
  }
  return { trials, durationMs: performance.now() - started };
}

const evidence = minimalModel
  ? {
      kind: 'narration-tool-call-minimal-batch',
      sourceRevision,
      endpoint: LM_STUDIO_PROBE_ENDPOINT,
      model: minimalModel,
      requestTimeoutMs: localRequestTimeoutMs,
      seed: LM_STUDIO_PROBE_SEED,
      batch: await runMinimalBatch(),
    }
  : localModel
  ? {
      kind: 'narration-tool-call-lm-studio-batch',
      sourceRevision,
      endpoint: LM_STUDIO_PROBE_ENDPOINT,
      model: localModel,
      requestTimeoutMs: localRequestTimeoutMs,
      seed: LM_STUDIO_PROBE_SEED,
      batch: await runNarrationToolCallBatch({
        sourceRevision,
        world,
        model: localModel,
        nineCharacterCallIds: true,
        requestTimeoutMs: localRequestTimeoutMs,
        seed: LM_STUDIO_PROBE_SEED,
        transport: createProbeTransport({ endpoint: LM_STUDIO_PROBE_ENDPOINT }),
      }),
    }
  : cloud
  ? {
      kind: 'narration-tool-call-cloud-batch',
      sourceRevision,
      cloudBehaviorUntested: false,
      batch: await runNarrationToolCallBatch({
        sourceRevision,
        world,
        transport: createProbeTransport({ token: process.env.FORMAMORPH_PROBE_TOKEN }),
      }),
    }
  : prepareNarrationToolCallReview(world, sourceRevision);

const outputDir = path.join(root, 'testing', 'baseline', 'runs', 'narration-tool-call-probe');
mkdirSync(outputDir, { recursive: true });
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const outputKind = minimalModel ? 'minimal-batch' : localModel ? 'lm-studio-batch' : cloud ? 'cloud-batch' : 'preparation';
const outputPath = path.join(outputDir, `${outputKind}-${stamp}.json`);
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

console.log(outputPath);
if (!cloud && !localModel && !minimalModel) console.log('Offline preparation complete; no network requests were made.');
