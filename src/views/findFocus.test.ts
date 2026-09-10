import { describe, expect, it } from 'vitest';
import { focusFieldForItem, tabForField } from './findFocus';

const TABS = { name: 'profile', 'aliases[]': 'profile', aiSummary: 'descriptions' } as const;

describe('tabForField', () => {
  it('answers the tab a plain key is mapped to', () => {
    expect(tabForField('name', TABS)).toBe('profile');
    expect(tabForField('aiSummary', TABS)).toBe('descriptions');
  });

  it('matches an indexed array key against its bracket entry', () => {
    expect(tabForField('aliases[0]', TABS)).toBe('profile');
    expect(tabForField('aliases[12]', TABS)).toBe('profile');
  });

  it('answers null for a key no tab claims', () => {
    expect(tabForField('locations', TABS)).toBeNull();
    expect(tabForField('', TABS)).toBeNull();
  });

  it('answers null for an array key without its index', () => {
    expect(tabForField('aliases', TABS)).toBeNull();
  });

  it('answers null for an indexed key whose base no tab claims', () => {
    expect(tabForField('tags[0]', TABS)).toBeNull();
  });
});

describe('focusFieldForItem', () => {
  const hint = { fieldKey: 'name', itemId: 'e1' };

  it('passes the hint through for the item it names', () => {
    expect(focusFieldForItem(hint, 'e1')).toBe(hint);
  });

  it('withholds a hint that names another item', () => {
    expect(focusFieldForItem(hint, 'e2')).toBeNull();
  });

  it('withholds a hint with no item, which belongs to Overview', () => {
    expect(focusFieldForItem({ fieldKey: 'readme', itemId: null }, 'e1')).toBeNull();
  });

  it('answers null when there is no hint', () => {
    expect(focusFieldForItem(null, 'e1')).toBeNull();
  });
});
