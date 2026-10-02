import { describe, expect, it } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { helpSections } from './helpSession';
import { surfaceHint } from './surfaceHint';

const index = bundledDocsIndex();
const ids = (question: string) => helpSections(index, question).map((section) => section.id);
const idsOn = (question: string, dialog: SurfaceId) => {
  const lead = surfaceHint({ screen: 'menu', dialog, tabs: [] }, index)?.section;
  return helpSections(index, question, { lead }).map((section) => section.id);
};

describe('filler words in a help question', () => {
  it('sends no Formaquestion section for "what am I looking at here?" with no surface', () => {
    expect(ids('What am I looking at here?').filter((id) => id.startsWith('Formaquestion'))).toEqual([]);
  });

  it('still finds Help for This Screen by its name', () => {
    expect(ids('How do I use Help for This Screen?').some((id) => id.startsWith('Formaquestion'))).toBe(true);
  });
});

describe('screen words in a question over a screen', () => {
  it('sends no Formaquestion section for "what does this window do?" over Backup & Restore', () => {
    const found = idsOn('What does this window do?', 'backup');
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((id) => id.startsWith('Formaquestion'))).toEqual([]);
  });

  it('still finds the Formaquestion window section for "how do I move the help window?" with no surface', () => {
    expect(ids('How do I move the help window?').some((id) => id.startsWith('Formaquestion'))).toBe(true);
  });
});
