// Moves downloaded models between folders when the user changes where downloads land. This is the only
// code path in the app that deletes a user's multi-GB file, so the source is never unlinked until the
// destination is fully written and fsynced: a cancel, crash, or full disk always leaves the original.
// Kept separate from main.cjs so the ordering above is unit-testable.
const fs = require('node:fs');
const path = require('node:path');

// Temp suffix for a cross-volume copy in progress. Deliberately not `.part` — that suffix means "a
// resumable download" to modelDownload, and a half-copied model is not that.
const TEMP_SUFFIX = '.moving';

let canceled = false;

/** True when the name is something we own and should carry across: a model or a resumable download. */
const isMovable = (name) => {
  const lower = name.toLowerCase();
  return lower.endsWith('.gguf') || lower.endsWith('.gguf.part');
};

/** Size in bytes, or 0 when the file can't be stat'd. */
function sizeOf(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

/** Files we'd carry over from `dir`, as [{ name, size }]. Missing dir yields []. */
function listMovable(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter(isMovable).map((name) => ({ name, size: sizeOf(path.join(dir, name)) }));
}

/** What the move prompt needs: how many files and how much data. */
function countMovable(dir) {
  const files = listMovable(dir);
  return { count: files.length, bytes: files.reduce((n, f) => n + f.size, 0) };
}

/** Free bytes on the volume holding `dir`, or null when it can't be read. */
function freeSpace(dir) {
  try {
    const st = fs.statfsSync(dir);
    return st.bavail * st.bsize;
  } catch {
    return null;
  }
}

/**
 * Copy one file across volumes, then remove the source. Writes to a temp name and fsyncs before the
 * rename, so an interrupted copy can never leave a short file wearing the real name. `onChunk` reports
 * bytes written for the progress bar; throws 'MOVE_CANCELED' if canceled mid-stream (source intact).
 */
async function copyAcrossVolumes(src, dest, onChunk) {
  const tmp = dest + TEMP_SUFFIX;
  try {
    await new Promise((resolve, reject) => {
      const read = fs.createReadStream(src);
      const write = fs.createWriteStream(tmp);
      const fail = (e) => { read.destroy(); write.destroy(); reject(e); };
      read.on('error', fail);
      write.on('error', fail);
      read.on('data', (chunk) => {
        if (canceled) { fail(new Error('MOVE_CANCELED')); return; }
        onChunk(chunk.length);
      });
      write.on('finish', resolve);
      read.pipe(write);
    });

    // Force the bytes to disk before the source goes away — a rename is not a durability barrier.
    const fd = fs.openSync(tmp, 'r+');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }

    fs.renameSync(tmp, dest);
  } catch (e) {
    // Covers the fsync and rename too, not just the stream. `isMovable` ignores `.moving`, so a temp
    // orphaned here would never be moved, counted, or cleaned up again — it would sit at multi-GB size
    // in the user's folder forever.
    try { fs.unlinkSync(tmp); } catch { /* nothing to clean */ }
    throw e;
  }

  // Outside the try: once the destination exists, a failure here must not delete it. The source simply
  // stays put and the file reports as skipped.
  fs.unlinkSync(src); // only now is the copy safe to lose the original
}

/**
 * Move every model (and resumable partial) from `from` to `to`.
 *
 * Same-volume moves are a rename and effectively instant; a cross-volume rename fails with EXDEV and
 * falls back to copy-then-unlink. A file that can't be moved — locked by another program, no space —
 * is skipped and reported rather than failing the batch, and its original is left where it was.
 *
 * Reports { file, movedBytes, totalBytes } through `onProgress` and resolves with what happened.
 */
async function moveModels({ from, to }, onProgress = () => {}) {
  canceled = false;
  const src = path.resolve(from);
  const dest = path.resolve(to);
  const moved = [];
  const skipped = [];
  if (src === dest) return { moved, skipped, canceled: false };

  const files = listMovable(src);
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  let movedBytes = 0;

  try { fs.mkdirSync(dest, { recursive: true }); } catch (e) {
    // Nowhere to move to: report every file as skipped rather than half-starting.
    return { moved, skipped: files.map((f) => ({ file: f.name, reason: (e && e.message) || 'Destination unavailable' })), canceled: false };
  }

  for (const f of files) {
    if (canceled) break;
    const srcFile = path.join(src, f.name);
    const destFile = path.join(dest, f.name);
    // Never clobber: a same-named model already at the destination stays, and the source is left alone
    // for the user to deal with rather than silently overwritten or deleted.
    if (fs.existsSync(destFile)) {
      skipped.push({ file: f.name, reason: 'A file with this name is already in the new folder' });
      continue;
    }
    try {
      try {
        fs.renameSync(srcFile, destFile); // same volume: atomic and instant
        movedBytes += f.size;
        onProgress({ file: f.name, movedBytes, totalBytes });
      } catch (e) {
        if (e.code !== 'EXDEV') throw e;
        // Different volume — stream it, reporting progress as it goes.
        let fileDone = 0;
        await copyAcrossVolumes(srcFile, destFile, (n) => {
          fileDone += n;
          onProgress({ file: f.name, movedBytes: movedBytes + fileDone, totalBytes });
        });
        movedBytes += f.size;
      }
      moved.push(f.name);
    } catch (e) {
      if ((e && e.message) === 'MOVE_CANCELED') break;
      skipped.push({ file: f.name, reason: (e && e.message) || 'Could not be moved' });
    }
  }

  // Anything never attempted because of a cancel is reported alongside the genuine failures, so the
  // result dialog accounts for every file — the old folder stops being searched after this.
  if (canceled) {
    const handled = new Set([...moved, ...skipped.map((s) => s.file)]);
    for (const f of files) {
      if (!handled.has(f.name)) skipped.push({ file: f.name, reason: 'Canceled' });
    }
  }

  return { moved, skipped, canceled };
}

/** Stop after the current file (or mid-copy, which discards only the partial copy). */
function cancel() { canceled = true; }

module.exports = { moveModels, cancel, countMovable, listMovable, freeSpace, isMovable, TEMP_SUFFIX };
