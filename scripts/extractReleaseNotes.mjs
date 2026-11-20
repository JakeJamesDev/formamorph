// Derive terse, user-facing release notes from docs/Changelog.md. Takes the bold lead sentence of each 👤 User-facing entry,
// grouped by change type (Added / Removed / Fixed); drops 🛠️/⚙️ dev entries. The verbose changelog stays the
// single source of truth — this is a generated view, never hand-maintained.
//
// Usage:
//   node scripts/extractReleaseNotes.mjs                 → the "🚧 In Progress" section
//   node scripts/extractReleaseNotes.mjs --release 3.0.0 → a specific released version's collapsed section
//     (an older major lives in its archive: add --file docs/Changelog-v2.md)
//   node scripts/extractReleaseNotes.mjs --file path.md  → read a different changelog file
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectLeads, inProgressBounds, LEAD_TYPES } from './changelogFormat.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const file = argVal('--file') || path.join(ROOT, 'docs', 'Changelog.md');
const release = argVal('--release');

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
  return inProgressBounds(lines);
}

const bounds = sectionBounds();
if (!bounds) {
  process.stdout.write('- Maintenance and internal improvements.\n');
  process.exit(0);
}
const [start, end] = bounds;

// A feature group header emits bold, and the entries beneath it stay nested under it.
const buckets = collectLeads(lines, start, end);

const out = [];
for (const { key } of LEAD_TYPES) {
  if (buckets[key].length) {
    const rows = buckets[key].map((e) => `${'  '.repeat(e.depth)}- ${e.header ? `**${e.text}**` : e.text}`);
    out.push(`### ${key}`, '', ...rows, '');
  }
}
process.stdout.write(out.length ? out.join('\n').trimEnd() + '\n' : '- Maintenance and internal improvements.\n');
