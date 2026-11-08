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
const CANCEL_RECORD = 'cuda-replace-canceled.json';
const DISCARD_PREFIX = 'deleting-';

const installDirFor = (enginesDir, tag) => path.join(enginesDir, `${FOLDER_PREFIX}${tag}`);
const stagingDirFor = (enginesDir, tag) => path.join(enginesDir, STAGING, tag);

function sizeOf(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

/** "b8123" → 8123, so tags sort by build. */
const buildOf = (tag) => Number(/\d+/.exec(tag)?.[0] ?? 0);

/** Delete a folder, or leave it when Windows still holds a file in it. */
async function tryRemove(dir) {
  try { await fs.promises.rm(dir, { recursive: true, force: true }); } catch { /* retried at the next prune */ }
}

/**
 * Move a tag's folder aside, then delete it. Windows refuses the move while a file inside is open, so a
 * held folder stays whole and valid, and a half-deleted one never reads as a tag.
 */
async function discard(enginesDir, name) {
  const aside = path.join(enginesDir, `${DISCARD_PREFIX}${name}`);
  try { await fs.promises.rename(path.join(enginesDir, name), aside); } catch { return; }
  await tryRemove(aside);
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
 * before it deletes anything; old tags' folders wait until `engineRunning()` reads false.
 */
function createCudaInstall({
  enginesDir, pin, downloader, probe, stopEngine, freeSpace, engineRunning = () => false, onStatus = () => {},
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
  let pruning = null; // the delete pass in progress; a second call joins it

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

  const listEngines = () => { try { return fs.readdirSync(enginesDir); } catch { return []; } };

  /** Other tags' folders whose marker names their tag, newest build first. */
  function otherTags() {
    return listEngines()
      .filter((n) => n.startsWith(FOLDER_PREFIX) && n !== `${FOLDER_PREFIX}${pin.tag}`)
      .filter((n) => readMarker(path.join(enginesDir, n))?.tag === n.slice(FOLDER_PREFIX.length))
      .map((n) => n.slice(FOLDER_PREFIX.length))
      .sort((x, y) => buildOf(y) - buildOf(x));
  }
  const staleTag = () => otherTags()[0] ?? null;

  // The tag whose automatic replace the player canceled; a newer pin makes it moot.
  const cancelFile = path.join(enginesDir, CANCEL_RECORD);
  const canceledTag = () => { try { return JSON.parse(fs.readFileSync(cancelFile, 'utf8')).tag ?? null; } catch { return null; } };
  const recordCancel = () => { fs.mkdirSync(enginesDir, { recursive: true }); fs.writeFileSync(cancelFile, JSON.stringify({ tag: pin.tag })); };
  const clearCancel = () => { try { fs.rmSync(cancelFile, { force: true }); } catch { /* cleared at the next prune */ } };

  /**
   * Delete every CUDA folder but the current tag's and the newest other valid one (a launcher rollback's),
   * plus other tags' partials. Skipped while the engine runs; a folder Windows still holds stays for next time.
   */
  function prune() {
    if (running || engineRunning()) return Promise.resolve();
    pruning ??= (async () => {
      const keep = new Set([`${FOLDER_PREFIX}${pin.tag}`, ...otherTags().slice(0, 1).map((t) => `${FOLDER_PREFIX}${t}`)]);
      for (const n of listEngines()) {
        if (n.startsWith(DISCARD_PREFIX)) await tryRemove(path.join(enginesDir, n));
        else if (n.startsWith(FOLDER_PREFIX) && !keep.has(n)) await discard(enginesDir, n);
      }
      const stagingRoot = path.join(enginesDir, STAGING);
      let staged = [];
      try { staged = fs.readdirSync(stagingRoot); } catch { /* no partials */ }
      for (const t of staged) if (t !== pin.tag) await tryRemove(path.join(stagingRoot, t));
      // Only a newer pin clears it; a rollback keeps the cancel for the roll-forward.
      const canceled = canceledTag();
      if (canceled && buildOf(pin.tag) > buildOf(canceled)) clearCancel();
    })().catch(() => { /* retried at the next prune */ }).finally(() => { pruning = null; });
    return pruning;
  }

  /** The current status. `refresh` reads the machine facts again, so a driver update shows without a restart. */
  async function status({ refresh = false } = {}) {
    if (refresh && !job) facts = null;
    const { nvidia, support } = await machine();
    const base = { nvidia, support, downloadBytes };
    if (job) {
      return { ...base, state: 'downloading', received: job.received, total: job.total, phase: job.phase, ...(job.replacing ? { replacing: true } : {}) };
    }
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
    job = { received: sumOf(onDisk), total: downloadBytes, phase: 'download', replacing: staleTag() != null };
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

  /** Run the install, then delete what it made old. A second call joins the first. */
  function start() {
    running ??= begin().finally(() => { running = null; });
    return running.then(async (s) => { await prune(); return s; });
  }

  /** The player's Download or Resume: download, check and unpack the pinned build. A second call joins the first. */
  function install() {
    clearCancel();
    return start();
  }

  /**
   * At app start: delete old folders, then replace a stale install in the background. Skipped for an
   * unsupported machine and for a tag whose replace the player canceled.
   */
  async function startup() {
    await prune();
    if (installedTag() || !staleTag() || canceledTag() === pin.tag) return null; // no nvidia-smi run needed
    const { support } = await machine();
    return support?.supported ? start() : status();
  }

  function abort() {
    if (!job) return;
    canceled = true;
    downloader.cancel();
  }

  /** The player's Cancel. Partials stay for a resume, and the automatic replace leaves this tag alone. */
  function cancel() {
    if (!job) return;
    abort();
    try { recordCancel(); } catch { /* the next app start retries the replace */ }
  }

  async function erase() {
    await stopEngine();
    let names = [];
    try { names = fs.readdirSync(enginesDir); } catch { /* nothing installed */ }
    for (const n of names) {
      if (n.startsWith(FOLDER_PREFIX) || n === STAGING) fs.rmSync(path.join(enginesDir, n), { recursive: true, force: true });
    }
    clearCancel();
    lastError = null;
    await emit();
    return status();
  }

  /** Stop the engine, then delete every CUDA folder and any partials. An install that arrives meanwhile joins the removal. */
  async function remove() {
    if (running) {
      abort();
      await running.catch(() => {});
    }
    running ??= erase().finally(() => { running = null; });
    return running;
  }

  /** The installed build's llama-server for the current tag, or null when that tag isn't installed. */
  function serverPath() {
    if (!installedTag()) return null;
    const exe = path.join(installDirFor(enginesDir, pin.tag), process.platform === 'win32' ? 'llama-server.exe' : 'llama-server');
    return fs.existsSync(exe) ? exe : null;
  }

  return { status, install, startup, cancel, remove, prune, serverPath };
}

module.exports = { createCudaInstall, tarExtract };
