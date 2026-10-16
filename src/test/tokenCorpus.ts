import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** One text a shipped token can sit in: a source file's raw text, or one string of a bundled world. */
export interface CorpusText {
  origin: string;
  text: string;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) return path === 'src/test' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => strings(item, out));
  return out;
}

/** Every text the app ships tokens in: the raw source of the default prompts and every other module, and
 *  each string of every bundled world. */
export function corpusTexts(): CorpusText[] {
  const sources = sourceFiles('src').map((path) => ({ origin: path, text: readFileSync(path, 'utf8') }));
  const worlds = readdirSync('src/defaultworlds').filter((file) => file.endsWith('.json')).flatMap((file) => {
    const world: unknown = JSON.parse(readFileSync(`src/defaultworlds/${file}`, 'utf8'));
    return strings(world).map((text) => ({ origin: `src/defaultworlds/${file}`, text }));
  });
  return [...sources, ...worlds];
}

/** Every distinct token `pattern` finds in the corpus, sorted; `tokenCorpus.recorded.json` holds one reading. */
export function corpusTokens(pattern: string): string[] {
  const re = new RegExp(pattern, 'g');
  return [...new Set(corpusTexts().flatMap(({ text }) => [...text.matchAll(re)].map((m) => m[0])))].sort();
}
