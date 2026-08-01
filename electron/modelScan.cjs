// Finds GGUF models across the app's own models folder and one optional external folder (an existing
// LM Studio / Ollama library the user already downloaded). Kept separate from main.cjs so the scan and
// path-confinement rules are unit-testable. Loading stays ref-based — see resolveModelRef.
const fs = require('fs');
const path = require('path');

// How deep to recurse under the external folder. LM Studio nests publisher/repo/file (2), so this is
// slack, not a target; it bounds the walk if a user points us at a huge tree.
const MAX_DEPTH = 6;

// Prefix marking a ref as living in the external folder. Root models keep their bare filename as their
// ref, so orderings and served model ids from before this feature keep working untouched.
const EXTERNAL_PREFIX = 'ext:';

const isGguf = (name) => name.toLowerCase().endsWith('.gguf');

/** Absolute, normalized path with a trailing-separator-safe form for containment checks. */
const norm = (p) => path.resolve(p);

/** True when `child` is `base` or sits inside it. Both must already be absolute. */
function isInside(base, child) {
  if (child === base) return true;
  return child.startsWith(base.endsWith(path.sep) ? base : base + path.sep);
}

/** GGUFs directly in `dir` (never recursive), as [{ absPath, relPath }]. Missing dir yields []. */
function scanFlat(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter(isGguf).map((n) => ({ absPath: path.join(dir, n), relPath: n }));
}

/** GGUFs under `dir` down to MAX_DEPTH. Symlinked directories are skipped so a link loop (or a link out
 *  of the chosen folder) can't run away or escape confinement. */
function scanDeep(dir, depth = 0, base = dir) {
  if (depth > MAX_DEPTH) return [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isSymbolicLink()) {
      // Symlinked files are fine (users link GGUFs between apps); only don't *descend* through links.
      if (isGguf(e.name)) out.push({ absPath: abs, relPath: path.relative(base, abs) });
      continue;
    }
    if (e.isDirectory()) out.push(...scanDeep(abs, depth + 1, base));
    else if (isGguf(e.name)) out.push({ absPath: abs, relPath: path.relative(base, abs) });
  }
  return out;
}

/** Size in bytes, or 0 when the file can't be stat'd. */
function sizeOf(absPath) {
  try { return fs.statSync(absPath).size; } catch { return 0; }
}

/**
 * Every GGUF the app can load: the root models folder (always flat) plus the configured external folder
 * (flat, or recursive when searchSubfolders). External hits that resolve inside the root folder are
 * dropped so pointing the external setting at a parent of root can't list everything twice.
 *
 * Entries carry a stable ref (`id`), the containing folder relative to its base (`subpath`, '' at the
 * top level), and the absolute path so the UI can tell which row is the loaded one by path rather than
 * by a filename two folders could share.
 */
function scanModels({ rootDir, externalDir, searchSubfolders }) {
  const root = norm(rootDir);
  const entry = (source, absPath, relPath) => ({
    id: source === 'root' ? path.basename(relPath) : EXTERNAL_PREFIX + relPath.split(path.sep).join('/'),
    fileName: path.basename(relPath),
    subpath: path.dirname(relPath) === '.' ? '' : path.dirname(relPath).split(path.sep).join('/'),
    size: sizeOf(absPath),
    path: absPath,
    source,
  });

  const out = scanFlat(root).map((f) => entry('root', f.absPath, f.relPath));

  if (externalDir) {
    const ext = norm(externalDir);
    // An external folder equal to root would duplicate every row; treat it as unset.
    if (ext !== root) {
      const found = searchSubfolders ? scanDeep(ext) : scanFlat(ext);
      for (const f of found) {
        if (isInside(root, norm(f.absPath))) continue;
        out.push(entry('external', f.absPath, f.relPath));
      }
    }
  }

  out.sort((a, b) => a.fileName.localeCompare(b.fileName) || a.id.localeCompare(b.id));
  return out;
}

/**
 * Turn a model ref back into an absolute path, or null if it doesn't resolve inside its own base folder.
 * This is the only place a renderer-supplied string becomes a path to load, so traversal (`../`) and
 * absolute refs are rejected here rather than trusted — no arbitrary-path load is reachable over IPC.
 */
function resolveModelRef(ref, { rootDir, externalDir }) {
  if (typeof ref !== 'string' || !ref) return null;
  const external = ref.startsWith(EXTERNAL_PREFIX);
  const baseDir = external ? externalDir : rootDir;
  if (!baseDir) return null;
  const rel = external ? ref.slice(EXTERNAL_PREFIX.length) : path.basename(ref);
  if (!rel || path.isAbsolute(rel)) return null;
  const base = norm(baseDir);
  const target = norm(path.join(base, rel));
  if (!isInside(base, target) || target === base) return null;
  if (!isGguf(target)) return null;
  return target;
}

/** True when the ref points at the app's own models folder (the only place we download to or delete from). */
const isRootRef = (ref) => typeof ref === 'string' && !ref.startsWith(EXTERNAL_PREFIX);

module.exports = { scanModels, resolveModelRef, isRootRef, EXTERNAL_PREFIX, MAX_DEPTH };
