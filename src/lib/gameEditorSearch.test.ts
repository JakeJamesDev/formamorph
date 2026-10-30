import { describe, it, expect, vi } from 'vitest';
import type { DiscoveredEntity } from '@/types';
import { findMatches } from '@/lib/worldSearch';
import { gameEntityTabFor, gameSearchTargets } from './gameEditorSearch';

const suya: DiscoveredEntity = {
  entity: { id: 's', name: 'Suya', aliases: ['the vixen'], aiDescription: 'A vixen-spirit.' }, sourceTurnId: 't1',
};
const sources = () => ({
  entities: [suya],
  onEntity: vi.fn(),
});
const OPTS = { matchCase: false, wholeWord: false };

describe('gameSearchTargets', () => {
  it('finds text in the entities and their aliases', () => {
    const hits = findMatches(gameSearchTargets(sources()), 'vixen', OPTS);
    expect(hits.map((h) => `${h.target.itemLabel}/${h.target.fieldKey}`)).toEqual([
      'Suya/aiDescription', 'Suya/aliases[0]',
    ]);
  });

  it('writes a replace through the matching updater', () => {
    const src = sources();
    const targets = gameSearchTargets(src);
    targets.find((t) => t.fieldKey === 'aiDescription')!.write('A fox.');
    expect(src.onEntity).toHaveBeenCalledWith({ ...suya, entity: { ...suya.entity, aiDescription: 'A fox.' } });
    targets.find((t) => t.fieldKey === 'aliases[0]')!.write('the fox');
    expect(src.onEntity).toHaveBeenLastCalledWith({ ...suya, entity: { ...suya.entity, aliases: ['the fox'] } });
  });

  it('names the panel tab of each field', () => {
    expect(gameEntityTabFor('aliases[0]')).toBe('profile');
    expect(gameEntityTabFor('aiSummary')).toBe('descriptions');
  });
});
