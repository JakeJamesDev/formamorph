// Windows update downloader for the launcher model. The app never swaps its own files (they're locked while
// running); it only downloads + verifies the new `/app` payload zip and records it in pending.json. The Go
// launcher (`<root>/Formamorph.exe`) does the actual extract + swap after the app exits, then relaunches.
const { net, app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

function updatesDir() {
  return path.join(app.getPath('userData'), 'updates');
}

/** Streaming SHA-512 of a file, lowercase hex. */
function sha512Of(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512');
    const s = fs.createReadStream(file);
    s.on('error', reject);
    s.on('data', (d) => hash.update(d));
    s.on('end', () => resolve(hash.digest('hex')));
  });
}

/** Download the `/app` payload zip with progress, verify its checksum, and record pending.json. Throws (and
 *  cleans up the partial) on an HTTP or checksum failure so a corrupt payload is never staged. */
async function download({ url, sha512, version }, onProgress) {
  const dir = updatesDir();
  fs.mkdirSync(dir, { recursive: true });
  const zipPath = path.join(dir, `app-${version}-win.zip`);
  const tmp = `${zipPath}.part`;

  const res = await net.fetch(url);
  if (!res.ok) throw new Error(`Update download failed: HTTP ${res.status}`);
  if (!res.body) throw new Error('Update download failed: empty response body.');
  const total = Number(res.headers.get('content-length')) || 0;

  const out = fs.createWriteStream(tmp, { flags: 'w' });
  let received = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (!out.write(Buffer.from(value))) await new Promise((r) => out.once('drain', r));
      onProgress({ received, total, done: false });
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  } catch (e) {
    try { out.destroy(); fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw e;
  }

  if (sha512) {
    const got = await sha512Of(tmp);
    if (got.toLowerCase() !== sha512.toLowerCase()) {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      throw new Error('Update checksum mismatch — download discarded.');
    }
  }

  fs.renameSync(tmp, zipPath);
  fs.writeFileSync(path.join(dir, 'pending.json'), JSON.stringify({ version, zip: zipPath, sha512: sha512 || null }));
  onProgress({ received, total: total || received, done: true });
}

/** A previously downloaded, still-staged update awaiting apply (survives an app restart), or null. Reads
 *  pending.json and confirms its payload zip is still on disk so a deleted/partial stage isn't trusted. */
function pendingUpdate() {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(updatesDir(), 'pending.json'), 'utf8'));
    if (p && p.version && p.zip && fs.existsSync(p.zip)) return { version: String(p.version) };
  } catch { /* no pending update */ }
  return null;
}

/** Hand off to the launcher to swap /app and relaunch. Spawns it detached (so it outlives us), then the
 *  caller quits the app to release the file locks the launcher needs. */
function apply() {
  const root = process.env.FORMAMORPH_ROOT;
  if (!root) throw new Error('Not a launcher build (FORMAMORPH_ROOT unset).');
  const launcher = path.join(root, 'Formamorph.exe');
  // Throw synchronously so the caller skips its app.quit() and the user gets a real message: quitting into
  // a launcher that can't start would close the app for good. Antivirus quarantine is the usual cause.
  if (!fs.existsSync(launcher)) {
    throw new Error(
      `Launcher missing at ${launcher} — antivirus may have quarantined it. Reinstall from the latest release, then retry the update.`,
    );
  }
  const child = spawn(launcher, ['--apply-update'], { detached: true, stdio: 'ignore' });
  // spawn reports failure asynchronously; with no 'error' listener it becomes an uncaught main-process
  // exception (the raw ENOENT crash dialog) instead of a logged, survivable error.
  child.on('error', (err) => console.error('Launcher spawn failed:', err));
  child.unref();
}

module.exports = { download, apply, pendingUpdate, updatesDir };
