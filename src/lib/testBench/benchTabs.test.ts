import { describe, it, expect } from 'vitest';
import { asBenchTab, BENCH_TABS, BUILT_BENCH_TABS } from './benchTabs';

describe('bench tab routing', () => {
  it('accepts every instrument in the strip', () => {
    expect(asBenchTab('issues')).toBe('issues');
    expect(asBenchTab('triggers')).toBe('triggers');
    expect(asBenchTab('aiContext')).toBe('aiContext');
    expect(asBenchTab('opening')).toBe('opening');
  });

  it('refuses a name that is not a tab at all, and an absent one', () => {
    expect(asBenchTab('nonsense')).toBeNull();
    expect(asBenchTab(undefined)).toBeNull();
  });

  it('lists the built instruments as a subset of the strip', () => {
    expect(BENCH_TABS.map((t) => t.value)).toEqual(expect.arrayContaining([...BUILT_BENCH_TABS]));
  });
});
