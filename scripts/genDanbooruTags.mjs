// Generate the curated Danbooru tag list shipped for Image-Tags autocomplete.
// Pages the public Danbooru API by post count, per category, applies per-category caps, normalizes
// underscores to spaces, dedupes, sorts by popularity, and writes a compact string[] JSON.
//
// Provenance: tag names + post counts come from the public Danbooru API (danbooru.donmai.us). Tag strings
// are factual labels; we ship them as an authoring convenience. Regenerate with: npm run gen-tags
//
// Zero dependencies — Node 20+ built-ins only (global fetch). Includes explicit tags (the app is
// NSFW-oriented); the SFW build gates these off separately (see src/lib/danbooruTags.ts).
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'danbooruTags.json');

// Danbooru tag categories → how many of the most-popular to keep. Skips meta (5).
const CATEGORIES = [
  { id: 0, name: 'general', cap: 6000 },
  { id: 4, name: 'character', cap: 2500 },
  { id: 3, name: 'copyright', cap: 1000 },
  { id: 1, name: 'artist', cap: 500 },
];

const PER_PAGE = 1000; // Danbooru's max limit
const UA = 'Formamorph tag-list generator (github.com/JakeJamesDev/formamorph)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchCategory({ id, name, cap }) {
  const out = [];
  const pages = Math.ceil(cap / PER_PAGE);
  for (let page = 1; page <= pages; page++) {
    const url = `https://danbooru.donmai.us/tags.json?search[category]=${id}`
      + `&search[order]=count&search[hide_empty]=true&only=name,post_count&limit=${PER_PAGE}&page=${page}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${name} page ${page}: HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) out.push(r);
    process.stdout.write(`  ${name}: ${Math.min(out.length, cap)}/${cap}\r`);
    await sleep(250); // be polite to the API
  }
  process.stdout.write('\n');
  return out.slice(0, cap);
}

async function main() {
  // Merge across categories, keeping each tag's post_count for a global popularity sort.
  const byName = new Map();
  for (const cat of CATEGORIES) {
    console.log(`Fetching ${cat.name} (top ${cat.cap})…`);
    for (const { name, post_count } of await fetchCategory(cat)) {
      if (!name) continue;
      const display = name.replace(/_/g, ' ').trim(); // insert with spaces, not underscores
      if (!display) continue;
      const prev = byName.get(display);
      if (prev === undefined || post_count > prev) byName.set(display, post_count ?? 0);
    }
  }

  const tags = [...byName.entries()]
    .sort((a, b) => b[1] - a[1]) // most-used first; array order IS the ranking
    .map(([name]) => name);

  await writeFile(OUT, JSON.stringify(tags), 'utf8');
  console.log(`Wrote ${tags.length} tags → ${OUT}`);
}

main().catch((err) => {
  console.error('gen-tags failed:', err.message);
  process.exit(1);
});
