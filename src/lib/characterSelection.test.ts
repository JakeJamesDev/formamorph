import { describe, it, expect } from 'vitest';
import { shouldShowCharacterStep } from './characterSelection';
import type { EntityMetadata } from '@/types';

const meta = (id: string): EntityMetadata => ({ id, name: id });

describe('shouldShowCharacterStep', () => {
  it('is hidden when the library is empty', () => {
    expect(shouldShowCharacterStep([])).toBe(false);
  });

  it('is shown when the library has at least one character', () => {
    expect(shouldShowCharacterStep([meta('a')])).toBe(true);
    expect(shouldShowCharacterStep([meta('a'), meta('b')])).toBe(true);
  });
});
