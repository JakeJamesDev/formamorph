import { describe, it, expect } from 'vitest';
import { ENTITY_PANEL_TABS, entityPanelTabsFor, entityTabForField } from './entityPanelTabs';

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

  it('answers nothing for a key it does not place', () => {
    expect(entityTabForField('locations')).toBeNull();
    expect(entityTabForField('')).toBeNull();
    // A group's name is a hit on the group panel, which has no tabs at all.
    expect(entityTabForField('aliases')).toBeNull();
  });

  it('only ever names a tab the panel actually has', () => {
    const values = new Set<string>(ENTITY_PANEL_TABS.map((t) => t.value));
    for (const key of ['name', 'aliases[0]', 'type', 'imageTags', 'playerDescription', 'aiDescription', 'aiSummary']) {
      expect(values.has(entityTabForField(key) as string)).toBe(true);
    }
  });

  it('names tabs Simple mode still shows, so a hit is never sent to a hidden tab', () => {
    const simple = new Set<string>(entityPanelTabsFor(false).map((t) => t.value));
    for (const key of ['name', 'aliases[0]', 'type', 'imageTags', 'playerDescription', 'aiDescription', 'aiSummary']) {
      expect(simple.has(entityTabForField(key) as string)).toBe(true);
    }
  });
});
