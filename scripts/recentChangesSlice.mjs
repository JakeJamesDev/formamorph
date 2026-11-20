// The Recent Changes tab's text: the bold leads of the released sections for the installed version and the
// releases before it, cut from docs/Changelog.md at build time (vite.config.js `virtual:whats-new-recent`).
// Separate from the Docs Index slice (src/lib/docs/changelogSlice.ts), which keeps its own shape.
import { collectLeads, LEAD_TYPES } from './changelogFormat.mjs';

const RELEASED = /^<summary><strong>✅ (\d+)\.(\d+)\.(\d+) — Released\b/;
// An emphasis-only paragraph, which ChangelogBody renders as a muted line.
const MAINTENANCE = '_Maintenance and internal improvements._';

/** `3.8.0-beta.1` → `{ core: [3, 8, 0], pre: true }`, or null when the text is no version. */
function parseVersion(text) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(-.+)?$/.exec(text.trim());
  return m ? { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: Boolean(m[4]) } : null;
}

const compareCore = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** The released sections of the changelog, newest first, as { core, start, end } line bounds. */
function releasedSections(lines) {
  const sections = [];
  lines.forEach((line, start) => {
    const m = RELEASED.exec(line);
    if (!m) return;
    const close = lines.findIndex((l, i) => i > start && /^<\/details>/.test(l));
    sections.push({ core: [Number(m[1]), Number(m[2]), Number(m[3])], start, end: close === -1 ? lines.length : close });
  });
  return sections.sort((a, b) => compareCore(b.core, a.core));
}

const row = (e) => `${'  '.repeat(e.depth)}- ${e.header ? `**${e.text}**` : e.text}`;

/**
 * Markdown for the newest `count` released sections at or below `version`. A pre-release sorts below its own
 * release, so it never takes that release's section. Each version is a `### v<version>` heading under a
 * `## v<major>.<minor>` heading, with its 👤 leads under bold Added / Removed / Fixed labels.
 */
export function recentChanges(changelog, version, count = 3) {
  const installed = parseVersion(version);
  if (!installed) return '';
  const lines = changelog.split(/\r?\n/);
  const picked = releasedSections(lines)
    .filter((s) => { const c = compareCore(s.core, installed.core); return c < 0 || (c === 0 && !installed.pre); })
    .slice(0, count);

  const out = [];
  let series = '';
  for (const { core, start, end } of picked) {
    const minor = `${core[0]}.${core[1]}`;
    if (minor !== series) {
      series = minor;
      out.push(`## v${minor}`, '');
    }
    out.push(`### v${core.join('.')}`, '');
    const buckets = collectLeads(lines, start, end);
    const filled = LEAD_TYPES.filter(({ key }) => buckets[key].length);
    if (!filled.length) out.push(MAINTENANCE, '');
    for (const { key } of filled) out.push(`**${key}**`, '', ...buckets[key].map(row), '');
  }
  return out.join('\n').trimEnd();
}
