// Local VRAM helper for Formamorph. Shells out to nvidia-smi (via the shared collector, also used by the
// Electron desktop build) and serves the numbers as JSON over HTTP so the browser app — which has no
// GPU-memory API — can display them. Zero dependencies — Node built-ins only. Run with: npm run vram-helper
import { createServer } from "node:http";
import { createRequire } from "node:module";

// The collector is CommonJS (shared with electron/main.cjs); load it via createRequire from this ES module.
const require = createRequire(import.meta.url);
const { collect } = require("../electron/vramCollect.cjs");

const argPort = process.argv.indexOf("--port");
const PORT = Number(
  (argPort !== -1 && process.argv[argPort + 1]) || process.env.VRAM_HELPER_PORT || 5179
);

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
