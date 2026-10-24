import { describe, expect, it } from 'vitest';
import { editorTabGroupsFor } from './worldEditorTabs';

/** Each slot as [caption, tab names]; the lone landing slot has no caption. */
const shape = (advanced: boolean) =>
  editorTabGroupsFor(advanced).map((group) => [group.label ?? null, group.tabs.map((tab) => tab.label)]);

describe('editorTabGroupsFor', () => {
  it('puts Overview and Media ahead of the groups, with Dictionary alone in Vocabulary in Simple mode', () => {
    expect(shape(false)).toEqual([
      [null, ['Overview', 'Media']],
      ['Content', ['Entities', 'Locations', 'Traits', 'Stats']],
      ['Vocabulary', ['Dictionary']],
    ]);
  });

  it('adds Placeholders to Vocabulary, and Scripts and Tools under Logic, in Advanced mode', () => {
    expect(shape(true)).toEqual([
      [null, ['Overview', 'Media']],
      ['Content', ['Entities', 'Locations', 'Traits', 'Stats']],
      ['Vocabulary', ['Dictionary', 'Placeholders']],
      ['Logic', ['Scripts', 'Tools']],
    ]);
  });

  it('leaves Logic out in Simple mode, where Scripts and Tools are hidden', () => {
    expect(editorTabGroupsFor(false).some((group) => group.id === 'logic')).toBe(false);
  });

  it('holds Overview and Media in the landing slot, under no group name', () => {
    const [landing] = editorTabGroupsFor(true);
    expect(landing.label).toBeUndefined();
    expect(landing.tabs.map((tab) => tab.value)).toEqual(['overview', 'media']);
  });
});
