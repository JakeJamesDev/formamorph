import { describe, expect, it } from 'vitest';
import type { Entity, GameState, MediaList } from '@/types';
import type { GateInput } from '@/lib/traitGates';
import { buildPlayerView } from './playerView';

const media: MediaList = {
  'm-calm': { id: 'm-calm', name: 'Calm', kind: 'image', data: 'calm' },
  'm-captain': { id: 'm-captain', name: 'Captain', kind: 'image', data: 'captain' },
};

const warden: Entity = { id: 'warden', name: 'Warden', playerDescription: 'A gate guard.', images: [{ mediaId: 'm-calm' }], locations: ['gate'] };

const gate: GateInput = { global: { traits: [], groups: [] }, owners: [], active: { global: [], owners: {} }, entities: [], persona: { source: 'none' } };

const state = (extra: Partial<GameState>): GameState => ({
  globalStats: [], globalTraits: [], visibleEntities: [{ name: 'Warden', revealed: true }], metEntities: ['warden'], logEntries: [],
  gameplayText: '', gameTime: 0, characterData: null, choices: [], isGameStarted: true, timestamp: '', worldName: null, playerNotes: '',
  previousStateIndex: null, stateVersion: 1, locationId: 'gate', ...extra,
});

const imageOf = (snapshot: GameState) => buildPlayerView({
  world: { entities: [warden], locations: [{ id: 'gate', name: 'Gate' }], traits: [] },
  chain: [snapshot], history: [], persona: null, resolve: (text) => text, gate, media,
}).entities.find((row) => row.name === 'Warden')?.image;

describe('the Player View’s entity picture', () => {
  it('shows the snapshot’s script override over the rules, and the rules once it clears', () => {
    expect(imageOf(state({}))).toBe('calm');
    expect(imageOf(state({ mediaOverrides: { entities: { warden: { image: 'm-captain' } } } }))).toBe('captain');
  });
});
