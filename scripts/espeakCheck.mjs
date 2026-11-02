// Fails a build whose output holds eSpeak NG or the `phonemizer` package that compiles it in (GPL-3.0).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Names that only the eSpeak NG glue code and data carry. Plain "espeak" is not a marker: "bespeak" is English.
const MARKERS = ['phonemizer', 'eSpeakNG', 'eSpeak NG', 'espeak_', 'espeakEVENT', 'espeak-ng-data'];

/** Each file under `outDir` that holds a marker, as `path: marker`. */
export function espeakProblems(outDir) {
  if (!existsSync(outDir)) return [];
  const problems = [];
  for (const entry of readdirSync(outDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = path.join(entry.parentPath, entry.name);
    const text = readFileSync(full, 'latin1');
    const marker = MARKERS.find((name) => text.includes(name));
    if (marker) problems.push(`${path.relative(outDir, full).split(path.sep).join('/')}: ${marker}`);
  }
  return problems;
}

export function espeakCheck() {
  let outDir;
  return {
    name: 'espeak-check',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const problems = espeakProblems(outDir);
      if (problems.length) throw new Error(`eSpeak NG is in the build output (GPL-3.0). ${problems.join('; ')}`);
    },
  };
}
