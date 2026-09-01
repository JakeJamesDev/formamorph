// Static file server for the tracked site, so the browser suite can drive the real landing page.
// Deliberately dumb: it serves files and nothing else. The Pages contract (redirects, cache headers)
// is checked against Cloudflare's own rules engine, not against this.
//
//   node scripts/serveSite.mjs [--root hosting] [--port 5185]
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const ROOT = arg('root', 'hosting');
const PORT = Number(arg('port', process.env.E2E_SITE_PORT ?? 5185));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  // normalize collapses any ../ before the join, so a request cannot escape the root.
  let file = join(ROOT, normalize(path));
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const info = await stat(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Content-Length': info.size,
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
  }
}).listen(PORT, () => console.log(`site: http://localhost:${PORT}/ from ${ROOT}/`));
