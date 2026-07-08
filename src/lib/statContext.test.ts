import { describe, it, expect } from 'vitest';
import { buildStatContext } from './statContext';
import type { PlayerStat } from '@/types';

// A minimal PlayerStat; Vigor at 62/100 sits above the 50-threshold descriptor, so "Winded" applies.
const vigor = {
  id: 'v', name: 'Vigor', type: 'number', description: 'Physical stamina.', min: 0, max: 100, value: 62, regen: 0,
  descriptors: [{ id: 'd', threshold: 100, description: 'Winded' }],
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
});
