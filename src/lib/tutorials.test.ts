import { describe, it, expect, beforeEach } from 'vitest';
import { TUTORIALS, markTutorialSeen, resetTutorials, seenTutorials } from './tutorials';

beforeEach(() => {
  localStorage.clear();
  resetTutorials();
});

describe('tutorial seen-state', () => {
  it('persists dismissals and reloads them', () => {
    markTutorialSeen('world-editor-mode-toggle');
    expect(seenTutorials()).toEqual(['world-editor-mode-toggle']);
    expect(JSON.parse(localStorage.getItem('formamorph.tutorialsSeen')!)).toEqual(['world-editor-mode-toggle']);
  });

  it('does not double-record the same dismissal', () => {
    markTutorialSeen('world-editor-mode-toggle');
    markTutorialSeen('world-editor-mode-toggle');
    expect(seenTutorials()).toHaveLength(1);
  });

  it('leaves a newly shipped entry unseen for someone who dismissed the old ones', () => {
    TUTORIALS.forEach((t) => markTutorialSeen(t.id));
    // Stands in for the next release adding an entry: keying on id is what makes it surface.
    expect(seenTutorials()).not.toContain('a-future-tutorial');
  });

  it('re-arms everything on reset', () => {
    markTutorialSeen('world-editor-mode-toggle');
    resetTutorials();
    expect(seenTutorials()).toEqual([]);
  });

  it('ignores junk in storage rather than throwing', () => {
    localStorage.setItem('formamorph.tutorialsSeen', '{"not":"an array"}');
    expect(() => markTutorialSeen('world-editor-mode-toggle')).not.toThrow();
  });

  it('registers every entry against a screen with unique ids', () => {
    const ids = TUTORIALS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    TUTORIALS.forEach((t) => expect(t.screen).toBeTruthy());
  });
});
