import { describe, expect, it } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { helpSections } from './helpSession';

const ids = (question: string) => helpSections(bundledDocsIndex(), question).map((section) => section.id);

describe('filler words in a help question', () => {
  it('sends no Formaquestion section for "what am I looking at here?" with no surface', () => {
    expect(ids('What am I looking at here?').filter((id) => id.startsWith('Formaquestion'))).toEqual([]);
  });

  it('still finds Help for This Screen by its name', () => {
    expect(ids('How do I use Help for This Screen?').some((id) => id.startsWith('Formaquestion'))).toBe(true);
  });
});
