// Local VRAM helper for Formamorph. Shells out to nvidia-smi and serves the numbers
// as JSON over HTTP so the browser app (which has no GPU-memory API) can display them.
// Zero dependencies — Node built-ins only. Run with: npm run vram-helper
import { createServer } from "node:http";
import { execFile } from "node:child_process";

const argPort = process.argv.indexOf("--port");
const PORT = Number(
  (argPort !== -1 && process.argv[argPort + 1]) || process.env.VRAM_HELPER_PORT || 5179
);

function runNvidiaSmi(args) {
  return new Promise((resolve, reject) => {
    execFile("nvidia-smi", args, { windowsHide: true }, (err, stdout) => {
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
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(",").map((c) => c.trim()));
}

async function collect() {
  const gpuOut = await runNvidiaSmi([
    "--query-gpu=index,name,memory.total,memory.used,memory.free",
    "--format=csv,noheader,nounits",
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
      "--query-compute-apps=pid,process_name,used_memory",
      "--format=csv,noheader,nounits",
    ]);
    processes = parseCsvLines(procOut)
      // Skip placeholder rows nvidia-smi emits without admin rights, e.g. "[Insufficient Permissions]".
      .filter((cols) => !cols.some((c) => c.startsWith("[")))
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

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  res.setHeader("Content-Type", "application/json");
  try {
    const data = await collect();
    res.writeHead(200);
    res.end(JSON.stringify(data));
  } catch {
    // nvidia-smi missing or no NVIDIA driver: report distinctly so the UI can say "no GPU".
    res.writeHead(200);
    res.end(JSON.stringify({ error: "nvidia-smi-not-found", gpus: [], processes: [] }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Formamorph VRAM helper listening at http://localhost:${PORT}`);
  console.log("Set this URL in Settings → Hardware. Press Ctrl+C to stop.");
});
