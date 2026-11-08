// The optional CUDA build of the pinned llama-server: download, digest check, unpack and remove.
// One folder per tag under `<userData>/engines`, valid only when its marker names the tag and both digests.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { receivedBytes, removeSidecar, sidecarPathFor, DOWNLOAD_PAUSED } = require('./modelDownload.cjs');

const FOLDER_PREFIX = 'llama-server-cuda-';
const MARKER = 'cuda-install.json';
const STAGING = 'staging';

const installDirFor = (enginesDir, tag) => path.join(enginesDir, `${FOLDER_PREFIX}${tag}`);
const stagingDirFor = (enginesDir, tag) => path.join(enginesDir, STAGING, tag);

function sizeOf(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

function readMarker(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, MARKER), 'utf8')); } catch { return null; }
}

async function sha256Of(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return `sha256:${hash.digest('hex')}`;
}

// Windows' own bsdtar reads zip; relative names, since GNU tar reads "C:" in an absolute path as a host.
const TAR = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
function tarExtract(archive, destDir) {
  const cwd = path.dirname(archive);
  return new Promise((resolve, reject) => {
    execFile(TAR, ['-xf', path.basename(archive), '-C', path.relative(cwd, destDir)], { cwd, windowsHide: true }, (err, _out, stderr) => {
      if (err) reject(new Error(`Could not unpack ${path.basename(archive)}: ${stderr || err.message}`));
      else resolve();
    });
  });
}

/**
 * The CUDA install for one pin, on its own downloader. The machine probe runs once per app run; the
 * extractor, free-space reader and download options are injectable for tests. Remove stops the engine
 * before it deletes anything.
 */
function createCudaInstall({
  enginesDir, pin, downloader, probe, stopEngine, freeSpace, onStatus = () => {},
  extract = tarExtract, downloadOptions = {},
}) {
  const assets = pin.cuda.assets;
  const sumOf = (bytes) => assets.reduce((n, a) => n + bytes(a), 0);
  const downloadBytes = sumOf((a) => a.size);
  const unpackedBytes = sumOf((a) => a.unpackedSize);
  const staging = stagingDirFor(enginesDir, pin.tag);

  let facts = null;
  let job = null; // { received, total, phase } while an install runs
  let running = null; // the install or removal in progress; a second call joins it
  let canceled = false;
  let lastError = null;

  const machine = () => (facts ??= Promise.resolve(probe()).catch(() => ({ nvidia: false, support: null })));

  const zipPath = (a) => path.join(staging, a.name);
  const partPath = (a) => `${zipPath(a)}.part`;
  /** Bytes of each asset already on disk: a finished zip, or the downloaded part of a partial. */
  const onDisk = (a) => sizeOf(zipPath(a)) || receivedBytes(partPath(a));

  function installedTag() {
    const marker = readMarker(installDirFor(enginesDir, pin.tag));
    const digests = assets.map((a) => a.digest);
    const ok = marker?.tag === pin.tag && Array.isArray(marker.digests)
      && marker.digests.length === digests.length && digests.every((d, i) => marker.digests[i] === d);
    return ok ? pin.tag : null;
  }

  function staleTag() {
    let names = [];
    try { names = fs.readdirSync(enginesDir); } catch { return null; }
    const tags = names
      .filter((n) => n.startsWith(FOLDER_PREFIX) && n !== `${FOLDER_PREFIX}${pin.tag}`)
      .map((n) => readMarker(path.join(enginesDir, n))?.tag)
      .filter(Boolean);
    const build = (t) => Number(/\d+/.exec(t)?.[0] ?? 0);
    return tags.sort((x, y) => build(x) - build(y)).at(-1) ?? null;
  }

  /** The current status. `refresh` reads the machine facts again, so a driver update shows without a restart. */
  async function status({ refresh = false } = {}) {
    if (refresh && !job) facts = null;
    const { nvidia, support } = await machine();
    const base = { nvidia, support, downloadBytes };
    if (job) return { ...base, state: 'downloading', received: job.received, total: job.total, phase: job.phase };
    const tag = installedTag();
    if (tag) return { ...base, state: 'installed', tag };
    if (!support?.supported) return { ...base, state: 'unsupported' };
    const partialBytes = sumOf(onDisk);
    const rest = { partialBytes, ...(lastError ? { error: lastError } : {}) };
    const stale = staleTag();
    return stale ? { ...base, state: 'stale', tag: stale, ...rest } : { ...base, state: 'not-installed', ...rest };
  }

  const emit = async () => onStatus(await status());

  async function run() {
    fs.mkdirSync(staging, { recursive: true });
    // The zips' missing bytes plus the unpacked folder; a segmented partial already holds its full size.
    const neededBytes = sumOf((a) => Math.max(0, a.size - (sizeOf(zipPath(a)) || sizeOf(partPath(a))))) + unpackedBytes;
    const freeBytes = freeSpace(enginesDir);
    if (freeBytes != null && freeBytes < neededBytes) {
      lastError = { kind: 'no-space', neededBytes, freeBytes };
      return;
    }

    let before = 0;
    for (const a of assets) {
      // A Cancel between two assets has no download to abort, so it is checked here.
      if (canceled) throw new Error(DOWNLOAD_PAUSED);
      if (!fs.existsSync(zipPath(a))) {
        await downloader.download({ ...downloadOptions, url: a.url, fileName: a.name, destDir: staging }, (p) => {
          job.received = before + p.received;
          void emit();
        });
      }
      before += a.size;
      job.received = before;
    }

    job.phase = 'verify';
    await emit();
    for (const a of assets) {
      if ((await sha256Of(zipPath(a))) !== a.digest) {
        fs.rmSync(zipPath(a), { force: true });
        removeSidecar(sidecarPathFor(partPath(a)));
        lastError = { kind: 'digest', asset: a.name };
        return;
      }
    }

    job.phase = 'unpack';
    await emit();
    const unpack = path.join(staging, 'unpack');
    fs.rmSync(unpack, { recursive: true, force: true });
    fs.mkdirSync(unpack, { recursive: true });
    for (const a of assets) await extract(zipPath(a), unpack);
    fs.writeFileSync(path.join(unpack, MARKER), JSON.stringify({ tag: pin.tag, digests: assets.map((a) => a.digest) }));
    const target = installDirFor(enginesDir, pin.tag);
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(unpack, target);
    fs.rmSync(staging, { recursive: true, force: true });
  }

  async function begin() {
    const { support } = await machine();
    if (!support?.supported || installedTag()) return status();
    lastError = null;
    canceled = false;
    job = { received: sumOf(onDisk), total: downloadBytes, phase: 'download' };
    await emit();
    try {
      await run();
    } catch (err) {
      if (err?.message !== DOWNLOAD_PAUSED) lastError = { kind: 'failed', message: String(err?.message ?? err) };
    } finally {
      job = null;
    }
    await emit();
    return status();
  }

  /** Download, check and unpack the pinned build. Resolves with the final status; a second call joins the first. */
  function install() {
    running ??= begin().finally(() => { running = null; });
    return running;
  }

  /** Stop the download. Partials stay for a resume. */
  function cancel() {
    if (!job) return;
    canceled = true;
    downloader.cancel();
  }

  async function erase() {
    await stopEngine();
    let names = [];
    try { names = fs.readdirSync(enginesDir); } catch { /* nothing installed */ }
    for (const n of names) {
      if (n.startsWith(FOLDER_PREFIX) || n === STAGING) fs.rmSync(path.join(enginesDir, n), { recursive: true, force: true });
    }
    lastError = null;
    await emit();
    return status();
  }

  /** Stop the engine, then delete every CUDA folder and any partials. An install that arrives meanwhile joins the removal. */
  async function remove() {
    if (running) {
      cancel();
      await running.catch(() => {});
    }
    running ??= erase().finally(() => { running = null; });
    return running;
  }

  return { status, install, cancel, remove };
}

module.exports = { createCudaInstall, tarExtract };
