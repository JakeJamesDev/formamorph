import { describe, it, expect } from 'vitest';
import { TRAIT_PANEL_TABS, traitPanelTabsFor, traitTabForField } from './traitPanelTabs';

/**
 * The field-to-tab map behind Find's landing, and the tab set each editor mode shows.
 *
 * A search hit names a field key, not a tab, so this map is what turns one into the other. It is tested on
 * its own because the editor only ever exercises the keys its current fixture happens to hold, and a field
 * that moves to another tab has to be corrected here rather than silently landing on Details.
 */

describe('traitTabForField', () => {
  it('puts the identity fields and both descriptions on Details', () => {
    expect(traitTabForField('name')).toBe('details');
    expect(traitTabForField('playerDescription')).toBe('details');
    expect(traitTabForField('aiDescription')).toBe('details');
  });

  it('puts any pinned value on Pins, whichever row the hit is in', () => {
    expect(traitTabForField('placeholderPins[0].value')).toBe('pins');
    expect(traitTabForField('placeholderPins[7].value')).toBe('pins');
  });

  it('answers nothing for a key it does not place', () => {
    // The stat rows carry no text, so `worldSearch` names no trait field on the Stats tab.
    expect(traitTabForField('statChanges[0].value')).toBeNull();
    expect(traitTabForField('placeholderPins')).toBeNull();
    expect(traitTabForField('')).toBeNull();
  });

  it('only ever names a tab the panel actually has', () => {
    const values = new Set<string>(TRAIT_PANEL_TABS.map((t) => t.value));
    for (const key of ['name', 'playerDescription', 'aiDescription', 'placeholderPins[0].value']) {
      expect(values.has(traitTabForField(key) as string)).toBe(true);
    }
  });
});

describe('traitPanelTabsFor', () => {
  it('shows all three tabs in Advanced mode', () => {
    expect(traitPanelTabsFor(true).map((t) => t.value)).toEqual(['details', 'stats', 'pins']);
  });

  it('drops Pins in Simple mode, which still leaves a strip', () => {
    expect(traitPanelTabsFor(false).map((t) => t.value)).toEqual(['details', 'stats']);
  });

  it('sends every Simple-mode field to a tab Simple mode still shows', () => {
    // Pins are Advanced-only and so are their search targets; Simple's own fields must all land.
    const simple = new Set<string>(traitPanelTabsFor(false).map((t) => t.value));
    for (const key of ['name', 'playerDescription', 'aiDescription']) {
      expect(simple.has(traitTabForField(key) as string)).toBe(true);
    }
  });
});
