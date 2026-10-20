import { describe, it, expect } from 'vitest';
import type { Entity } from '@/types';
import { movementHelpFor } from './entityPresenceCopy';

const entity = (over: Partial<Entity>): Entity => ({ id: 'e', name: 'E', ...over });

describe('the Movement help line', () => {
  it('says an Everywhere Listed entity that can follow adds a new one and stays listed', () => {
    expect(movementHelpFor(entity({ movement: 'follow', locations: ['inn', 'gate'] }))).toBe(
      'Adds a new entity with this name that travels with the player. This one stays at every listed location.',
    );
  });

  it('keeps the plain Can Follow line for one individual', () => {
    const plain = 'Joins the player when the AI decides, then travels with them until it stays behind';
    expect(movementHelpFor(entity({ movement: 'follow', locations: ['inn'] }))).toBe(plain);
    expect(movementHelpFor(entity({ movement: 'follow', locations: ['inn', 'gate'], presence: 'random' }))).toBe(plain);
  });
});
