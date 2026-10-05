// Which tests a ticket's change can affect, beyond what vitest's import walk sees (scripts/affectedTests.mjs).
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** Above this many characters of paths, a gate runs on everything: Windows caps a command line at 32,767. */
export const MAX_ARGS_LENGTH = 30000;

/** A git command's NUL-separated file list. */
export const gitFiles = (command, ...args) =>
  execFileSync('git', [command, '-z', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);

/**
 * The files changed in the working tree since `base`, new files included, deleted files left out. The working tree
 * counts so the gates see uncommitted edits; in prepare the tree is clean, so this equals `base...HEAD`.
 */
export const changedSince = (base) => [
  ...gitFiles('diff', '--name-only', '--diff-filter=d', base),
  ...gitFiles('ls-files', '--others', '--exclude-standard'),
];

/** Tests whose result depends on files they don't import. The ticket test gate runs them every time. */
export const ALWAYS_RUN = {
  'scripts/buildDecision.test.mjs': 'scans every tracked source file and glob import to keep the build skip set honest',
  'scripts/changelogFormat.test.mjs': 'reads docs/Changelog.md and runs scripts/extractReleaseNotes.mjs as a child process',
  'scripts/testSelection.test.mjs': 'scans every test and source file to keep these lists complete',
  'site/bundleBoundary.test.ts': 'scans the site and app sources for imports',
  'site/supporterTokens.test.ts': 'reads the app and site stylesheets',
  'src/components/FullscreenShell.test.tsx': 'reads view sources and src/index.css',
  'src/components/formaquestion/searchNaming.test.ts': 'reads AskParts.tsx, helpSession.ts and three docs pages, which it does not import',
  'src/components/menu/WebVersionChangelog.test.tsx': 'reads src/index.css',
  'src/lib/aiRequest/localEngineImageDrop.test.ts': 'reads electron/llmEngine.cjs',
  'src/lib/bundledFingerprint.test.ts': 'scans src/defaultworlds and reads the shipped avatars',
  'src/lib/codeHighlight.test.ts': 'reads src/index.css',
  'src/lib/docs/bundledDocsIndex.test.ts': 'scans src for the Docs Index loader',
  'src/lib/formaquestion/helpSettings.test.ts': 'reads helpSession.ts, which it does not import',
  'src/lib/helpTopics.test.ts': 'checks that each help topic page exists in docs/',
  'src/lib/personaReaders.test.ts': 'scans src/components/game sources',
  'src/lib/scrollGuard.test.ts': 'scans every src file for native overflow scrollers',
  'src/lib/supporterTokens.test.ts': 'reads src/index.css',
  'src/lib/surface/surfaceReportChecks.test.ts': 'scans every src file for surface reports',
  'src/lib/useResolvedWorld.playerName.test.tsx': 'reads src/views/GameViewer.tsx',
  'src/lib/viewportSizing.test.ts': 'reads view sources and src/index.css',
  'src/lib/worldSearchLabels.test.ts': 'scans src/managers sources',
  'src/managers/fieldLabels.test.ts': 'scans src/managers sources',
};

/** Tests, and modules that tests import, that read from disk, but only what the module graph already covers. */
export const GRAPH_COVERED = {
  'electron/modelDownload.test.mjs': 'reads only its own temp folder',
  'electron/modelMove.test.mjs': 'reads only its own temp folder',
  'electron/modelScan.test.mjs': 'reads only its own temp folder',
  'scripts/typecheck.test.mjs': 'reads only its own temp folder',
  'scripts/versionSiteImages.test.mjs': 'reads only its own temp folder',
  'testing/baseline/harness/planning-parser-probe.test.ts': 'reads files only under PARSER_PROBE=1',
  'electron/modelDownload.cjs': 'reads only the paths its caller passes',
  'electron/modelMove.cjs': 'reads only the paths its caller passes',
  'electron/modelScan.cjs': 'reads only the paths its caller passes',
  'scripts/typecheck.mjs': 'checks only the folder its caller passes; runs git only in mainCheckoutRoot, which no test calls',
  'scripts/versionSiteImages.mjs': 'reads only the folder its caller passes',
  'scripts/copySweep.mjs': 'reads files only in its command-line sweep, which no test calls',
  'scripts/testSelection.mjs': 'runs git only in the helpers the gate scripts call',
  'vite.config.js': 'a change to it runs the full suite',
};

/**
 * A changed path that matches a glob adds its files to `vitest related`. Each entry covers a `?query` import, a
 * fixture read by path, or a forked process, which vitest's import walk never follows. A source file listed here
 * selects its importers.
 */
export const PATH_TRIGGERS = {
  'docs/*.md': ['src/lib/docs/bundledDocsIndex.ts', 'src/lib/docs/docsCoverage.test.ts', 'src/lib/docs/bundledDocsIndex.test.ts'],
  'src/index.css': ['src/lib/landingPulse.test.ts'],
  'src/defaultworlds/*.json': ['src/services/WorldStorageService.ts'],
  'src/defaultworlds/emberwatch.json': ['src/lib/emberwatchWorld.test.ts'],
  'src/defaultworlds/open-chat.json': ['src/lib/openChatWorld.test.ts'],
  'src/lib/formaquestion/mascotAssets/*.webp': ['src/lib/formaquestion/mascotAssets.ts'],
  'testing/parity/turn-pipeline-parity.json': ['src/lib/turnPipeline/parityFixture.test.ts', 'src/lib/turnPipeline/parityTestInputs.ts'],
  'testing/baseline/help-baseline-cases.json': ['testing/baseline/harness/help-baseline-cases.ts'],
  'testing/baseline/help-recall-blind-cases.json': ['testing/baseline/harness/help-recall-cases.ts'],
  // The proxy forks the host as a child process instead of importing it.
  'electron/llmEngineHost.cjs': ['electron/llmEngineProxy.cjs'],
  'public/default-avatar.vrm': ['src/lib/avatarLicenseGate.bundledAvatars.test.ts'],
  'build-assets/alternate-avatar.vrm': ['src/lib/avatarLicenseGate.bundledAvatars.test.ts'],
};

const REQUIRE_CALL = /\brequire\(\s*([^)]*?)\s*\)/g;
const LITERAL = /^(['"])([^'"]+)\1$/;

/** The relative `require` targets of a CommonJS source, resolved against `file`, plus each call whose argument isn't a literal. */
export function cjsRequires(file, source) {
  const targets = [];
  const dynamic = [];
  for (const [call, argument] of source.matchAll(REQUIRE_CALL)) {
    const literal = argument.match(LITERAL);
    if (!literal) dynamic.push(call);
    else if (literal[2].startsWith('.')) targets.push(path.posix.join(path.posix.dirname(file), literal[2]));
  }
  return { targets, dynamic };
}

/** Each required CommonJS file mapped to the files that require it. `sources` maps repo paths to their text. */
export function requirersOf(sources) {
  const requirers = new Map();
  for (const [file, source] of Object.entries(sources)) {
    for (const target of cjsRequires(file, source).targets) {
      if (!requirers.has(target)) requirers.set(target, new Set());
      requirers.get(target).add(file);
    }
  }
  return requirers;
}

/** The paths to hand `vitest related`: the changed files, everything they reach through the rules above, and ALWAYS_RUN. */
export function relatedFiles(changed, requirers) {
  const out = new Set();
  const queue = [...changed];
  while (queue.length) {
    const file = queue.pop();
    if (out.has(file)) continue;
    out.add(file);
    for (const [glob, files] of Object.entries(PATH_TRIGGERS)) if (path.posix.matchesGlob(file, glob)) queue.push(...files);
    queue.push(...(requirers.get(file) ?? []));
    const snapshot = file.match(/^(.*)__snapshots__\/(.+)\.snap$/);
    if (snapshot) queue.push(snapshot[1] + snapshot[2]);
  }
  for (const test of Object.keys(ALWAYS_RUN)) out.add(test);
  return [...out].sort();
}
