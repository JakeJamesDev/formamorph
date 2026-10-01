// The Docs Index as it was at a git commit: that commit's index code over that commit's docs pages, so a
// probe can compare the search before and after a change in one run.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { releasedMinorChangelog } from '@/lib/docs/changelogSlice';
import { NON_GUIDE_PAGES, pageNameOf, SIDEBAR_PAGE, type DocsPages } from '@/lib/docs/docsChecks';
import type { DocsIndex, DocsIndexInput } from '@/lib/docs/docsIndex';

/** Extracts `src/lib/docs` and `docs` at `ref` into `.scratch/docs-ref/<sha>` once, and builds its index. */
export async function refDocsIndex(ref: string): Promise<{ sha: string; index: DocsIndex }> {
  const sha = execSync(`git rev-parse --short ${ref}`, { encoding: 'utf8' }).trim();
  const dir = path.resolve('.scratch/docs-ref', sha);
  if (!existsSync(path.join(dir, 'src/lib/docs/docsIndex.ts'))) {
    mkdirSync(dir, { recursive: true });
    const archive = execSync(`git archive ${sha} src/lib/docs docs`, { maxBuffer: 1 << 28 });
    execSync('tar -x', { cwd: dir, input: archive });
  }
  const docsDir = path.join(dir, 'docs');
  const read = (file: string) => readFileSync(path.join(docsDir, file), 'utf8');
  const pages: DocsPages = Object.fromEntries(
    readdirSync(docsDir)
      .filter((file) => file.endsWith('.md') && !NON_GUIDE_PAGES.includes(pageNameOf(file)))
      .map((file) => [pageNameOf(file), file === 'Changelog.md' ? releasedMinorChangelog(read(file)) : read(file)]),
  );
  const module = await import(pathToFileURL(path.join(dir, 'src/lib/docs/docsIndex.ts')).href) as {
    createDocsIndex: (input: DocsIndexInput) => DocsIndex;
  };
  return { sha, index: module.createDocsIndex({ pages, sidebar: read(`${SIDEBAR_PAGE}.md`) }) };
}
