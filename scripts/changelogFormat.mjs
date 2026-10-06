// The shape of docs/Changelog.md's entry list, in one place: extractReleaseNotes.mjs reads it to build the
// release notes, and changelogFormat.test.mjs lints the unreleased section against it, so the generator and
// the guard can't drift apart.
//
// Under an audience group (`- **👤 User-facing**`), a bullet indented two spaces is an entry, and a bullet
// indented four is nested under the one above it. An entry whose bold lead ends in a colon is a feature
// group header: it names the surface its children touch and carries no change of its own.

/** Parse one bullet line into an entry, or null when the line isn't one (prose, blank, an audience header). */
export function parseEntry(line) {
  const m = /^(\s{2,})-\s+\*\*(.+?)\*\*/.exec(line);
  if (!m) return null;
  const text = m[2].replace(/\*\*/g, '').trim().replace(/\.$/, '');
  const header = text.endsWith(':');
  return {
    depth: m[1].length >= 4 ? 1 : 0,
    text: header ? text.slice(0, -1).trim() : text,
    header,
  };
}

/** The most words an entry's bold lead and its body may hold. A feature that needs more is a group of entries. */
export const LEAD_WORDS = 20;
export const BODY_WORDS = 40;

const words = (text) => text.split(/\s+/).filter(Boolean).length;

/** Is this line an indented bullet with no bold lead? Those ship nothing, so they're a format error. */
function isUnleadBullet(line) {
  return /^\s{2,}-\s/.test(line) && !/^\s{2,}-\s+\*\*/.test(line);
}

/** Lint a slice of changelog lines (one release section). Returns a list of human-readable problems; an
 *  empty list means the section is well-formed. Checks the three things the extractor cannot recover from
 *  (a group with fewer than two children, a bullet with no bold lead, nesting past one level), and the
 *  word limits on each entry's lead and body. */
export function lintSection(lines) {
  const problems = [];
  let openHeader = null; // { text, children }

  const closeHeader = () => {
    if (openHeader && openHeader.children < 2) {
      problems.push(`Group "${openHeader.text}" has ${openHeader.children} child entries; a group needs at least 2.`);
    }
    openHeader = null;
  };

  for (const line of lines) {
    if (/^\s{6,}-\s/.test(line)) {
      problems.push(`Nested past one level: ${line.trim()}`);
      continue;
    }
    if (isUnleadBullet(line)) {
      problems.push(`Bullet has no bold lead (it would ship nothing): ${line.trim()}`);
      continue;
    }
    const entry = parseEntry(line);
    if (!entry) {
      // A new audience group or change-type heading ends whatever group was open.
      if (/^(-\s+\*\*|####\s|###\s|##\s)/.test(line)) closeHeader();
      continue;
    }
    if (!entry.header) {
      const lead = words(entry.text);
      const body = words(line.replace(/^\s*-\s+\*\*.+?\*\*/, ''));
      if (lead > LEAD_WORDS) problems.push(`Lead has ${lead} words; the limit is ${LEAD_WORDS}: ${entry.text}`);
      if (body > BODY_WORDS) problems.push(`Body has ${body} words; the limit is ${BODY_WORDS}: ${entry.text}`);
    }
    if (entry.depth === 1) {
      if (openHeader) openHeader.children += 1;
      else problems.push(`Indented entry with no group header above it: ${entry.text}`);
      continue;
    }
    closeHeader();
    if (entry.header) openHeader = { text: entry.text, children: 0 };
  }
  closeHeader();
  return problems;
}

/** Line bounds of the newest collapsed release — the first `<details>` block in the file. Older releases
 *  predate the group format and aren't linted; this one is whatever the last release closed. */
export function latestReleaseBounds(lines) {
  const start = lines.findIndex((l) => /^<details>/.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^<\/details>/.test(lines[i])) { end = i; break; }
  }
  return [start, end];
}

/** The most entries a feature group holds once its spec closes. Close-spec merges a larger group down;
 *  it is not a gate, because a group grows ticket by ticket while its effort is open. */
export const GROUP_ENTRIES = 12;

/** Every feature group in a slice of changelog lines with more than `max` entries, as { text, entries }. */
export function oversizeGroups(lines, max = GROUP_ENTRIES) {
  const groups = [];
  let open = null;
  for (const line of lines) {
    const entry = parseEntry(line);
    if (!entry) {
      if (/^(-\s+\*\*|####\s|###\s|##\s)/.test(line)) open = null;
      continue;
    }
    if (entry.depth === 0) {
      open = entry.header ? { text: entry.text, entries: 0 } : null;
      if (open) groups.push(open);
    } else if (open) {
      open.entries += 1;
    }
  }
  return groups.filter((group) => group.entries > max);
}

/** Line bounds of one collapsed release, found by the version in its summary, or null when it is absent. */
export function releaseBounds(lines, version) {
  const summary = lines.findIndex((l) => l.includes(`✅ ${version} — Released`));
  if (summary === -1) return null;
  const end = lines.findIndex((l, i) => i > summary && /^<\/details>/.test(l));
  return [summary - 1, end === -1 ? lines.length : end];
}

/** Line bounds of the unreleased section: from the `## 🚧 In Progress` heading to the next divider or
 *  collapsed release. Returns [start, end) or null when the section is absent. */
export function inProgressBounds(lines) {
  const start = lines.findIndex((l) => /^##\s+.*In Progress/i.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i]) || /^<details>/.test(lines[i])) { end = i; break; }
  }
  return [start, end];
}
