// Cuts the mascot's layered file into the default rig's bundled WebP layers.
//
// One-off tool: run it only when the art changes, then commit the result. It drives headless GIMP 3.x
// through scripts/cutMascotRig.py under a timeout, because a bad procedure call hangs the console
// instead of exiting.
//
// Usage: node scripts/cutMascotRig.mjs [path/to/formaquestion.xcf] (default: the mascot spec's assets)

import { spawnSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const SOURCE = path.resolve(process.argv[2] ?? 'docs-internal/specs/formaquestion-mascot/assets/formaquestion.xcf');
const OUT = path.resolve('src/lib/formaquestion/mascotAssets');
const SCRIPT = path.resolve('scripts/cutMascotRig.py');
const TIMEOUT_MS = 180_000;

const GIMP = process.env.GIMP_CONSOLE
  ?? path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'GIMP 3', 'bin', 'gimp-console.exe');

if (!existsSync(SOURCE)) throw new Error(`No layered file at ${SOURCE}.`);
if (!existsSync(GIMP)) throw new Error(`No GIMP console at ${GIMP}. Set GIMP_CONSOLE.`);
mkdirSync(OUT, { recursive: true });

const slash = (p) => p.replaceAll('\\', '/');
const code = `SRC = r'${slash(SOURCE)}'; OUT = r'${slash(OUT)}'; exec(open(r'${slash(SCRIPT)}').read())`;

const run = spawnSync(GIMP, ['-i', '--quit', '--batch-interpreter=python-fu-eval', '-b', code], {
  encoding: 'utf8',
  timeout: TIMEOUT_MS,
});
if (process.platform === 'win32') spawnSync('taskkill', ['/F', '/IM', 'gimp-console.exe'], { stdio: 'ignore' });

const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
if (run.error || /Traceback|calling error/.test(output)) {
  console.error(output);
  throw new Error(run.error ? `GIMP did not finish: ${run.error.message}` : 'The cut script failed.');
}
console.log(`Cut ${SOURCE} into ${OUT}.`);
