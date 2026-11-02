// The Test Ledger's failure history: CI logs, git, rerun records and session transcripts.
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TEST_FILE } from './testLedgerRecords.mjs';

// `gh run view --log-failed` writes the escape character as a literal `^[`.
const ANSI = /(?:\u001b|\^\[)\[[0-9;]*m/g;
// A plain log writes the project as `|dom|`; a colored one, as CI's, writes it bare. `[ file ]` marks a failed suite.
const FAIL_LINE = /^(?:.*\s)?FAIL\s+(?:\|?[^|\s]+\|?\s+)?(\S+\.test\.\w+)(?:\s+\[.*\]|\s+>\s+(.+?))?\s*$/gm;
const UNHANDLED = /This error originated in "([^"]+\.test\.\w+)" test file/g;
const REPO_PATH = /(?:^|[\\/])((?:src|scripts|site|electron|testing)[\\/].+)$/;
const SOURCE_DIR = /^(?:src|site|electron|scripts|hosting)\//;
const NOT_SOURCE = /\.test\.|^src\/test\/|\.md$|__snapshots__/;
const FIX_SUBJECT = /^Fix\b/;
const LOG_GONE = /HTTP 410|log not found/;
const sessionKey = ({ session, file, test, kind }) => `${session}|${file}|${test}|${kind}`;

const CI_RUN_LIMIT = 1000;

/** This repo's transcript folders: the main checkout and its worktrees, not a sibling whose name starts the same. */
export const isRepoProject = (name, slug) => name === slug || name.startsWith(`${slug}--claude-`);

const repoPath = (file) => (file.match(REPO_PATH)?.[1] ?? file).replace(/\\/g, '/');

/** The failures a vitest output names: one per FAIL line, and one per file an unhandled error came from. */
export function parseVitestFailures(text) {
  const clean = text.replace(ANSI, '').replace(/\r/g, '');
  const failures = new Map();
  for (const [, file, name] of clean.matchAll(FAIL_LINE)) {
    const repo = repoPath(file);
    const test = name ? `${repo} > ${name}` : null;
    failures.set(`${repo}|${test}`, { file: repo, test, kind: 'failed' });
  }
  for (const [, file] of clean.matchAll(UNHANDLED)) {
    const repo = repoPath(file);
    failures.set(`${repo}|unhandled`, { file: repo, test: null, kind: 'unhandled' });
  }
  return [...failures.values()];
}

/** Rerun records as history events; a line that is not JSON is skipped. */
export function parseRerunRecords(jsonl) {
  return jsonl.split('\n').filter(Boolean).flatMap((line) => {
    try {
      const { test, file, result, at, sha, source, run } = JSON.parse(line);
      return [{ source: 'rerun', file, test, result, at, sha, origin: source, run: run ?? null }];
    } catch {
      return [];
    }
  });
}

/** The failures in one transcript line: only tool output counts, since a message can quote a FAIL line. */
export function sessionEvents(line) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return [];
  }
  if (!Array.isArray(entry.message?.content)) return [];
  const results = entry.message.content.filter((part) => part.type === 'tool_result');
  const texts = results.flatMap((part) => (typeof part.content === 'string' ? [part.content]
    : Array.isArray(part.content) ? part.content.filter((inner) => inner.type === 'text').map((inner) => inner.text) : []));
  return parseVitestFailures(texts.join('\n')).map((failure) => ({ source: 'session', at: entry.timestamp, session: entry.sessionId, ...failure }));
}

/** Commits from `git log --format=%x00%H%x09%cI%x09%s --name-status -M`, newest first. */
export function parseGitLog(text) {
  return text.split('\0').filter((block) => block.trim()).map((block) => {
    const [header, ...rest] = block.split('\n');
    const [sha, at, ...subject] = header.split('\t');
    const changes = rest.filter(Boolean).map((line) => {
      const [status, first, second] = line.split('\t');
      return { status: status[0], path: second ?? first, from: second ? first : null };
    });
    return { sha, at, subject: subject.join('\t'), changes };
  });
}

/** Each old path mapped to the current name a chain of renames gives it. `commits` run newest first. */
export function renameChains(commits) {
  const current = new Map();
  for (const { changes } of commits) {
    for (const { status, path: to, from } of changes) {
      if (status === 'R') current.set(from, current.get(to) ?? to);
    }
  }
  return current;
}

/** The text of a unified diff's added lines, with the backslash of an escaped quote dropped. */
export const addedText = (diff) => diff.split('\n')
  .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
  .join('\n').replace(/\\(['"`])/g, '$1');

/** A commit's claim to fix a bug: a Fix subject, a change to a non-test source, and a change to a test. */
export function isFixCommit({ subject, changes }) {
  return FIX_SUBJECT.test(subject)
    && changes.some(({ path: file, status }) => status !== 'D' && SOURCE_DIR.test(file) && !NOT_SOURCE.test(file))
    && changes.some(({ path: file }) => TEST_FILE.test(file));
}

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 30 });

/** Every Fix commit's added test text, under each test file's current name, and the rename chain that gave those names. */
export function gatherFixes(cwd) {
  const commits = parseGitLog(git(['log', '--no-merges', '--format=%x00%H%x09%cI%x09%s', '--name-status', '-M'], cwd));
  const chain = renameChains(commits);
  const fixes = commits.filter(isFixCommit).map((commit) => {
    const files = {};
    for (const { path: file, status, from } of commit.changes.filter((change) => TEST_FILE.test(change.path))) {
      // Both sides of a rename, or git reads the whole file as added.
      const diff = git(['show', '--format=', '--unified=0', '-M', commit.sha, '--', ...(from ? [from] : []), file], cwd);
      files[chain.get(file) ?? file] = { created: status === 'A', added: addedText(diff) };
    }
    return { sha: commit.sha, subject: commit.subject, at: commit.at, files };
  });
  return { fixes, chain };
}

/** The origin repo as `owner/name`; `gh` alone would resolve the upstream fork parent. */
function originRepo(cwd) {
  return git(['remote', 'get-url', 'origin'], cwd).trim().match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/)[1];
}

/**
 * For each red run, every path the commits up to its branch's next green touched, under its current name, with the
 * newest commit that did. `commitsBetween` returns those commits, or throws for a sha this clone does not hold.
 */
export function touchedUntilGreen(runs, commitsBetween, chain) {
  const touched = {};
  let unreachable = 0;
  for (const red of runs.filter((run) => run.conclusion === 'failure')) {
    const green = runs.filter((run) => run.conclusion === 'success' && run.headBranch === red.headBranch && run.createdAt > red.createdAt && run.headSha !== red.headSha)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!green) continue;
    try {
      const paths = {};
      for (const { sha, subject, changes } of commitsBetween(red.headSha, green.headSha)) {
        for (const { path: file } of changes) paths[chain.get(file) ?? file] ??= { sha, subject };
      }
      touched[red.databaseId] = paths;
    } catch {
      unreachable++;
    }
  }
  return { touched, unreachable };
}

const failureLines = (log) => log.split('\n').filter((line) => line.includes('FAIL') || line.includes('originated in')).join('\n');

/** Failed CI runs' test failures. Each run's failure lines are cached, since `gh` reads about one log per second. */
function gatherCi(dir, cwd, chain) {
  const repo = originRepo(cwd);
  const runs = JSON.parse(execFileSync('gh', ['run', 'list', '--repo', repo, '--workflow', 'ci.yml', '--limit', String(CI_RUN_LIMIT), '--json', 'databaseId,conclusion,createdAt,headSha,headBranch'], { encoding: 'utf8', maxBuffer: 1 << 28 }));
  const cacheDir = path.join(dir, 'ci');
  mkdirSync(cacheDir, { recursive: true });
  const events = [];
  let logsMissing = 0;
  let logsFailed = 0;
  for (const run of runs.filter((candidate) => candidate.conclusion === 'failure')) {
    const cache = path.join(cacheDir, `${run.databaseId}.json`);
    if (!existsSync(cache)) {
      try {
        writeFileSync(cache, JSON.stringify(failureLines(execFileSync('gh', ['run', 'view', String(run.databaseId), '--repo', repo, '--log-failed'], { encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] }))));
      } catch (error) {
        // Only an expired log is final; any other failure tries again on the next refresh.
        if (LOG_GONE.test(String(error.stderr))) writeFileSync(cache, 'null');
        else {
          logsFailed++;
          continue;
        }
      }
    }
    const lines = JSON.parse(readFileSync(cache, 'utf8'));
    if (lines === null) logsMissing++;
    for (const failure of parseVitestFailures(lines ?? '')) events.push({ source: 'ci', at: run.createdAt, sha: run.headSha, run: run.databaseId, branch: run.headBranch, ...failure });
  }
  const commitsBetween = (from, to) => parseGitLog(git(['log', '--format=%x00%H%x09%cI%x09%s', '--name-status', '-M', `${from}..${to}`], cwd));
  const { touched, unreachable } = touchedUntilGreen(runs, commitsBetween, chain);
  const dates = runs.map((run) => run.createdAt).sort();
  return {
    events,
    ciTouched: touched,
    meta: { runs: runs.length, failed: runs.filter((run) => run.conclusion === 'failure').length, from: dates[0]?.slice(0, 10), to: dates.at(-1)?.slice(0, 10), logsMissing, logsFailed, unreachable },
  };
}

/** Local rerun records plus every downloaded `test-reruns-shard-N` artifact in `<dir>/rerun-artifacts`. */
function gatherReruns(commonDir, dir) {
  const logs = [path.join(commonDir, 'test-reruns.jsonl')];
  const artifacts = path.join(dir, 'rerun-artifacts');
  if (existsSync(artifacts)) for (const entry of readdirSync(artifacts, { recursive: true })) if (String(entry).endsWith('.jsonl')) logs.push(path.join(artifacts, String(entry)));
  return logs.filter((log) => existsSync(log)).flatMap((log) => parseRerunRecords(readFileSync(log, 'utf8')));
}

/** Downloads the rerun artifacts CI has kept and returns how many failed, which the next refresh tries again. */
function downloadRerunArtifacts(dir, cwd) {
  let failed = 0;
  const repo = originRepo(cwd);
  const names = execFileSync('gh', ['api', '--paginate', `repos/${repo}/actions/artifacts`, '--jq', '.artifacts[] | select(.name | startswith("test-reruns-shard-")) | select(.expired | not) | "\\(.workflow_run.id) \\(.name)"'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  for (const line of names.split('\n').filter(Boolean)) {
    const [run, name] = line.trim().split(' ');
    const target = path.join(dir, 'rerun-artifacts', run, name);
    if (existsSync(target)) continue;
    try {
      execFileSync('gh', ['run', 'download', run, '--repo', repo, '--name', name, '--dir', target], { stdio: 'ignore' });
    } catch {
      failed++;
      rmSync(target, { recursive: true, force: true });
    }
  }
  return failed;
}

/** Runs `onLine` on each line of `file` holding a needle, without decoding the rest: a transcript can hold megabyte image lines. */
export async function scanLines(file, needles, onLine) {
  const matches = (line) => needles.some((needle) => line.includes(needle));
  let carry = Buffer.alloc(0);
  for await (const chunk of createReadStream(file, { highWaterMark: 1 << 20 })) {
    const buffer = carry.length ? Buffer.concat([carry, chunk]) : chunk;
    let start = 0;
    let end;
    while ((end = buffer.indexOf(10, start)) !== -1) {
      const line = buffer.subarray(start, end);
      if (matches(line)) onLine(line.toString('utf8'));
      start = end + 1;
    }
    carry = buffer.subarray(start);
  }
  if (matches(carry)) onLine(carry.toString('utf8'));
}

/** Failures from this repo's session transcripts, worktree sessions included, deduplicated per session. Cached by size and mtime. */
async function gatherSessions(dir, commonDir) {
  const slug = path.dirname(path.resolve(commonDir)).replace(/[^a-zA-Z0-9]/g, '-');
  const projects = path.join(os.homedir(), '.claude', 'projects');
  const cacheFile = path.join(dir, 'sessions.json');
  const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
  const next = {};
  const events = [];
  let files = 0;
  let withFailures = 0;
  for (const project of readdirSync(projects).filter((name) => isRepoProject(name, slug))) {
    for (const entry of readdirSync(path.join(projects, project), { recursive: true })) {
      if (!String(entry).endsWith('.jsonl')) continue;
      const file = path.join(projects, project, String(entry));
      const { size, mtimeMs } = statSync(file);
      const key = `${project}/${entry}`;
      let hits = cache[key]?.size === size && cache[key]?.mtimeMs === mtimeMs ? cache[key].hits : null;
      if (hits === null) {
        const found = new Map();
        await scanLines(file, ['FAIL', 'originated in'], (line) => {
          for (const event of sessionEvents(line)) found.set(sessionKey(event), event);
        });
        hits = [...found.values()];
      }
      next[key] = { size, mtimeMs, hits };
      files++;
      if (hits.length) withFailures++;
      events.push(...hits);
    }
  }
  writeFileSync(cacheFile, JSON.stringify(next));
  const unique = new Map(events.map((event) => [sessionKey(event), event]));
  return { events: [...unique.values()], meta: { files, withFailures } };
}

/** An event with its test file under the name a chain of renames gives it. */
export function underCurrentName(event, chain) {
  const file = chain.get(event.file) ?? event.file;
  return { ...event, file, test: event.test && event.test.replace(event.file, file) };
}

/** Every history source, with old test paths mapped to their current names. */
export async function gatherHistory({ dir, commonDir, cwd }) {
  mkdirSync(dir, { recursive: true });
  const { fixes, chain } = gatherFixes(cwd);
  const ci = gatherCi(dir, cwd, chain);
  const downloadsFailed = downloadRerunArtifacts(dir, cwd);
  const reruns = gatherReruns(commonDir, dir);
  const sessions = await gatherSessions(dir, commonDir);
  return {
    events: [...ci.events, ...reruns, ...sessions.events].map((event) => underCurrentName(event, chain)),
    fixes,
    ciTouched: ci.ciTouched,
    meta: { ci: ci.meta, reruns: { records: reruns.length, downloadsFailed }, sessions: sessions.meta },
  };
}
