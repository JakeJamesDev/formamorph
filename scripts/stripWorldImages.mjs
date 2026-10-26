// Writes an image-free, pretty-printed copy of each world JSON for reading. Every `data:` URI becomes a
// short marker with its media type and size. Usage: `npm run strip-worlds [-- <file|dir>... [--out <dir>]]`.
// Defaults: src/defaultworlds → .scratch/worlds-stripped.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_IN = 'src/defaultworlds';
const DEFAULT_OUT = '.scratch/worlds-stripped';
const DATA_URI = /^data:([^;,]*)[;,]/;

/** Replaces a `data:` URI with a marker; leaves every other value as it is. */
export function stripValue(value) {
  if (typeof value === 'string') {
    const match = DATA_URI.exec(value);
    if (!match) return value;
    return `<stripped ${match[1] || 'data'} ${Math.round(value.length / 1024)} KB>`;
  }
  if (Array.isArray(value)) return value.map(stripValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripValue(v)]));
  }
  return value;
}

function parseArgs(argv) {
  const inputs = [];
  let out = DEFAULT_OUT;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out = argv[++i];
    else inputs.push(argv[i]);
  }
  return { inputs: inputs.length ? inputs : [DEFAULT_IN], out };
}

function jsonFiles(input) {
  if (!statSync(input).isDirectory()) return [input];
  return readdirSync(input)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(input, name));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { inputs, out } = parseArgs(process.argv.slice(2));
  mkdirSync(out, { recursive: true });
  for (const file of inputs.flatMap(jsonFiles)) {
    const raw = readFileSync(file, 'utf8');
    const stripped = JSON.stringify(stripValue(JSON.parse(raw)), null, 2) + '\n';
    const target = path.join(out, path.basename(file));
    writeFileSync(target, stripped);
    const kb = (n) => `${Math.round(n / 1024)} KB`;
    console.log(`${target}  ${kb(raw.length)} → ${kb(stripped.length)}`);
  }
}
