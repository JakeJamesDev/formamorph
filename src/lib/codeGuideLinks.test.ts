import { describe, expect, it } from 'vitest';
import { codeCard } from '@/lib/codeCards';
import { STAT_CODE_GUIDE_LINKS, TOOL_GUIDE_LINKS } from '@/lib/codeGuideLinks';
import type { CodeSurface } from '@/lib/codeSurface';
import { helpTopicProblems, pageNameOf, type DocsPages } from '@/lib/docs/docsChecks';
import { docTargetId } from '@/lib/docs/docsLinks';
import { STAT_CODE_SURFACE } from '@/lib/statCodeSurface';
import { toolScriptSurface } from '@/lib/tools/toolScriptSurface';

const DOCS: DocsPages = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../../docs/*.md', { query: '?raw', import: 'default', eager: true })).map(
    ([path, md]) => [pageNameOf(path), md],
  ),
);

/** Each table row as a help topic, so the docs link check reads it: the page exists, is a guide page, and has the heading. */
const asTopics = (table: Readonly<Record<string, { page: string; anchor?: string }>>) =>
  Object.fromEntries(Object.entries(table).map(([name, { page, anchor }]) => [name, { wikiPage: page, wikiAnchor: anchor }]));

const globalsOf = (surface: CodeSurface) => surface.globals.map((entry) => entry.name).filter((name) => name !== 'console');

describe('the Guide link table', () => {
  it('resolves every stat code row to a heading of the Guide', () => {
    expect(helpTopicProblems(asTopics(STAT_CODE_GUIDE_LINKS), DOCS)).toEqual([]);
  });

  it('resolves every Tool row to a heading of the Tools doc', () => {
    expect(helpTopicProblems(asTopics(TOOL_GUIDE_LINKS), DOCS)).toEqual([]);
  });

  it('has a row for every stat code global, and none for a name the sandbox lacks', () => {
    expect(Object.keys(STAT_CODE_GUIDE_LINKS).sort()).toEqual(globalsOf(STAT_CODE_SURFACE).sort());
  });

  it('has a row for every Tool global, and none for a name the sandbox lacks', () => {
    expect(Object.keys(TOOL_GUIDE_LINKS).sort()).toEqual(globalsOf(toolScriptSurface([])).sort());
  });

  it('points the three owner-route globals at the headings the Guide gives them', () => {
    expect(['self', 'stats', 'owner'].map((name) => docTargetId(STAT_CODE_GUIDE_LINKS[name]))).toEqual([
      'StatCodeGuide#self', 'StatCodeGuide#stats', 'StatCodeGuide#owner',
    ]);
  });
});

describe('the Guide link on a global’s card', () => {
  const linkOf = (code: string, at: number, surface: CodeSurface) =>
    codeCard(code, at, { surface })?.links?.find((link) => link.id === 'guide');

  it.each(globalsOf(STAT_CODE_SURFACE))('carries the stat code row of %s', (name) => {
    expect(linkOf(name, 1, STAT_CODE_SURFACE)).toEqual({ id: 'guide', target: STAT_CODE_GUIDE_LINKS[name] });
  });

  it.each(globalsOf(toolScriptSurface([])))('carries the Tool row of %s', (name) => {
    expect(linkOf(name, 1, toolScriptSurface([]))).toEqual({ id: 'guide', target: TOOL_GUIDE_LINKS[name] });
  });

  it('reads the row of the surface the code is in, as placeholders sits in both tables', () => {
    expect(linkOf('placeholders', 1, STAT_CODE_SURFACE)).toMatchObject({ target: { page: 'StatCodeGuide' } });
    expect(linkOf('placeholders', 1, toolScriptSurface([]))).toMatchObject({ target: { page: 'Tools' } });
  });

  it('leaves console, a member and a built-in without one', () => {
    expect(linkOf('console', 1, STAT_CODE_SURFACE)).toBeUndefined();
    expect(linkOf('self.value', 6, STAT_CODE_SURFACE)).toBeUndefined();
    expect(linkOf('Math', 1, STAT_CODE_SURFACE)).toBeUndefined();
  });
});
