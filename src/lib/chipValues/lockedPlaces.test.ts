import { describe, expect, it } from 'vitest';
import { authoredChipScene, type AuthoredWorld } from './authoredScene';
import { chipValues } from './chipValues';
import { resolveInPlayWorld, startGateInput } from '../inPlayWorld';
import type { Entity, GameLocation, WorldOption, WorldOverview } from '@/types';

/**
 * A locked place in the AI's context (Q28, Q54): the Nearby chips keep it and who is inside, and only the
 * destinations chip, the router's list, leaves it out.
 */

const gateOption = (open: boolean): WorldOption => ({ id: 'gate', name: 'Vault Open', type: 'boolean', shownToPlayer: true, midGame: false, default: open });
const town: GameLocation = { id: 'town', name: 'Sedge Town' };
const square: GameLocation = { id: 'square', name: 'The Square', parentId: 'town', isStarting: true };
const vault: GameLocation = { id: 'vault', name: 'The Vault', parentId: 'town', unlockedWhen: [{ all: [{ kind: 'option', id: 'gate' }] }] };
const harrow: Entity = { id: 'harrow', name: 'Harrow', locations: ['vault'], aiDescription: 'Counts coin.' };

const world: AuthoredWorld = {
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: '' } as WorldOverview,
  stats: [], traits: [], locations: [town, square, vault], entities: [harrow],
};

function chips(open: boolean) {
  const authored = world;
  const inPlay = resolveInPlayWorld(
    { entities: authored.entities ?? [], locations: authored.locations ?? [], connections: [] },
    { playerAt: 'square', gate: startGateInput({ entities: [], locations: authored.locations ?? [], options: [gateOption(open)] }, null) },
  );
  const scene = authoredChipScene(authored, { location: square });
  return chipValues({ ...scene, canEnter: (id) => inPlay.canEnter('square', id) });
}

describe('a locked place in the AI context', () => {
  it('stays in the Nearby chips with who is inside', () => {
    const values = chips(false);
    expect(values('<LOCATION|reachable>')).toContain('The Vault');
    expect(values('<ENTITIES|reachable>')).toContain('Harrow');
  });

  it('leaves the destinations chip while locked, and joins it once open', () => {
    expect(chips(false)('<LOCATION|destinations>')).not.toContain('The Vault');
    expect(chips(false)('<LOCATION|destinations>')).toContain('Sedge Town');
    expect(chips(true)('<LOCATION|destinations>')).toContain('The Vault');
  });
});
