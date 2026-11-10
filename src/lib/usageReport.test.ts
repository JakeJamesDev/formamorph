import { describe, expect, it } from 'vitest';
import {
  axisTop, bytes, dayLabel, daysCsv, failureLabel, instantLabel, money, percent, promptTypeLabel, promptTypesCsv,
} from './usageReport';

describe('bytes', () => {
  it('counts in decimal units, so a billion bytes is one GB', () => {
    expect(bytes(1_000_000_000)).toBe('1.0 GB');
    expect(bytes(1_073_741_824)).toBe('1.1 GB');
  });

  it('takes the largest unit that keeps the value at 1 or more, at each boundary', () => {
    expect([0, 999, 1000, 999_949, 1_000_000, 999_949_999, 1_000_000_000_000].map(bytes))
      .toEqual(['0 B', '999 B', '1.0 KB', '999.9 KB', '1.0 MB', '999.9 MB', '1.0 TB']);
  });

  it('never prints 1000.0 of a smaller unit', () => {
    expect(bytes(999_950)).toBe('1.0 MB');
    expect(bytes(999_960_000_000)).toBe('1.0 TB');
  });

  it('stops at TB', () => {
    expect(bytes(1_234_500_000_000_000)).toBe('1,234.5 TB');
  });

  it('shows the dash for no value', () => {
    expect(bytes(null)).toBe('—');
  });
});

describe('money', () => {
  it('keeps enough places for an amount under a dollar to read as more than zero', () => {
    expect(money(1_500_000)).toBe('$1.50');
    expect(money(2900)).toBe('$0.0029');
    expect(money(0)).toBe('$0.00');
    expect(money(null)).toBe('—');
  });
});

describe('percent', () => {
  it('never rounds a small share down to a false zero', () => {
    expect([0, 0.0004, 0.01, 0.745, null].map(percent)).toEqual(['0%', '<1%', '1%', '75%', '—']);
  });
});

describe('dates', () => {
  it('reads a stored UTC day and instant without moving them to the local zone', () => {
    expect(dayLabel('2026-11-03')).toBe('Nov 3');
    expect(instantLabel('2026-11-03T23:44:10.000Z')).toBe('Nov 3, 23:44');
  });
});

describe('labels', () => {
  it('names a prompt type the app knows, spaces out one it does not, and marks a missing one', () => {
    expect(promptTypeLabel('narration')).toBe('Narration');
    expect(promptTypeLabel('someNewPass')).toBe('Some New Pass');
    expect(promptTypeLabel(null)).toBe('Not Recorded');
  });

  it('names a provider status by its code', () => {
    expect(failureLabel('status_503')).toBe('Provider Error 503');
    expect(failureLabel('idle_limit')).toBe('Idle Limit');
  });
});

describe('axisTop', () => {
  it('rounds up to 1, 2 or 5 times a power of ten', () => {
    expect([0, 1, 1.5, 3, 7, 11, 2_400_000].map(axisTop)).toEqual([1, 1, 2, 5, 10, 20, 5_000_000]);
  });
});

describe('the CSV exports', () => {
  it('writes plain dollars a spreadsheet can sum, and leaves an unknown provider figure empty', () => {
    const text = daysCsv([
      { day: '2026-11-03', calls: 12, turns: 2, accounts: 1, costMicros: 1_500_000, providerMicros: null, installs: 40 },
    ]);

    expect(text).toBe('Day,Calls,Turns,AI Users,Active Installs,Recorded Dollars,Provider Dollars\r\n2026-11-03,12,2,1,40,1.5,\r\n');
  });

  it('leaves the installs of a day before counting began empty', () => {
    const text = daysCsv([
      { day: '2026-11-03', calls: 12, turns: 2, accounts: 1, costMicros: 1_500_000, providerMicros: 1_600_000, installs: null },
    ]);

    expect(text.split('\r\n')[1]).toBe('2026-11-03,12,2,1,,1.5,1.6');
  });

  it('quotes a cell that holds a comma', () => {
    const row = {
      promptType: null, calls: 1, costMicros: 0, avgPromptTokens: null, avgOutputTokens: null, cachedShare: null,
      firstTokenP50Ms: null, tokensPerSecondP50: null, maxGapP90Ms: null, failed: 0,
    };

    expect(promptTypesCsv([row]).split('\r\n')[1]).toBe('Not Recorded,1,0,,,,,,,0');
    expect(promptTypesCsv([{ ...row, promptType: 'a,"b' }]).split('\r\n')[1].startsWith('"A,""b"')).toBe(true);
  });
});
