import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { migrateWorld } from '@/lib/version';
import {
  LM_STUDIO_PROBE_ENDPOINT,
  LM_STUDIO_PROBE_SEED,
  createProbeTransport,
  prepareNarrationToolCallReview,
  runNarrationToolCallBatch,
} from './narration-tool-call-probe';

const root = process.cwd();
const args = process.argv.slice(2);
const cloud = args.length === 1 && args[0] === '--cloud';
const localModel = args[0] === '--lm-studio' && args.length === 2 ? args[1].trim() : '';
if (args.length && !cloud && !localModel) {
  throw new Error('Use --cloud or --lm-studio <model>.');
}

const sourceRevision = execFileSync('git', [
  '-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'rev-parse', 'HEAD',
], { cwd: root, encoding: 'utf8' }).trim();
const fixturePath = path.join(root, 'testing', 'baseline', 'sedge-landing.json');
const world = migrateWorld(JSON.parse(readFileSync(fixturePath, 'utf8')));
const evidence = localModel
  ? {
      kind: 'narration-tool-call-lm-studio-batch',
      sourceRevision,
      endpoint: LM_STUDIO_PROBE_ENDPOINT,
      model: localModel,
      seed: LM_STUDIO_PROBE_SEED,
      batch: await runNarrationToolCallBatch({
        sourceRevision,
        world,
        model: localModel,
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
const outputKind = localModel ? 'lm-studio-batch' : cloud ? 'cloud-batch' : 'preparation';
const outputPath = path.join(outputDir, `${outputKind}-${stamp}.json`);
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

console.log(outputPath);
if (!cloud && !localModel) console.log('Offline preparation complete; no network requests were made.');
