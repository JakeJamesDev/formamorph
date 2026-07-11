// Derive terse, user-facing release notes from docs/Changelog.md, for the GitHub release body (and the
// in-app update popouts, which show that body). Takes the bold lead sentence of each 👤 User-facing entry,
// grouped by change type (Added / Removed / Fixed); drops 🛠️/⚙️ dev entries. The verbose changelog stays the
// single source of truth — this is a generated view, never hand-maintained.
//
// Usage:
//   node scripts/extractReleaseNotes.mjs                 → the "🚧 In Progress" section (the release workflow)
//   node scripts/extractReleaseNotes.mjs --release 2.0.1 → a specific released version's collapsed section
//   node scripts/extractReleaseNotes.mjs --file path.md  → read a different changelog file
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const file = argVal('--file') || path.join(ROOT, 'docs', 'Changelog.md');
const release = argVal('--release');

const TYPES = [
  { key: 'Added', match: /Added/i },
  { key: 'Removed', match: /Removed/i },
  { key: 'Fixed', match: /Fixed/i },
];

const src = await readFile(file, 'utf8');
const lines = src.split(/\r?\n/);

// Bound the section to scan: a released version's <details> block (…</details>), or the In Progress
// section (…the next divider / collapsed release). Returns [start, end) or null when not found.
function sectionBounds() {
  if (release) {
    const esc = release.replace(/\./g, '\\.');
    const re = new RegExp(`${esc}\\s*[—-].*Released`, 'i');
    const start = lines.findIndex((l) => /<summary/.test(l) && re.test(l));
    if (start === -1) return null;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) { if (/^<\/details>/.test(lines[i])) { end = i; break; } }
    return [start, end];
  }
  const start = lines.findIndex((l) => /^##\s+.*In Progress/i.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) { if (/^---\s*$/.test(lines[i]) || /^<details>/.test(lines[i])) { end = i; break; } }
  return [start, end];
}

const bounds = sectionBounds();
if (!bounds) {
  process.stdout.write('- Maintenance and internal improvements.\n');
  process.exit(0);
}
const [start, end] = bounds;

const buckets = { Added: [], Removed: [], Fixed: [] };
let currentType = null;
let audienceIsUser = false;

for (let i = start + 1; i < end; i++) {
  const line = lines[i];
  if (/^####\s/.test(line)) {
    const t = TYPES.find((t) => t.match.test(line));
    currentType = t ? t.key : null;
    continue;
  }
  // Top-level bullet = an audience group header (👤 User-facing / 🛠️ Developer tooling / ⚙️ Backend).
  if (/^-\s+\*\*/.test(line)) {
    audienceIsUser = /User-facing/i.test(line);
    continue;
  }
  // Indented bullet under a 👤 group with a known change type = an entry; take its bold lead, dropping any
  // trailing period so the one-line notes read uniformly (bullets aren't full sentences).
  if (audienceIsUser && currentType) {
    const m = /^\s{2,}-\s+\*\*(.+?)\*\*/.exec(line);
    if (m) buckets[currentType].push(m[1].replace(/\*\*/g, '').trim().replace(/\.$/, ''));
  }
}

const out = [];
for (const { key } of TYPES) {
  if (buckets[key].length) {
    out.push(`### ${key}`, '', ...buckets[key].map((h) => `- ${h}`), '');
  }
}
process.stdout.write(out.length ? out.join('\n').trimEnd() + '\n' : '- Maintenance and internal improvements.\n');
