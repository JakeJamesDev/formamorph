// Version the assembled website's image URLs before uploading it to Cloudflare Pages.
import { createHash } from 'node:crypto';
import { cpSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const files = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? files(path) : [path];
}).sort();
export function versionSiteImages(root) {
  const shots = join(root, 'site/shots');
  const digest = createHash('sha256');
  for (const file of files(shots).filter((path) => path.endsWith('.webp'))) {
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
  for (const file of files(root).filter((path) => path.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    const versioned = html.replaceAll('/site/shots/', galleryPath).replaceAll('/site/og.jpg', previewPath);
    if (versioned !== html) writeFileSync(file, versioned);
  }
  console.log(`Website images: ${galleryPath}, ${previewPath}`);
  return { galleryPath, previewPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  versionSiteImages(process.argv[2] ?? 'out');
}
