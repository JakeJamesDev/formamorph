/**
 * The part of the changelog the Docs Index holds: the released sections of the newest minor series. The
 * build runs this on `docs/Changelog.md` (see `vite.config.js`), so the rest never reaches the bundle. No
 * imports, because the Vite config loads this file.
 */

const SUMMARY = /^<summary><strong>(.*?)<\/strong>(.*)<\/summary>\s*$/;
const RELEASED = /(\d+)\.(\d+)\.\d+\s+—\s+Released\b/;
const CLICK_HINT = /\s*\(click to expand\)\s*$/;

/** One released section: its version line, its tagline and its body. */
interface ReleaseBlock {
  title: string;
  series: string;
  tagline: string;
  body: string[];
}

function releaseBlocks(lines: string[]): ReleaseBlock[] {
  const blocks: ReleaseBlock[] = [];
  let current: ReleaseBlock | null = null;
  for (const line of lines) {
    const summary = SUMMARY.exec(line);
    const released = summary && RELEASED.exec(summary[1]);
    if (summary && released) {
      current = {
        title: summary[1].trim(),
        series: `${released[1]}.${released[2]}`,
        tagline: summary[2].replace(/^\s*—\s*/, '').replace(CLICK_HINT, ''),
        body: [],
      };
      blocks.push(current);
    } else if (line.trim() === '</details>') {
      current = null;
    } else if (current) {
      current.body.push(line);
    }
  }
  return blocks;
}

/**
 * The changelog's title and each released section of the newest minor series, newest first. Each section
 * becomes a `##` heading named by its version line, so the index splits the changelog like any page.
 *
 * @param markdown - The whole changelog page
 */
export function releasedMinorChangelog(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const title = lines.find((line) => line.startsWith('# ')) ?? '# Changelog';
  const blocks = releaseBlocks(lines);
  const series = blocks[0]?.series;
  const kept = blocks.filter((block) => block.series === series);
  return [
    title,
    ...kept.map((block) => [`## ${block.title}`, '', block.tagline, ...block.body].join('\n').trimEnd()),
  ].join('\n\n') + '\n';
}
