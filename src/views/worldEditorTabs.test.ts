import { describe, expect, it } from 'vitest';
import { editorTabGroupsFor } from './worldEditorTabs';

const shape = (advanced: boolean) =>
  editorTabGroupsFor(advanced).map((group) => [group.label, group.tabs.map((tab) => tab.label)]);

describe('editorTabGroupsFor', () => {
  it('groups Simple mode as World and Text, with Dictionary alone in Text', () => {
    expect(shape(false)).toEqual([
      ['World', ['Overview', 'Stats', 'Entities', 'Locations', 'Traits']],
      ['Text', ['Dictionary']],
    ]);
  });

  it('adds Placeholders to Text in Advanced mode', () => {
    expect(shape(true)).toEqual([
      ['World', ['Overview', 'Stats', 'Entities', 'Locations', 'Traits']],
      ['Text', ['Dictionary', 'Placeholders']],
    ]);
  });

  it('leaves Logic out in both modes while it has no tab', () => {
    for (const advanced of [false, true]) {
      expect(editorTabGroupsFor(advanced).some((group) => group.id === 'logic')).toBe(false);
    }
  });
});
