import { describe, expect, it } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { helpSections, type EarlierExchange } from './helpSession';

const index = bundledDocsIndex();

/** An earlier exchange whose answer came from these sections. */
const answered = (question: string, sourceIds: string[]): EarlierExchange =>
  ({ question, answer: '1. Select **Add**.', sources: index.get(sourceIds) });

const toolAnswer = answered('Can I write my own function that the AI calls during the story?', ['Tools#how-to-make-a-tool']);
const ids = (question: string, history: EarlierExchange[]) => helpSections(index, question, { history }).map((section) => section.id);

describe('a follow-up after an answer', () => {
  it('sends a Tools section for "How do I test it?" after a Tool answer', () => {
    expect(ids('How do I test it?', [toolAnswer])[0]).toBe('Tools#how-to-try-a-tool');
  });

  it('sends the section of a feature the follow-up names', () => {
    expect(ids('How do I preview the opening in the Test Bench?', [toolAnswer])[0]).toBe('Test-Bench#how-to-preview-the-opening');
  });

  it('favors no page when the earlier answer had no sources', () => {
    expect(ids('How do I test it?', [{ ...toolAnswer, sources: [] }])[0]).not.toMatch(/^Tools#/);
  });

  it('favors no page after an answer that did not come from the guide', () => {
    expect(ids('How do I test it?', [{ ...toolAnswer, flagged: true }])[0]).not.toMatch(/^Tools#/);
  });
});

describe('the favored page in the search', () => {
  const pages = {
    Tools: '# Tools\n\n## How to Try a Tool\n\nTest the tool here.\n',
    Bench: '# Bench\n\n## Checks\n\nTest the world here.\n\n## How to Test a Bench Opening\n\nTest the opening bench.\n',
  };
  const small = createDocsIndex({ pages, sidebar: '- [Bench](Bench)\n- [Tools](Tools)\n' });

  const order = (favor?: { page: string }) => small.search('test', 5, favor).map((section) => section.id);

  it('ranks the page above a match of the same strength', () => {
    expect(order().indexOf('Bench#checks')).toBeLessThan(order().indexOf('Tools#how-to-try-a-tool'));
    expect(order({ page: 'Tools' }).indexOf('Tools#how-to-try-a-tool')).toBeLessThan(order({ page: 'Tools' }).indexOf('Bench#checks'));
  });

  it('keeps a match of more words above the page', () => {
    expect(small.search('test bench opening', 5, { page: 'Tools' })[0].id).toBe('Bench#how-to-test-a-bench-opening');
  });
});
