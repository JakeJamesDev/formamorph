import { describe, expect, it } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { helpSections, type EarlierExchange } from './helpSession';
import { traceSource } from './helpTrace';
import { docSectionsOf, isWorldSource, sourceKey, type WorldSource } from './helpWorldSource';

const index = bundledDocsIndex();

const sister: WorldSource = { kind: 'world', worldKind: 'entity', id: 'e-1', name: 'Mira' };
const toolSection = index.get(['Tools#how-to-make-a-tool']);

const ids = (question: string, history: EarlierExchange[]) => helpSections(index, question, { history }).map((section) => section.id);

describe('a world source in an earlier answer', () => {
  const earlier = (sources: EarlierExchange['sources']): EarlierExchange => ({ question: 'Can I write my own function that the AI calls during the story?', answer: '1. Select **Add**.', sources });

  it('keeps the page favoring of a guide section that comes first', () => {
    expect(ids('How do I test it?', [earlier([...toolSection, sister])])[0]).toBe('Tools#how-to-try-a-tool');
  });

  it('favors no page when the topic is a world source', () => {
    expect(ids('How do I test it?', [earlier([sister])])[0]).not.toMatch(/^Tools#/);
    expect(ids('How do I test it?', [earlier([sister, ...toolSection])])[0]).not.toMatch(/^Tools#/);
  });

  it('takes a world source as the topic even when a guide section is the lead', () => {
    const [lead] = toolSection;
    expect(ids('How do I test it?', [{ ...earlier([lead, sister]), lead }])[0]).not.toMatch(/^Tools#/);
  });
});

describe('the world source helpers', () => {
  it('tells a world source from a section', () => {
    expect(isWorldSource(sister)).toBe(true);
    expect(isWorldSource(toolSection[0])).toBe(false);
    expect(docSectionsOf([sister, ...toolSection])).toEqual(toolSection);
  });

  it('keys a world source by kind and id, a section by its id', () => {
    expect(sourceKey(sister)).toBe('entity:e-1');
    expect(sourceKey(toolSection[0])).toBe(toolSection[0].id);
  });

  it('keeps a world source whole in the trace and cuts a section to its name', () => {
    expect(traceSource(sister)).toEqual(sister);
    expect(Object.keys(traceSource(toolSection[0])).sort()).toEqual(['id', 'label', 'page']);
  });
});
