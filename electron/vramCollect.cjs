// Shared nvidia-smi collector used by BOTH the standalone VRAM helper (scripts/vram-helper.mjs) and the
// Electron main process (electron/main.cjs exposes it over IPC). Zero deps — Node built-ins only. Returns
// { gpus, processes }; throws if nvidia-smi is missing/errors, which callers map to a "no GPU" payload.
const { execFile } = require('node:child_process');

function runNvidiaSmi(args) {
  return new Promise((resolve, reject) => {
    execFile('nvidia-smi', args, { windowsHide: true }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

// nvidia-smi reports "[Not Supported]" / "[N/A]" for some fields; map those to null.
function toNum(s) {
  const n = Number(String(s).trim());
  return Number.isFinite(n) ? n : null;
}

function parseCsvLines(stdout) {
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(',').map((c) => c.trim()));
}

async function collect() {
  const gpuOut = await runNvidiaSmi([
    '--query-gpu=index,name,memory.total,memory.used,memory.free',
    '--format=csv,noheader,nounits',
  ]);
  const gpus = parseCsvLines(gpuOut).map(([index, name, total, used, free]) => ({
    index: toNum(index),
    name,
    totalMB: toNum(total),
    usedMB: toNum(used),
    freeMB: toNum(free),
  }));

  let processes = [];
  try {
    const procOut = await runNvidiaSmi([
      '--query-compute-apps=pid,process_name,used_memory',
      '--format=csv,noheader,nounits',
    ]);
    processes = parseCsvLines(procOut)
      // Skip placeholder rows nvidia-smi emits without admin rights, e.g. "[Insufficient Permissions]".
      .filter((cols) => !cols.some((c) => c.startsWith('[')))
      .map(([pid, name, used]) => ({
        pid: toNum(pid),
        name,
        usedMB: toNum(used), // null on Windows GeForce/WDDM where per-process VRAM is unavailable
      }));
  } catch {
    // Per-process query can fail independently; the GPU totals are still useful.
    processes = [];
  }

  return { gpus, processes };
}

module.exports = { collect };
