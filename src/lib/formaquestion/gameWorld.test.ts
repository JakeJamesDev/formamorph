import { describe, expect, it } from 'vitest';
import { playerViewPages } from './gameWorld';

describe('playerViewPages', () => {
  it('writes an item row’s State under its name, and no State line when it has none', () => {
    const pages = playerViewPages({
      entities: [], locations: [], stats: [], traits: [],
      items: [
        { kind: 'item', id: 'lamp', name: 'Lantern', description: 'Brass.', state: 'lit' },
        { kind: 'item', id: 'rope', name: 'Rope', description: 'A coil.' },
      ],
    });
    expect(pages.map((page) => page.markdown)).toEqual(['# Lantern\n\nState: lit\n\nBrass.', '# Rope\n\nA coil.']);
  });
});
