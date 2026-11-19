#!/usr/bin/env node
// Maps the minified frames of a pasted stack back to source.
//
//   node scripts/mapStack.mjs <maps dir> [stack file]
//
// <maps dir> holds a build's maps: `sourcemaps/` after a local build, or a release's
// sourcemaps-developer-only-*.zip files unpacked under one folder. Every target can share it: chunk names
// carry a content hash. The stack comes from the file, or stdin.
import { readFileSync, readdirSync } from 'node:fs';
import { SourceMap } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// `chunk-HASH.js:line:col`, as V8 (`at fn (url:1:2)`) and Safari/Firefox (`fn@url:1:2`) both print it.
const FRAME = /(?:[a-z-]+:\/\/[^\s()]*\/)?([\w.-]+\.js):(\d+):(\d+)/g;

/** Each `.map` under `dir`, by the file name of the chunk it maps. */
export function indexMaps(dir) {
  const maps = new Map();
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.js.map')) maps.set(entry.name.slice(0, -'.map'.length), path.join(entry.parentPath, entry.name));
  }
  return maps;
}

const sourcePath = (fileName) => fileName.replace(/^(\.\.\/)+/, '').replace(/^webpack:\/\/\//, '');

/**
 * `stack` with every frame a map covers rewritten to its source position.
 *
 * @param mapsByChunk - From {@link indexMaps}
 */
export function mapStack(stack, mapsByChunk) {
  const loaded = new Map();
  const load = (chunk) => {
    if (!loaded.has(chunk)) {
      const file = mapsByChunk.get(chunk);
      loaded.set(chunk, file ? new SourceMap(JSON.parse(readFileSync(file, 'utf8'))) : null);
    }
    return loaded.get(chunk);
  };
  return stack.replace(FRAME, (frame, chunk, line, column) => {
    const origin = load(chunk)?.findOrigin(Number(line), Number(column));
    if (!origin?.fileName) return frame;
    const name = origin.name ? ` ${origin.name}` : '';
    return `${sourcePath(origin.fileName)}:${origin.lineNumber}:${origin.columnNumber}${name}`;
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [dir, stackFile] = process.argv.slice(2);
  if (!dir) {
    console.error('Usage: node scripts/mapStack.mjs <maps dir> [stack file]');
    process.exit(2);
  }
  const stack = readFileSync(stackFile ?? 0, 'utf8');
  process.stdout.write(mapStack(stack, indexMaps(dir)));
}
