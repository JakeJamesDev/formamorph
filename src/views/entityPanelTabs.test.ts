import { describe, it, expect } from 'vitest';
import {
  ENTITY_EDITOR_SUBTABS, ENTITY_EDITOR_TABS, ENTITY_PANEL_TABS, entityEditorTabForField, entityPanelTabsFor, entityTabForField,
} from './entityPanelTabs';
import { openingFieldKey } from '@/lib/openings';

/**
 * The field-to-tab map behind Find's landing.
 *
 * A search hit names a field key, not a tab, so this map is what turns one into the other. It is tested on
 * its own because the editor only ever exercises the keys its current fixture happens to hold, and a field
 * that grows a tab of its own has to be added here rather than silently landing on Profile.
 */

describe('entityTabForField', () => {
  it('puts the identity fields on Profile', () => {
    expect(entityTabForField('name')).toBe('profile');
    expect(entityTabForField('type')).toBe('profile');
    expect(entityTabForField('imageTags')).toBe('profile');
    expect(entityTabForField('pronouns')).toBe('profile');
  });

  it('puts any alias on Profile, whichever chip the hit is in', () => {
    expect(entityTabForField('aliases[0]')).toBe('profile');
    expect(entityTabForField('aliases[12]')).toBe('profile');
  });

  it('puts the three prose fields on Descriptions', () => {
    expect(entityTabForField('playerDescription')).toBe('descriptions');
    expect(entityTabForField('aiDescription')).toBe('descriptions');
    expect(entityTabForField('aiSummary')).toBe('descriptions');
  });

  it('puts every opening row on Openings', () => {
    expect(entityTabForField(openingFieldKey('o1'))).toBe('openings');
    expect(entityTabForField(openingFieldKey('another-id'))).toBe('openings');
  });

  it('answers nothing for a key it does not place', () => {
    expect(entityTabForField('locations')).toBeNull();
    expect(entityTabForField('')).toBeNull();
    // A group's name is a hit on the group panel, which has no tabs at all.
    expect(entityTabForField('aliases')).toBeNull();
  });

  it('only ever names a tab the panel actually has', () => {
    const values = new Set<string>(ENTITY_PANEL_TABS.map((t) => t.value));
    for (const key of ['name', 'aliases[0]', 'pronouns', 'type', 'imageTags', 'playerDescription', 'aiDescription', 'aiSummary']) {
      expect(values.has(entityTabForField(key) as string)).toBe(true);
    }
  });

  it('names tabs Simple mode still shows, so a hit is never sent to a hidden tab', () => {
    const simple = new Set<string>(entityPanelTabsFor(false).map((t) => t.value));
    for (const key of ['name', 'aliases[0]', 'pronouns', 'type', 'imageTags', 'playerDescription', 'aiDescription', 'aiSummary']) {
      expect(simple.has(entityTabForField(key) as string)).toBe(true);
    }
  });
});

describe('the library entity editor tabs', () => {
  it('put Placeholders on the top strip and every other panel tab on the Entity sub-strip', () => {
    expect(ENTITY_EDITOR_TABS.map((t) => t.value)).toEqual(['entity', 'placeholders']);
    expect(ENTITY_EDITOR_SUBTABS.map((t) => t.value)).toEqual(['profile', 'descriptions', 'openings']);
    const both = [...ENTITY_EDITOR_SUBTABS, ENTITY_EDITOR_TABS[1]].map((t) => t.value).sort();
    expect(both).toEqual(ENTITY_PANEL_TABS.map((t) => t.value).sort());
  });

  it('send a field to the Entity tab and the sub-tab that holds it', () => {
    expect(entityEditorTabForField('name')).toEqual({ tab: 'entity', subTab: 'profile' });
    expect(entityEditorTabForField('aliases[3]')).toEqual({ tab: 'entity', subTab: 'profile' });
    expect(entityEditorTabForField('aiSummary')).toEqual({ tab: 'entity', subTab: 'descriptions' });
    expect(entityEditorTabForField(openingFieldKey('o1'))).toEqual({ tab: 'entity', subTab: 'openings' });
  });

  it('leave the editor where it is for a key no tab claims', () => {
    expect(entityEditorTabForField('locations')).toBeNull();
    expect(entityEditorTabForField('')).toBeNull();
  });
});
