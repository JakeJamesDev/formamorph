import { describe, it, expect } from 'vitest';
import { buildStatContext } from './statContext';
import type { PlayerStat } from '@/types';

// A minimal PlayerStat; Vigor at 62/100 sits above the 50-threshold descriptor, so "Winded" applies.
const vigor = {
  id: 'v', name: 'Vigor', type: 'number', description: 'Physical stamina.', min: 0, max: 100, value: 62, regen: 0,
  descriptors: [{ id: 'd', threshold: 100, description: 'Winded' }],
} as unknown as PlayerStat;

// A percentage stat renders its value as N% instead of value/max.
const focus = {
  id: 'f', name: 'Focus', type: 'percentage', description: 'Mental sharpness.', min: 0, max: 100, value: 40, regen: 0,
  descriptors: [{ id: 'd', threshold: 100, description: 'Sharp' }],
} as unknown as PlayerStat;

const all = { values: true, status: true, meaning: true };

describe('buildStatContext', () => {
  it('values only → name and value/max', () => {
    expect(buildStatContext([vigor], { values: true, status: false, meaning: false })).toBe('Vigor: 62/100');
  });
  it('meaning only → name and description, no numbers', () => {
    expect(buildStatContext([vigor], { values: false, status: false, meaning: true })).toBe('Vigor: Physical stamina.');
  });
  it('status only → bare descriptor (no parentheses when alone)', () => {
    expect(buildStatContext([vigor], { values: false, status: true, meaning: false })).toBe('Vigor: Winded');
  });
  it('values + status → descriptor parenthesized after the value', () => {
    expect(buildStatContext([vigor], { values: true, status: true, meaning: false })).toBe('Vigor: 62/100 (Winded)');
  });
  it('all pieces → value, (status), then — meaning', () => {
    expect(buildStatContext([vigor], all)).toBe('Vigor: 62/100 (Winded) — Physical stamina.');
  });
  it('no pieces → just the name', () => {
    expect(buildStatContext([vigor], { values: false, status: false, meaning: false })).toBe('Vigor');
  });
  it('markdown bullets each line with a bold name', () => {
    expect(buildStatContext([vigor], { values: true, status: false, meaning: true }, 'markdown'))
      .toBe('- **Vigor:** 62/100 — Physical stamina.');
  });
  it('markdown with no pieces → bold name only', () => {
    expect(buildStatContext([vigor], { values: false, status: false, meaning: false }, 'markdown')).toBe('- **Vigor**');
  });
  it('omits meaning when the stat has no description', () => {
    const bare = { ...vigor, description: '' } as PlayerStat;
    expect(buildStatContext([bare], all)).toBe('Vigor: 62/100 (Winded)');
  });
  it('xml → one <stat> with a nested child tag per selected piece', () => {
    expect(buildStatContext([vigor], all, 'xml')).toBe(
      '<stat>\n  <name>Vigor</name>\n  <value>62/100</value>\n  <status>Winded</status>\n  <meaning>Physical stamina.</meaning>\n</stat>',
    );
  });
  it('xml with no pieces → just the <name> child', () => {
    expect(buildStatContext([vigor], { values: false, status: false, meaning: false }, 'xml')).toBe(
      '<stat>\n  <name>Vigor</name>\n</stat>',
    );
  });
  it('xml escapes markup in values', () => {
    const amp = { ...vigor, name: 'H<P & M', description: '' } as PlayerStat;
    expect(buildStatContext([amp], { values: false, status: false, meaning: false }, 'xml')).toBe(
      '<stat>\n  <name>H&lt;P &amp; M</name>\n</stat>',
    );
  });
  it('rounds a time-scaled fractional value to a whole number', () => {
    // Regen scaled by a measured 35-minute turn put 0.5833333333333333 straight into the prompt — a
    // parrotable numeral the model echoes back, and pure token waste.
    const charge = { ...vigor, name: 'Charge', value: 35 / 60 } as PlayerStat;
    expect(buildStatContext([charge], { values: true, status: false, meaning: false })).toBe('Charge: 1/100');
    const fractionalMax = { ...vigor, value: 85.5, max: 90.4 } as PlayerStat;
    expect(buildStatContext([fractionalMax], { values: true, status: false, meaning: false })).toBe('Vigor: 86/90');
    const pct = { ...focus, value: 40.6 } as PlayerStat;
    expect(buildStatContext([pct], { values: true, status: false, meaning: false })).toBe('Focus: 41%');
  });
  it('percentage stat renders its value as N%', () => {
    expect(buildStatContext([focus], { values: true, status: false, meaning: false })).toBe('Focus: 40%');
  });
  it('percentage value + status → descriptor parenthesized after the percent', () => {
    expect(buildStatContext([focus], { values: true, status: true, meaning: false })).toBe('Focus: 40% (Sharp)');
  });
  it('percentage renders as N% in xml', () => {
    expect(buildStatContext([focus], { values: true, status: false, meaning: false }, 'xml')).toBe(
      '<stat>\n  <name>Focus</name>\n  <value>40%</value>\n</stat>',
    );
  });
});
