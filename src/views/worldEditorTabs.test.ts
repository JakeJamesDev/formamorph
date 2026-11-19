import { describe, expect, it } from 'vitest';
import { editorTabGroupsFor } from './worldEditorTabs';

/** Each slot as [caption, tab names]; the lone landing slot has no caption. */
const shape = (advanced: boolean) =>
  editorTabGroupsFor(advanced).map((group) => [group.label ?? null, group.tabs.map((tab) => tab.label)]);

describe('editorTabGroupsFor', () => {
  it('puts Overview and Media ahead of the groups, with Dictionary alone in Vocabulary and Options alone in Logic in Simple mode', () => {
    expect(shape(false)).toEqual([
      [null, ['Overview', 'Media']],
      ['Content', ['Entities', 'Locations', 'Items', 'Traits', 'Stats']],
      ['Vocabulary', ['Dictionary']],
      ['Logic', ['Options']],
    ]);
  });

  it('adds Openings after Overview, Placeholders to Vocabulary, and Scripts and Tools above Options in Logic, in Advanced mode', () => {
    expect(shape(true)).toEqual([
      [null, ['Overview', 'Openings', 'Media']],
      ['Content', ['Entities', 'Locations', 'Items', 'Traits', 'Stats']],
      ['Vocabulary', ['Dictionary', 'Placeholders']],
      ['Logic', ['Scripts', 'Tools', 'Options']],
    ]);
  });

  it('hides Scripts and Tools from Logic in Simple mode', () => {
    expect(editorTabGroupsFor(false).find((group) => group.id === 'logic')?.tabs.map((tab) => tab.value)).toEqual(['options']);
  });

  it('holds Overview, Openings and Media in the landing slot, under no group name', () => {
    const [landing] = editorTabGroupsFor(true);
    expect(landing.label).toBeUndefined();
    expect(landing.tabs.map((tab) => tab.value)).toEqual(['overview', 'openings', 'media']);
  });
});
