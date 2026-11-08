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

const PIN_FILE = path.join(HERE, 'llamaServerPin.json');
const readPinFile = async () => JSON.parse(await readFile(PIN_FILE, 'utf8'));
export const readPin = async () => (await readPinFile()).tag;

/** The Windows CUDA 13.5 assets the optional CUDA download needs. The cudart asset name carries no tag. */
export const CUDA_ASSETS = [
  { id: 'cuda', asset: (tag) => `llama-${tag}-bin-win-cuda-13.5-x64.zip` },
  { id: 'cudart', asset: () => 'cudart-llama-bin-win-cuda-13.5-x64.zip' },
];

const headers = () => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'formamorph-fetch-llama-server',
  ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
});

/** The release's assets as the API lists them. Throws a clear error for a tag that is not a release. */
export async function listReleaseAssets(tag, fetchImpl = fetch) {
  const res = await fetchImpl(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`, { headers: headers() });
  if (res.status === 404) throw new Error(`llama.cpp has no release tagged "${tag}". Fix the tag in scripts/llamaServerPin.json.`);
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for llama.cpp release "${tag}".`);
  return (await res.json()).assets;
}

/** The release's asset names, with download URLs. */
export async function listAssets(tag, fetchImpl = fetch) {
  return new Map((await listReleaseAssets(tag, fetchImpl)).map((a) => [a.name, a.browser_download_url]));
}

/** The pinned CUDA assets of `tag` as the release lists them: `{ name, digest, size, url }`. Throws when either is missing or has no digest. */
export async function cudaAssetsOf(tag, fetchImpl = fetch) {
  const listed = new Map((await listReleaseAssets(tag, fetchImpl)).map((a) => [a.name, a]));
  const names = CUDA_ASSETS.map((c) => c.asset(tag));
  const missing = names.filter((n) => !listed.has(n));
  if (missing.length) throw new Error(`Release "${tag}" lacks CUDA assets: ${missing.join(', ')}.`);
  const undigested = names.filter((n) => !/^sha256:[0-9a-f]{64}$/.test(listed.get(n).digest ?? ''));
  if (undigested.length) throw new Error(`Release "${tag}" lists no SHA-256 digest for: ${undigested.join(', ')}.`);
  return names.map((name) => {
    const a = listed.get(name);
    return { name, digest: a.digest, size: a.size, url: a.browser_download_url };
  });
}

const ZIP_EOCD = 0x06054b50;
const ZIP_CENTRAL = 0x02014b50;
const EOCD_SEARCH = 65_557; // the 22-byte record plus the longest zip comment

async function fetchRange(url, start, end, fetchImpl) {
  const res = await fetchImpl(url, { headers: { 'User-Agent': headers()['User-Agent'], Range: `bytes=${start}-${end}` }, redirect: 'follow' });
  if (res.status !== 206) throw new Error(`Range request for ${url} answered ${res.status}.`);
  return Buffer.from(await res.arrayBuffer());
}

/** The summed uncompressed size of a remote zip's entries, read from its central directory with two range requests. */
export async function zipUnpackedSize(url, size, fetchImpl = fetch) {
  const tailStart = Math.max(0, size - EOCD_SEARCH);
  const tail = await fetchRange(url, tailStart, size - 1, fetchImpl);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === ZIP_EOCD) { eocd = i; break; }
  if (eocd < 0) throw new Error(`${url} has no zip end record.`);
  const cdSize = tail.readUInt32LE(eocd + 12);
  const cdOffset = tail.readUInt32LE(eocd + 16);
  if (cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new Error(`${url} is a ZIP64 archive, which the pin reader does not read.`);
  const cd = await fetchRange(url, cdOffset, cdOffset + cdSize - 1, fetchImpl);
  let total = 0;
  for (let p = 0; p + 46 <= cd.length && cd.readUInt32LE(p) === ZIP_CENTRAL;) {
    total += cd.readUInt32LE(p + 24);
    p += 46 + cd.readUInt16LE(p + 28) + cd.readUInt16LE(p + 30) + cd.readUInt16LE(p + 32);
  }
  return total;
}

/**
 * Fails when the pinned release lacks a CUDA asset, or when its digest differs from the pin.
 * Runs on every fetch step, even when the bundled builds are current.
 */
export async function verifyCudaPin({ fetchImpl = fetch, pin } = {}) {
  pin ??= await readPinFile();
  const pinned = pin.cuda?.assets ?? [];
  if (pinned.length !== CUDA_ASSETS.length) throw new Error('scripts/llamaServerPin.json holds no CUDA assets. Run npm run llama-server:bump -- <tag>.');
  const live = await cudaAssetsOf(pin.tag, fetchImpl);
  for (const asset of live) {
    const mine = pinned.find((p) => p.name === asset.name);
    if (!mine) throw new Error(`The pin does not name ${asset.name}. Run npm run llama-server:bump -- ${pin.tag}.`);
    if (mine.digest !== asset.digest) throw new Error(`CUDA asset ${asset.name} has digest ${asset.digest} on release "${pin.tag}", but the pin holds ${mine.digest}.`);
    if (mine.size !== asset.size) throw new Error(`CUDA asset ${asset.name} has size ${asset.size} on release "${pin.tag}", but the pin holds ${mine.size}. Run npm run llama-server:bump -- ${pin.tag}.`);
    if (!(mine.unpackedSize > 0)) throw new Error(`The pin holds no unpacked size for ${asset.name}. Run npm run llama-server:bump -- ${pin.tag}.`);
  }
}

/** Writes `tag` and its CUDA asset names, digests, sizes and unpacked sizes into the pin file. Refuses a tag whose release lacks either asset. */
export async function bumpPin(tag, { fetchImpl = fetch, file = PIN_FILE } = {}) {
  const assets = [];
  for (const { name, digest, size, url } of await cudaAssetsOf(tag, fetchImpl)) {
    assets.push({ name, digest, size, unpackedSize: await zipUnpackedSize(url, size, fetchImpl) });
  }
  await writeFile(file, `${JSON.stringify({ tag, cuda: { assets } }, null, 2)}\n`);
  return assets;
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
      // Copy, not rename: the temp dir may sit on another drive. Verbatim keeps the .so/.dylib links relative.
      await cp(staging, path.join(dest, b.id), { recursive: true, verbatimSymlinks: true });
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  return stale.map((b) => b.id);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const tag = await readPin();
    const checkOnly = process.argv.includes('--check-cuda');
    const platforms = checkOnly ? undefined : platformsFromArgs(process.argv);
    // CUDA is Windows-only. The digest check runs even when the bundled builds are current.
    if (checkOnly || !platforms || platforms.includes('win')) await verifyCudaPin();
    if (checkOnly) {
      console.log(`llama-server ${tag}: CUDA assets match the pin`);
    } else {
      const got = await fetchLlamaServer({ tag, platforms });
      console.log(got.length ? `llama-server ${tag}: downloaded ${got.join(', ')}` : `llama-server ${tag}: up to date`);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
