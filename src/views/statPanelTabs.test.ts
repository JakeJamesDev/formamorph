import { describe, it, expect } from 'vitest';
import { STAT_PANEL_TABS, statPanelTabsFor, statTabForField } from './statPanelTabs';

/**
 * The field-to-tab map behind Find's landing, and the tab set each editor mode shows.
 *
 * A search hit names a field key, not a tab, so this map is what turns one into the other. It is tested on
 * its own because the editor only ever exercises the keys its current fixture happens to hold, and a field
 * that grows a tab of its own has to be added here rather than silently landing on Details.
 */

describe('statTabForField', () => {
  it('puts the identity fields on Details', () => {
    expect(statTabForField('name')).toBe('details');
    expect(statTabForField('description')).toBe('details');
  });

  it('puts any descriptor row on Descriptors, whichever band the hit is in', () => {
    expect(statTabForField('descriptors[0].description')).toBe('descriptors');
    expect(statTabForField('descriptors[11].description')).toBe('descriptors');
  });

  it('answers nothing for a key it does not place', () => {
    // Code is searchable nowhere: `worldSearch` leaves stat code out, so no hit ever names it.
    expect(statTabForField('code')).toBeNull();
    expect(statTabForField('descriptors')).toBeNull();
    expect(statTabForField('')).toBeNull();
  });

  it('only ever names a tab the panel actually has', () => {
    const values = new Set<string>(STAT_PANEL_TABS.map((t) => t.value));
    for (const key of ['name', 'description', 'descriptors[0].description']) {
      expect(values.has(statTabForField(key) as string)).toBe(true);
    }
  });
});

describe('statPanelTabsFor', () => {
  it('shows all three tabs in Advanced mode', () => {
    expect(statPanelTabsFor(true).map((t) => t.value)).toEqual(['details', 'descriptors', 'code']);
  });

  it('leaves Simple mode one tab, which is what drops the strip', () => {
    expect(statPanelTabsFor(false).map((t) => t.value)).toEqual(['details']);
  });

  it('sends every Simple-mode field to a tab Simple mode still shows', () => {
    // Descriptors are Advanced-only and so are their search targets; Simple's own fields must all land.
    const simple = new Set<string>(statPanelTabsFor(false).map((t) => t.value));
    for (const key of ['name', 'description']) {
      expect(simple.has(statTabForField(key) as string)).toBe(true);
    }
  });
});
