// Which tests a ticket's change can affect, beyond what vitest's import walk sees (scripts/affectedTests.mjs).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Above this many characters of paths, a gate runs on everything: Windows caps a command line at 32,767. */
export const MAX_ARGS_LENGTH = 30000;

/** Whether these paths fit on one command line. */
export const fitsCommandLine = (paths) => paths.join(' ').length <= MAX_ARGS_LENGTH;

/** A git command's NUL-separated file list. */
export const gitFiles = (command, ...args) =>
  execFileSync('git', [command, '-z', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);

/** The paths in a `@<path>` change source: a file of newline-separated repo paths, in place of a git base. */
const listedFiles = (source) => readFileSync(source.slice(1), 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);

/**
 * The files changed in the working tree since `base`, new files included, deleted files left out. The working tree
 * counts so the gates see uncommitted edits; in prepare the tree is clean, so this equals `base...HEAD`.
 */
export const changedSince = (base) => (base.startsWith('@') ? listedFiles(base).filter((file) => existsSync(file)) : [
  ...gitFiles('diff', '--name-only', '--diff-filter=d', base),
  ...gitFiles('ls-files', '--others', '--exclude-standard'),
]);

/** `changedSince` with deleted files kept, a renamed file's old path among them. */
export const touchedSince = (base) => (base.startsWith('@') ? listedFiles(base) : [
  ...gitFiles('diff', '--name-only', '--no-renames', base),
  ...gitFiles('ls-files', '--others', '--exclude-standard'),
]);

/**
 * Tests whose result depends on files they don't import. The ticket test gate runs them every time. A scan of one file
 * at a time for a form to forbid belongs in ESLint; what stays here reads docs, CSS or worlds, needs many files at once, or pins what a file must say.
 */
export const ALWAYS_RUN = {
  'scripts/buildDecision.test.mjs': 'scans every tracked source file and glob import to keep the build skip set honest',
  'scripts/changelogFormat.test.mjs': 'reads docs/Changelog.md and runs scripts/extractReleaseNotes.mjs as a child process',
  'scripts/noPersonalPaths.test.mjs': 'scans every tracked text file for personal details',
  'scripts/testSelection.test.mjs': 'scans every test and source file to keep these lists complete',
  'site/bundleBoundary.test.ts': 'scans the site and app sources for imports',
  'site/supporterTokens.test.ts': 'reads the app and site stylesheets',
  'src/components/menu/WebVersionChangelog.test.tsx': 'reads src/index.css',
  'src/lib/aiRequest/localEngineImageDrop.test.ts': 'reads electron/llmEngine.cjs',
  'src/lib/bundledFingerprint.test.ts': 'scans src/defaultworlds and reads the shipped avatars',
  'src/lib/codeHighlight.test.ts': 'reads src/index.css',
  'src/lib/helpTopics.test.ts': 'checks that each help topic page exists in docs/',
  'src/lib/personaReaders.test.ts': 'pins the lists GameViewer.tsx, GamePanels.tsx and liveScene.ts hand each reader',
  'src/lib/supporterTokens.test.ts': 'reads src/index.css',
  'src/lib/surface/surfaceReportChecks.test.ts': 'scans every src file for surface reports',
  'src/lib/useResolvedWorld.playerName.test.tsx': 'pins how src/views/GameViewer.tsx calls resolveOpening',
  'src/lib/viewportSizing.test.ts': 'reads view sources and src/index.css',
  'src/lib/worldSearchLabels.test.ts': 'scans src/managers sources',
  'src/test/tokenCorpus.ts': 'scans every src file and bundled world for prompt tokens; selects promptTokenGrammar.test.ts',
};

/** Tests, and modules that tests import, that read from disk, but only what the module graph already covers. */
export const GRAPH_COVERED = {
  'electron/modelDownload.test.mjs': 'reads only its own temp folder',
  'electron/modelMove.test.mjs': 'reads only its own temp folder',
  'electron/modelScan.test.mjs': 'reads only its own temp folder',
  'electron/profileMerge.test.mjs': 'reads only its own temp folder',
  'electron/profileMergeModelFolder.test.mjs': 'reads only its own temp folder',
  'scripts/typecheck.test.mjs': 'reads only its own temp folder',
  'scripts/slowTestReporter.mjs': 'reads only its timing cache in node_modules/.cache',
  'scripts/versionSiteImages.test.mjs': 'reads only its own temp folder',
  'scripts/moveReach.test.mjs':'reads its own temp folder and walks src/lib/uuid.ts, whose closure it never asserts',
  'testing/baseline/harness/planning-parser-probe.test.ts': 'reads files only under PARSER_PROBE=1',
  'src/test/bundledRevisions.ts': 'reads the worlds from fixed commits, which no change alters',
  'electron/modelDownload.cjs': 'reads only the paths its caller passes',
  'electron/modelMove.cjs': 'reads only the paths its caller passes',
  'electron/modelScan.cjs': 'reads only the paths its caller passes',
  'electron/llmEngine.cjs': 'writes and reads only its work folder under the root its caller passes',
  'electron/llamaServer.cjs': 'checks only for the bundled binary, which tests replace',
  'electron/llmEngine.test.mjs': 'reads only its own temp folder',
  'electron/llamaServer.test.mjs': 'reads only its own temp folder',
  'scripts/typecheck.mjs':'checks only the folder its caller passes; runs git only in mainCheckoutRoot, which no test calls',
  'scripts/versionSiteImages.mjs': 'reads only the folder its caller passes',
  'scripts/copySweep.mjs': 'reads files only in its command-line sweep, which no test calls',
  'scripts/moveReach.mjs': 'reads only the probe file its caller passes; the compiler walks the files the probe names',
  'scripts/testSelection.mjs': 'runs git only in the helpers the gate scripts call',
  'scripts/runTests.mjs': 'reads only its own temp reports and runs vitest and git in the folder its caller passes',
  'scripts/runTests.test.mjs': 'reads only its own temp folder',
  'scripts/runOutcomeReporter.mjs': 'writes only the file its runner names; a test of it runs real vitest',
  'scripts/selectionReplay.mjs': 'reads its clone and its results; a test runs it on its own temp repo',
  'scripts/selectionReplay.test.mjs': 'reads only its own temp folders',
  'scripts/selectedTestsReporter.mjs': 'writes only the file its command names; a test of it runs real vitest',
  'scripts/testLedger.mjs': 'reads the tree and its raw output in its command-line run; a test reads only its own temp ledger',
  'scripts/testLedger.test.mjs': 'reads only its own temp folders',
  'scripts/testLedgerHistory.mjs': 'reads gh and transcripts only in gatherHistory, which no test calls; a test runs gatherFixes on its own temp repo',
  'scripts/testLedgerReporter.mjs': 'writes only the file its command names; a test of it uses given modules',
  'scripts/fetchPinnedCommits.mjs': 'runs git only in its command-line run, which no test calls',
  'vite.config.js': 'a change to it runs the full suite',
  'scripts/shipBundledWorlds.mjs': 'reads only the world file its caller names; a change to it runs the full suite',
  'scripts/stripSeededWorlds.mjs': 'reads only the world file an import names; a change to it runs the full suite',
  'scripts/shipNotices.mjs': 'reads the notices file its caller names and the package.json of each module; a change to it runs the full suite',
  'scripts/bundledAvatarCheck.mjs': 'checks only the output folder its build names; a change to it runs the full suite',
  'scripts/espeakCheck.mjs': 'checks only the output folder its build names; a change to it runs the full suite',
  'scripts/noticesList.mjs': 'reads only the folders its caller names',
  'scripts/noticesList.test.ts': 'reads only its own temp folders',
  'scripts/bundledWorldHashes.mjs': 'reads only the world file an import names; a change to it runs the full suite',
  'scripts/stripWorldImages.mjs': 'reads files only in its command-line run, which no test calls; a change to it runs the full suite',
  'src/lib/shippedWorld.ts': 'reads its own import graph and its cache in node_modules/.cache',
  'scripts/bundledRevisions.ts': 'reads src/defaultworlds and its git history, which change only with a world file; the world trigger runs its test',
};

/**
 * A changed path that matches a glob adds its files to `vitest related`. Each entry covers a `?query` import, a
 * fixture read by path, or a forked process, which vitest's import walk never follows. A source file listed here
 * selects its importers.
 */
export const PATH_TRIGGERS = {
  'docs/*.md': ['src/lib/docs/bundledDocsIndex.ts', 'src/lib/docs/docsCoverage.test.ts', 'src/lib/docs/bundledDocsIndex.test.ts', 'src/lib/codeGuideLinks.test.ts'],
  'src/index.css': ['src/lib/landingPulse.test.ts', 'electron/windowChrome.test.mjs'],
  'THIRD-PARTY-NOTICES.md': ['src/lib/itemIcons.test.ts', 'scripts/shipNotices.test.ts', 'src/lib/noticesFormat.test.ts', 'src/components/modals/LicensesPanel.test.tsx'],
  'index.html': ['src/components/themeBootstrap.test.ts'],
  'src/lib/tts/g2p/cmudict.dict': ['src/lib/tts/phonemeStep.ts', 'src/lib/tts/arpabet.test.ts', 'src/lib/tts/textToPhonemes.test.ts', 'src/lib/tts/homographs.test.ts', 'src/lib/tts/homographs.wordTable.test.ts'],
  'src/lib/tts/g2p/*.onnx': ['src/lib/tts/phonemeStep.ts', 'src/lib/tts/g2pModel.test.ts'],
  'testing/g2p/pins.json': ['src/lib/tts/arpabet.test.ts'],
  'testing/g2p/sets/*.json': ['testing/g2p/score.mjs', 'testing/g2p/score.test.ts'],
  'testing/g2p/espeak-reference.json': ['testing/g2p/score.test.ts'],
  'src/defaultworlds/*.json': ['src/lib/bundledWorldText.ts', 'src/test/bundledWorldFiles.ts', 'src/lib/bundledPlayerStats.test.ts', 'src/lib/bundledWorlds.test.ts', 'src/views/GameViewer.bundledSaves.test.tsx', 'src/contexts/GameplayContext.bundledSaves.test.tsx', 'src/lib/ownerTreeParity.test.ts', 'src/lib/seedRule.bundled.test.ts', 'src/lib/shippedWorld.test.ts', 'scripts/shipBundledWorlds.test.ts', 'scripts/bundledWorldHashes.test.ts', 'scripts/bundledRevisions.test.ts', 'testing/baseline/harness/world-question-cases.ts', 'testing/baseline/harness/world-question-cases.test.ts'],
  'src/lib/__parity__/*.json': ['src/lib/ownerTreeParity.test.ts'],
  'src/lib/formaquestion/__bodies__/*.json': ['src/lib/formaquestion/helpSession.parity.test.ts'],
  'src/defaultworlds/drone.json': ['src/lib/droneWorld.test.ts', 'testing/art-harness/artHarness.test.ts'],
  'src/defaultworlds/emberwatch.json': ['src/lib/emberwatchWorld.test.ts', 'src/lib/emberwatchWorld.scripts.test.ts', 'src/views/GameViewer.emberwatchItems.test.tsx', 'src/components/game/GamePrompts.globalBlocks.test.ts'],
  'src/defaultworlds/slime.json': ['src/lib/slimeWorld.test.ts'],
  'src/defaultworlds/rampage.json': ['src/lib/rampageWorld.test.ts', 'src/components/game/GamePrompts.globalBlocks.test.ts'],
  'src/defaultworlds/open-chat.json': ['src/lib/openChatWorld.test.ts', 'src/components/game/GamePrompts.globalBlocks.test.ts'],
  'src/defaultworlds/sugarscape.json': ['src/lib/sugarscapeWorld.test.ts'],
  'src/defaultworlds/valentines.json': ['src/lib/valentinesWorld.test.ts', 'src/services/WorldStorageService.strippedSeed.test.ts'],
  'src/defaultworlds/veilwood.json': ['src/lib/veilwoodWorld.test.ts'],
  'src/lib/formaquestion/mascotAssets/*.webp': ['src/lib/formaquestion/mascotAssets.ts'],
  'testing/parity/turn-pipeline-parity.json': ['src/lib/turnPipeline/parityFixture.test.ts', 'src/lib/turnPipeline/parityTestInputs.ts'],
  'testing/baseline/help-baseline-cases.json': ['testing/baseline/harness/help-baseline-cases.ts'],
  'testing/baseline/help-recall-blind-cases.json': ['testing/baseline/harness/help-recall-cases.ts'],
  'testing/baseline/help-intent-cases.json': ['testing/baseline/harness/help-intent-score.ts'],
  // The proxy forks the host as a child process instead of importing it.
  'electron/llmEngineHost.cjs': ['electron/llmEngineProxy.cjs'],
  // The fake llama-server replays the run recorded at the pinned tag; the stream parser test reads the same files.
  'electron/fixtures/llama-server/*.json': ['electron/fakeLlamaServer.mjs', 'src/lib/aiRequest/aiStream.llamaServer.test.ts'],
  'scripts/llamaServerPin.json': ['electron/fakeLlamaServer.mjs', 'scripts/fetchLlamaServer.mjs'],
  'scripts/fixtures/llamaServerAssets.*.json': ['scripts/fetchLlamaServer.test.mjs'],
  // The pin load test runs the generator as a child process.
  'testing/editor-speed/genLargeWorld.mjs': ['src/test/pinWorld.ts'],
  // The notices test checks that each avatar file the notices name exists.
  'public/default-avatar.vrm': ['src/lib/avatarLicenseGate.bundledAvatars.test.ts', 'src/lib/avatarPublish.praline.test.ts', 'scripts/shipNotices.test.ts', 'src/lib/vrmTextureFailure.test.ts'],
  'build-assets/alternate-avatar.vrm': ['src/lib/avatarLicenseGate.bundledAvatars.test.ts', 'scripts/shipNotices.test.ts'],
  'build-assets/praline-avatar.vrm': ['src/lib/avatarLicenseGate.bundledAvatars.test.ts', 'src/lib/avatarPublish.praline.test.ts', 'scripts/shipNotices.test.ts'],
  // The notices test reads this config and, through the real root, this map.
  'vite.site.config.js': ['scripts/shipNotices.test.ts'],
  'legal/notices-map.json': ['scripts/shipNotices.test.ts'],
  'package-lock.json': ['src/components/ui/radixSingleCopy.test.ts'],
  '.github/workflows/ci.yml': ['scripts/ciWorkflow.test.mjs'],
  '.github/workflows/release.yml': ['scripts/bundledAvatarCheck.test.mjs'],
  '.github/workflows/pages.yml': ['scripts/bundledAvatarCheck.test.mjs'],
  'vite.config.js': ['scripts/espeakCheck.test.mjs'],
  // The runner test loads this reporter by path through real vitest.
  'scripts/runOutcomeReporter.mjs': ['scripts/runTests.test.mjs'],
  // The replay test loads this reporter by path through real vitest.
  'scripts/selectedTestsReporter.mjs': ['scripts/selectionReplay.test.mjs'],
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

/** The gate's options after `<base>`, or null when they do not parse; a project run passes when it has no related file. */
export function gateOptions(args) {
  const [flag, name, ...extra] = args;
  if (extra.length) return null;
  if (flag === undefined) return { list: false, vitest: [] };
  if (flag === '--list' && name === undefined) return { list: true, vitest: [] };
  if (flag === '--project' && name && !name.startsWith('-')) return { list: false, vitest: ['--project', name, '--passWithNoTests'] };
  return null;
}
