// Coref model manifest: the publish gate, the run-vs-published report, and the upload folder.
//   node testing/coref/manifest.mjs report --model small --scores <scores.json> --current <url|file>
//   node testing/coref/manifest.mjs publish --model small --export <dir> --scores <scores.json>
//        --base-url <url> --out <dir> --current <url|file>
// A --current that does not exist yet (HTTP 404, no file) means nothing is published: the first publish passes.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MANIFEST_FORMAT = 1;
const MODEL_ARCH = { big: 'lingmess', small: 'fcoref' };
const FILES = { graph_a: 'graph_a.onnx', graph_b: 'graph_b.onnx', tokenizer: 'tokenizer.json', hostConfig: 'host-config.json' };

/** Compares a candidate's dev scores with the published ones: never lower on any set, higher on at least one. */
export function gate(candidate, published) {
  if (!published) return { ok: true, reasons: ['no published version: first publish'] };
  const reasons = [];
  let better = 0;
  for (const [set, pub] of Object.entries(published)) {
    const cand = candidate[set];
    if (!cand) {
      reasons.push(`${set}: the candidate has no score`);
    } else if (cand.sha256 !== pub.sha256) {
      reasons.push(`${set}: the dev set changed since publish; rescore the published export on the current set`);
    } else if (cand.f1 < pub.f1) {
      reasons.push(`${set}: ${cand.f1} is below the published ${pub.f1}`);
    } else if (cand.f1 > pub.f1) {
      better++;
    }
  }
  if (!reasons.length && !better) reasons.push('ties the published version on every dev set');
  return { ok: reasons.length === 0, reasons };
}

/** Rows of set, published F1, candidate F1 and the change, over both sides' sets. */
export function report(candidate, published) {
  const sets = [...new Set([...Object.keys(published ?? {}), ...Object.keys(candidate)])];
  return sets.map((set) => {
    const pub = published?.[set], cand = candidate[set];
    const comparable = pub && cand && pub.sha256 === cand.sha256;
    return { set, published: pub?.f1 ?? null, candidate: cand?.f1 ?? null, change: comparable ? +(cand.f1 - pub.f1).toFixed(4) : null };
  });
}

function devScores(scores) {
  return Object.fromEntries(Object.entries(scores.dev).map(([set, s]) => [set, { f1: s.f1, sha256: s.sha256 }]));
}

function fileInfo(path) {
  return { size: statSync(path).size, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') };
}

/** The manifest with one model's entry replaced; other models keep their published entries. */
function withModel(current, model, entry) {
  return { format: MANIFEST_FORMAT, models: { ...(current?.models ?? {}), [model]: entry } };
}

/** The published manifest, or null when there is none yet (HTTP 404 or no file). */
async function readCurrent(source) {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`);
    return res.json();
  }
  return existsSync(source) ? JSON.parse(readFileSync(source, 'utf8')) : null;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { command };
  for (let i = 0; i < rest.length; i++) opts[rest[i].replace(/^--/, '')] = rest[++i];
  return opts;
}

function need(opts, ...keys) {
  const missing = keys.filter((k) => !opts[k]);
  if (missing.length) throw new Error(`missing --${missing.join(', --')}`);
}

export async function main(argv, log = console.log) {
  const opts = parseArgs(argv);
  if (!['report', 'publish'].includes(opts.command)) throw new Error('usage: manifest.mjs report|publish --model big|small …');
  need(opts, 'model', 'scores', 'current');
  if (!MODEL_ARCH[opts.model]) throw new Error(`--model is big or small, not ${opts.model}`);
  const current = await readCurrent(opts.current);
  if (!current) log(`no manifest at ${opts.current}`);
  const published = current?.models?.[opts.model] ?? null;
  const scores = JSON.parse(readFileSync(opts.scores, 'utf8'));
  if (scores.model.arch !== MODEL_ARCH[opts.model]) throw new Error(`the ${opts.model} model is ${MODEL_ARCH[opts.model]}; the scores are for ${scores.model.arch}`);
  const candidate = devScores(scores);

  for (const row of report(candidate, published?.scores)) {
    const change = row.change === null ? (row.published === null || row.candidate === null ? '' : 'set changed') : `${row.change >= 0 ? '+' : ''}${row.change}`;
    log(`${row.set.padEnd(16)} published ${String(row.published ?? '-').padEnd(8)} candidate ${String(row.candidate ?? '-').padEnd(8)} ${change}`);
  }
  const verdict = gate(candidate, published?.scores);
  log(`${verdict.ok ? 'publishable' : 'refused'}: ${verdict.reasons.join('; ') || `beats published version ${published.version}`}`);
  if (opts.command === 'report') return verdict;
  if (!verdict.ok) throw new Error(`not published: ${verdict.reasons.join('; ')}`);

  need(opts, 'export', 'base-url', 'out');
  const exportDir = resolve(opts.export);
  if (!scores.model.export || resolve(scores.model.export) !== exportDir) {
    throw new Error(`the scores were not taken from ${exportDir}; run score.py --export on it`);
  }
  const hostConfig = JSON.parse(readFileSync(join(exportDir, FILES.hostConfig), 'utf8'));
  if (hostConfig.architecture !== MODEL_ARCH[opts.model]) throw new Error(`${exportDir} holds a ${hostConfig.architecture} export`);
  const version = (published?.version ?? 0) + 1;
  const folder = join(opts.out, opts.model, String(version));
  mkdirSync(folder, { recursive: true });
  const files = {};
  for (const [role, name] of Object.entries(FILES)) {
    const src = join(exportDir, name);
    if (!existsSync(src)) throw new Error(`${src} is missing`);
    copyFileSync(src, join(folder, name));
    files[role] = { url: `${opts['base-url'].replace(/\/$/, '')}/${opts.model}/${version}/${name}`, ...fileInfo(src) };
  }
  const entry = { version, architecture: hostConfig.architecture, minHostVersion: hostConfig.graphContract, scores: candidate, files };
  const manifest = withModel(current, opts.model, entry);
  writeFileSync(join(opts.out, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  log(`wrote ${join(opts.out, 'manifest.json')} with ${opts.model} version ${version}; upload ${join(opts.out, opts.model, String(version))} first`);
  return manifest;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
