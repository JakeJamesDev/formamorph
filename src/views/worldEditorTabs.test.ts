import { describe, expect, it } from 'vitest';
import { editorTabGroupsFor } from './worldEditorTabs';

/** Each slot as [caption, tab names]; the lone landing slot has no caption. */
const shape = (advanced: boolean) =>
  editorTabGroupsFor(advanced).map((group) => [group.label ?? null, group.tabs.map((tab) => tab.label)]);

describe('editorTabGroupsFor', () => {
  it('puts Overview alone ahead of the groups, with Dictionary alone in Vocabulary in Simple mode', () => {
    expect(shape(false)).toEqual([
      [null, ['Overview']],
      ['Content', ['Stats', 'Entities', 'Locations', 'Traits']],
      ['Vocabulary', ['Dictionary']],
    ]);
  });

  it('adds Placeholders to Vocabulary in Advanced mode', () => {
    expect(shape(true)).toEqual([
      [null, ['Overview']],
      ['Content', ['Stats', 'Entities', 'Locations', 'Traits']],
      ['Vocabulary', ['Dictionary', 'Placeholders']],
    ]);
  });

  it('leaves Logic out in both modes while it has no tab', () => {
    for (const advanced of [false, true]) {
      expect(editorTabGroupsFor(advanced).some((group) => group.id === 'logic')).toBe(false);
    }
  });

  it('holds Overview alone in the landing slot, under no group name', () => {
    const [landing] = editorTabGroupsFor(true);
    expect(landing.label).toBeUndefined();
    expect(landing.tabs.map((tab) => tab.value)).toEqual(['overview']);
  });
});
