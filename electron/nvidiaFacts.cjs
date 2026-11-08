// NVIDIA card facts for the CUDA support rule. A query of its own, apart from vramCollect's, so a driver
// that rejects `compute_cap` can never make the Hardware tab or Auto's device pick read "no GPU".
const { execFile } = require('node:child_process');
const { evaluateCudaSupport } = require('./cudaSupport.cjs');

const QUERY_TIMEOUT_MS = 5000;

function runNvidiaSmi(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile('nvidia-smi', args, { windowsHide: true, timeout: timeoutMs }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

/** Parse `name,driver_version,compute_cap` csv rows. */
function parseNvidiaFacts(stdout) {
  return String(stdout)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      // The two numeric fields come last, so a comma inside the card name cannot shift them.
      const cols = line.split(',').map((c) => c.trim());
      const computeCap = cols.length >= 3 ? cols.pop() : undefined;
      const driverVersion = cols.length >= 2 ? cols.pop() : undefined;
      return { name: cols.join(', '), driverVersion, computeCap };
    });
}

/** The NVIDIA cards as `{ name, driverVersion, computeCap }`, or null when the query fails. `run` is injectable for tests. */
async function nvidiaCards({ run = runNvidiaSmi, timeoutMs = QUERY_TIMEOUT_MS } = {}) {
  try {
    return parseNvidiaFacts(await run(['--query-gpu=name,driver_version,compute_cap', '--format=csv,noheader,nounits'], timeoutMs));
  } catch {
    return null;
  }
}

/**
 * The CUDA support verdict for this machine. A missing nvidia-smi, a rejected field or a timeout gives
 * `support-unknown`; a clean query with no rows gives `no-nvidia-card`.
 */
async function cudaSupport(options) {
  return evaluateCudaSupport(await nvidiaCards(options));
}

module.exports = { cudaSupport, nvidiaCards, parseNvidiaFacts };
