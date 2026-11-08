// Version the assembled website's image URLs before uploading it to Cloudflare Pages.
import { createHash } from 'node:crypto';
import { cpSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const files = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? files(path) : [path];
}).sort();
const HASHED_SCRIPT = /-[0-9a-f]{16}\.js$/;
export function versionSiteImages(root) {
  const shots = join(root, 'site/shots');
  const digest = createHash('sha256');
  // Every file counts, so a layout.js edit moves the path as a recapture does.
  for (const file of files(shots)) {
    digest.update(relative(shots, file).replaceAll('\\', '/'));
    digest.update('\0');
    digest.update(createHash('sha256').update(readFileSync(file)).digest());
  }
  const galleryPath = `/site/shots-${digest.digest('hex').slice(0, 16)}/`;
  const preview = readFileSync(join(root, 'site/og.jpg'));
  const previewPath = `/site/og-${createHash('sha256').update(preview).digest('hex').slice(0, 16)}.jpg`;
  // Keep the original URLs working for pages that are already open during deployment.
  cpSync(shots, join(root, galleryPath), { recursive: true });
  writeFileSync(join(root, previewPath), preview);
  // Scripts build frame paths in JS: rewrite, then name by content hash. Plain copies stay for open pages.
  const scriptPaths = new Map();
  const siteDir = join(root, 'site');
  const scripts = readdirSync(siteDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js') && !HASHED_SCRIPT.test(entry.name))
    .map((entry) => entry.name);
  for (const name of scripts) {
    const text = readFileSync(join(siteDir, name), 'utf8').replaceAll('/site/shots/', galleryPath);
    const hash = createHash('sha256').update(text).digest('hex').slice(0, 16);
    const versionedName = `${name.replace(/\.js$/, '')}-${hash}.js`;
    writeFileSync(join(siteDir, versionedName), text);
    scriptPaths.set(`/site/${name}`, `/site/${versionedName}`);
  }
  for (const file of files(root).filter((path) => path.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    let versioned = html.replaceAll('/site/shots/', galleryPath).replaceAll('/site/og.jpg', previewPath);
    // Whole quoted URLs only, so /site/hero.js never hits /site/hero.json.
    for (const [plain, hashed] of scriptPaths) {
      for (const quote of ['"', "'"]) versioned = versioned.replaceAll(`${quote}${plain}${quote}`, `${quote}${hashed}${quote}`);
    }
    if (versioned !== html) writeFileSync(file, versioned);
  }
  console.log(`Website images: ${galleryPath}, ${previewPath}`);
  return { galleryPath, previewPath, scriptPaths: Object.fromEntries(scriptPaths) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  versionSiteImages(process.argv[2] ?? 'out');
}
