import { readdirSync, readFileSync } from 'node:fs';

// Under vitest every import of a bundled world arrives image-stripped, so a test that needs the stored bytes reads here.
const DIR = 'src/defaultworlds/';

/** The ids of the bundled worlds, sorted. */
export const bundledWorldIds = (): string[] =>
  readdirSync(DIR).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -'.json'.length)).sort();

/** A bundled world's text as stored, images included. */
export const bundledWorldText = (id: string): string => readFileSync(`${DIR}${id}.json`, 'utf8');
