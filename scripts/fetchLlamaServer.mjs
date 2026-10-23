// Fetches the pinned llama.cpp release's `llama-server` builds into build-assets/llama-server/<id>/.
// Usage: node scripts/fetchLlamaServer.mjs [--platform win|mac|linux | --all]  (default: the host's platform)
import { spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
export const DEFAULT_DEST = path.join(ROOT, 'build-assets', 'llama-server');
const REPO = 'ggml-org/llama.cpp';
const MARKER = '.asset';

/** Folder id → platform and release asset name. Windows Vulkan carries the CPU backends; no CUDA. */
export const BUILDS = [
  { id: 'win-x64-vulkan', platform: 'win', asset: (tag) => `llama-${tag}-bin-win-vulkan-x64.zip` },
  { id: 'mac-arm64', platform: 'mac', asset: (tag) => `llama-${tag}-bin-macos-arm64.tar.gz` },
  { id: 'mac-x64', platform: 'mac', asset: (tag) => `llama-${tag}-bin-macos-x64.tar.gz` },
  { id: 'linux-x64-vulkan', platform: 'linux', asset: (tag) => `llama-${tag}-bin-ubuntu-vulkan-x64.tar.gz` },
  { id: 'linux-x64-cpu', platform: 'linux', asset: (tag) => `llama-${tag}-bin-ubuntu-x64.tar.gz` },
];

export const readPin = async () => JSON.parse(await readFile(path.join(HERE, 'llamaServerPin.json'), 'utf8')).tag;

const headers = () => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'formamorph-fetch-llama-server',
  ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
});

/** The release's asset names, with download URLs. Throws a clear error for a tag that is not a release. */
export async function listAssets(tag, fetchImpl = fetch) {
  const res = await fetchImpl(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`, { headers: headers() });
  if (res.status === 404) throw new Error(`llama.cpp has no release tagged "${tag}". Fix the tag in scripts/llamaServerPin.json.`);
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for llama.cpp release "${tag}".`);
  const release = await res.json();
  return new Map(release.assets.map((a) => [a.name, a.browser_download_url]));
}

async function download(url, file, fetchImpl) {
  const res = await fetchImpl(url, { headers: { 'User-Agent': headers()['User-Agent'] }, redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}): ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
}

// Windows' own bsdtar reads zip and tar.gz; a Git-for-Windows GNU tar on PATH cannot read a zip.
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';

// Relative names: GNU tar reads "C:" in an absolute path as a host.
function extract(archive, destDir) {
  const cwd = path.dirname(archive);
  const name = path.basename(archive);
  const into = path.relative(cwd, destDir);
  const run = (cmd, args) => spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  const zip = name.endsWith('.zip');
  let result = run(TAR, [zip ? '-xf' : '-xzf', name, '-C', into]);
  if (result.status !== 0 && zip) result = run('unzip', ['-q', '-o', name, '-d', into]);
  if (result.status !== 0) throw new Error(`Could not unpack ${path.basename(archive)}: ${result.stderr || result.error}`);
}

const HOST_PLATFORM = { win32: 'win', darwin: 'mac', linux: 'linux' };

/**
 * The platforms a CLI run fetches. The default is the host's: Windows cannot create the .dylib/.so
 * symlinks of the other platforms' archives, and those platforms package on their own runners.
 * `--all` fetches every platform; `--platform` names one.
 */
export function platformsFromArgs(argv, hostPlatform = process.platform) {
  if (argv.includes('--all')) return undefined;
  const i = argv.indexOf('--platform');
  if (i >= 0) return [argv[i + 1]];
  const host = HOST_PLATFORM[hostPlatform];
  if (!host) throw new Error(`No llama-server build for ${hostPlatform}. Pass --platform win|mac|linux or --all.`);
  return [host];
}

// A release tarball nests everything under one folder; the zip is flat. Move the files up to the root.
async function flatten(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  if (entries.length !== 1 || !entries[0].isDirectory()) return;
  const inner = path.join(dir, entries[0].name);
  for (const name of await readdir(inner)) await rename(path.join(inner, name), path.join(dir, name));
  await rm(inner, { recursive: true });
}

/**
 * Fetches the builds for `platforms` (default all) at `tag` into `dest`. Resolves with the ids it downloaded.
 * @param {{ tag?: string, platforms?: string[], dest?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function fetchLlamaServer({ tag, platforms, dest = DEFAULT_DEST, fetchImpl = fetch } = {}) {
  tag ??= await readPin();
  const wanted = BUILDS.filter((b) => !platforms || platforms.includes(b.platform));
  if (wanted.length === 0) throw new Error(`No builds for platform "${platforms}". Use win, mac or linux.`);

  const current = async (b) => {
    try { return (await readFile(path.join(dest, b.id, MARKER), 'utf8')).trim() === b.asset(tag); } catch { return false; }
  };
  const stale = [];
  for (const b of wanted) if (!(await current(b))) stale.push(b);
  if (stale.length === 0) return [];

  const assets = await listAssets(tag, fetchImpl);
  const missing = stale.filter((b) => !assets.has(b.asset(tag))).map((b) => b.asset(tag));
  if (missing.length) throw new Error(`Release "${tag}" lacks: ${missing.join(', ')}. Check the asset mapping in scripts/fetchLlamaServer.mjs.`);

  const work = await mkdtemp(path.join(os.tmpdir(), 'llama-server-'));
  try {
    for (const b of stale) {
      const name = b.asset(tag);
      const archive = path.join(work, name);
      const staging = path.join(work, b.id);
      await download(assets.get(name), archive, fetchImpl);
      await mkdir(staging);
      extract(archive, staging);
      await flatten(staging);
      await writeFile(path.join(staging, MARKER), `${name}\n`);
      await rm(path.join(dest, b.id), { recursive: true, force: true });
      await mkdir(dest, { recursive: true });
      // Copy, not rename: the temp dir may sit on another drive.
      await cp(staging, path.join(dest, b.id), { recursive: true });
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  return stale.map((b) => b.id);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const platforms = platformsFromArgs(process.argv);
    const tag = await readPin();
    const got = await fetchLlamaServer({ tag, platforms });
    console.log(got.length ? `llama-server ${tag}: downloaded ${got.join(', ')}` : `llama-server ${tag}: up to date`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
