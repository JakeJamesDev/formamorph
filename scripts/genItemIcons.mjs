// Generates src/data/itemIcons.json from scripts/itemIconSource.json: npm run gen-item-icons
// A row's author is the display name game-icons/icons' license.txt gives the art's folder.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, 'itemIconSource.json');
const OUT = join(HERE, '..', 'src', 'data', 'itemIcons.json');
const ICON_SET = 'https://cdn.jsdelivr.net/npm/@iconify-json/game-icons@1.2.4/icons.json';

const response = await fetch(ICON_SET);
if (!response.ok) throw new Error(`${ICON_SET}: ${response.status}`);
const { icons } = await response.json();

const rows = JSON.parse(await readFile(SOURCE, 'utf8'));
const catalog = rows.map(({ id, group, gameIcon, author, words }) => {
  const body = icons[gameIcon]?.body;
  if (!body) throw new Error(`Game Icons has no "${gameIcon}" (for ${id})`);
  return { id, group, author, words, body };
});

const lines = catalog.map((icon) => `  ${JSON.stringify(icon)}`);
await writeFile(OUT, `[\n${lines.join(',\n')}\n]\n`);
console.log(`Wrote ${catalog.length} icons to ${OUT}`);
