// Desktop-only model downloader: streams a GGUF from Hugging Face into the models folder with progress,
// writing to a .part temp file and renaming on success (so a cancelled/failed download leaves no
// half-file that looks valid). Resumable: an interrupted download keeps its .part, and the next attempt
// resumes from where it stopped via an HTTP Range request (this survives an app restart). One at a time.
const { net } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Only fetch from Hugging Face. net.fetch follows HF's redirect to its CDN internally, so validating the
// initial host is enough.
const ALLOWED_HOSTS = new Set(['huggingface.co']);

let current = null; // { controller, fileName }

function isAllowed(url) {
  try { return ALLOWED_HOSTS.has(new URL(url).host); } catch { return false; }
}

/** On-disk size of a file, or 0 if it doesn't exist. */
function sizeOf(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

function partPathFor(destDir, fileName) {
  return path.join(destDir, `${path.basename(fileName)}.part`);
}

/**
 * Download `url` → `<destDir>/<fileName>`, reporting { fileName, received, total, done } via onProgress.
 * Resumes from an existing `.part` (HF LFS files are immutable, so the tail is safe to append). On any
 * interruption the `.part` is left in place for a later resume; only success renames it to the final name.
 */
async function download({ url, fileName, destDir }, onProgress) {
  if (current) throw new Error('A model download is already in progress.');
  if (!isAllowed(url)) throw new Error('Model downloads are only allowed from huggingface.co.');

  fs.mkdirSync(destDir, { recursive: true });
  const finalPath = path.join(destDir, path.basename(fileName));
  const tmpPath = `${finalPath}.part`;

  const controller = new AbortController();
  current = { controller, fileName };
  let out = null;
  try {
    // Resume from whatever's already on disk (persists across app restarts).
    let startOffset = sizeOf(tmpPath);
    let res = await net.fetch(url, { signal: controller.signal, headers: startOffset > 0 ? { Range: `bytes=${startOffset}-` } : {} });

    // 416 = the range is unsatisfiable: the .part is already complete-but-unrenamed or otherwise stale.
    // Discard it and restart from scratch so we never wedge on a bad partial.
    if (startOffset > 0 && res.status === 416) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      startOffset = 0;
      res = await net.fetch(url, { signal: controller.signal });
    }

    let received;
    let total;
    let append;
    if (startOffset > 0 && res.status === 206) {
      // Resume honored. content-range is "bytes start-end/total"; fall back to offset + remaining length.
      const cr = res.headers.get('content-range');
      total = cr && cr.includes('/') ? Number(cr.split('/')[1]) : startOffset + (Number(res.headers.get('content-length')) || 0);
      received = startOffset;
      append = true;
    } else {
      // Fresh download, or the server ignored our Range and sent the whole file (200) — start over.
      if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
      total = Number(res.headers.get('content-length')) || 0;
      received = 0;
      append = false;
    }
    if (!res.body) throw new Error('Download failed: empty response body.');

    out = fs.createWriteStream(tmpPath, { flags: append ? 'a' : 'w' });
    onProgress({ fileName, received, total, done: false }); // seed the bar at the resumed position

    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      // Respect backpressure so an 8 GB file doesn't buffer in memory.
      if (!out.write(Buffer.from(value))) await new Promise((r) => out.once('drain', r));
      onProgress({ fileName, received, total, done: false });
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
    out = null;
    fs.renameSync(tmpPath, finalPath);
    onProgress({ fileName, received, total: total || received, done: true });
    return finalPath;
  } catch (e) {
    // Keep the .part on disk so the next attempt resumes — flush and close it, but don't delete.
    if (out) { try { await new Promise((r) => out.end(r)); } catch { /* ignore */ } }
    // A user-initiated pause aborts the fetch; surface it as a recognizable, non-error signal.
    if (controller.signal.aborted) throw new Error('DOWNLOAD_PAUSED');
    throw e;
  } finally {
    current = null;
  }
}

/** Abort the in-flight download, if any. The partial is preserved for a later resume. */
function cancel() {
  if (current) current.controller.abort();
}

/** Partial (.part) downloads present in `destDir`, as [{ fileName, received }] (fileName without .part). */
function listPartials(destDir) {
  try {
    return fs.readdirSync(destDir)
      .filter((f) => f.toLowerCase().endsWith('.gguf.part'))
      .map((f) => ({ fileName: f.slice(0, -'.part'.length), received: sizeOf(path.join(destDir, f)) }));
  } catch {
    return [];
  }
}

/** Delete a partial download (so "Discard" leaves nothing behind). */
function discardPartial(destDir, fileName) {
  try { fs.unlinkSync(partPathFor(destDir, fileName)); return true; } catch { return false; }
}

module.exports = { download, cancel, listPartials, discardPartial };
