// Serves the seed editor and the training-data repo on localhost, so a save writes back to the file.
//   node testing/coref/seed-editor-server.mjs [--port 5320]
// Open http://localhost:5320/?file=coref/corpus/hand-fixed.jsonl

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = path.dirname(fileURLToPath(import.meta.url));
const E = createRequire(import.meta.url)('./seedEditor.cjs');
const STATIC = { '/seed-editor.html': 'text/html; charset=utf-8', '/seedEditor.cjs': 'text/javascript; charset=utf-8' };
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The data file a `/data/...` path names: inside `root`, a `.jsonl` or `.json` file that already exists.
 *
 * @returns {string|null} The absolute path, or null when the path names nothing the editor may touch
 */
export function dataFile(root, urlPath) {
  if (!urlPath.startsWith('/data/')) return null;
  let rel;
  try {
    rel = decodeURIComponent(urlPath.slice('/data/'.length));
  } catch {
    return null;
  }
  const file = path.resolve(root, rel);
  const inside = path.relative(path.resolve(root), file);
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) return null;
  if (!/\.jsonl?$/.test(file) || !existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

/** Whether the request came to a loopback name, which a DNS-rebinding page cannot fake. */
export const localHost = (hostHeader = '') => LOCAL_HOSTS.has(hostHeader.replace(/:\d+$/, ''));

/**
 * Check a saved file and write it in place through a temporary file.
 *
 * @returns {string[]} The parse errors; nothing is written when there are any
 */
export function saveFile(file, content) {
  const { errors } = E.parseFile(content);
  if (errors.length) return errors;
  const tmp = `${file}.saving`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, file);
  return [];
}

export function createServer(root) {
  return http.createServer((req, res) => {
    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(body);
    };
    if (!localHost(req.headers.host)) return send(403, 'Use localhost');

    const { pathname, search } = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(302, { Location: `/seed-editor.html${search}` });
      return res.end();
    }
    if (req.method === 'GET' && STATIC[pathname]) return send(200, readFileSync(path.join(KIT, pathname)), STATIC[pathname]);

    const file = dataFile(root, pathname);
    if (!file) return send(404, 'Not found');
    if (req.method === 'GET') return send(200, readFileSync(file), 'application/json; charset=utf-8');
    if (req.method !== 'PUT') return send(405, 'Method not allowed');

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const errors = saveFile(file, Buffer.concat(chunks).toString('utf8'));
      if (errors.length) return send(400, errors.join('\n'));
      send(204, '');
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--port');
  const port = at > 0 ? Number(process.argv[at + 1]) : 5320;
  // The main checkout, also from a ticket worktree: the training-data repo sits beside it.
  const main = path.dirname(execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: KIT, encoding: 'utf8' }).trim());
  const root = path.resolve(process.env.FORMAMORPH_TRAINING_DATA ?? path.join(main, '..', 'formamorph-training-data'));
  if (!existsSync(root)) throw new Error(`No training-data repo at ${root}. Clone it there or set FORMAMORPH_TRAINING_DATA.`);
  createServer(root).listen(port, '127.0.0.1', () => console.log(`Seed editor on http://localhost:${port}/ serving ${root}`));
}
