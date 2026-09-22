import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { migrateWorld } from '@/lib/version';
import {
  createCloudProbeTransport,
  prepareNarrationToolCallReview,
  runNarrationToolCallBatch,
} from './narration-tool-call-probe';

const root = process.cwd();
const cloud = process.argv.slice(2).includes('--cloud');
const unexpected = process.argv.slice(2).filter((argument) => argument !== '--cloud');
if (unexpected.length) throw new Error(`Unknown option: ${unexpected.join(', ')}`);

const sourceRevision = execFileSync('git', [
  '-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'rev-parse', 'HEAD',
], { cwd: root, encoding: 'utf8' }).trim();
const fixturePath = path.join(root, 'testing', 'baseline', 'sedge-landing.json');
const world = migrateWorld(JSON.parse(readFileSync(fixturePath, 'utf8')));
const evidence = cloud
  ? {
      kind: 'narration-tool-call-cloud-batch',
      sourceRevision,
      cloudBehaviorUntested: false,
      batch: await runNarrationToolCallBatch({
        sourceRevision,
        world,
        transport: createCloudProbeTransport({ token: process.env.FORMAMORPH_PROBE_TOKEN }),
      }),
    }
  : prepareNarrationToolCallReview(world, sourceRevision);

const outputDir = path.join(root, 'testing', 'baseline', 'runs', 'narration-tool-call-probe');
mkdirSync(outputDir, { recursive: true });
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const outputPath = path.join(outputDir, `${cloud ? 'cloud-batch' : 'preparation'}-${stamp}.json`);
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

console.log(outputPath);
if (!cloud) console.log('Offline preparation complete; no network requests were made.');
