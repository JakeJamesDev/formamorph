import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Entity, GameState, MediaList, Trait, TraitRequirementRow } from '@/types';
import { buildPlayerView, type PlayerViewInput } from '@/lib/formaquestion/playerView';
import { playerViewPages } from '@/lib/formaquestion/gameWorld';
import { scoped } from '@/lib/scope';
import type { GateInput } from '@/lib/traitGates';
import { computePresence } from '@/lib/presence';
import { MentionCard, MentionPickList, mentionCardRows } from './MentionCards';

// A met entity whose gallery links a Layered Image: the card draws the stack the real Player View resolves.

const MOONLIT: Trait = { id: 'moonlit', name: 'Moonlit', statChanges: [] };
const atNight: TraitRequirementRow[] = [{ all: [{ kind: 'trait', id: 'moonlit', owner: { kind: 'you' } }] }];
const MEDIA: MediaList = {
  body: { id: 'body', name: 'Body', kind: 'image', data: 'data:body' },
  day: { id: 'day', name: 'Day Eyes', kind: 'image', data: 'data:day' },
  night: { id: 'night', name: 'Night Eyes', kind: 'image', data: 'data:night' },
  rig: {
    id: 'rig', name: 'Rig', kind: 'layered', layers: [
      { id: 'base', name: 'Base', variants: [{ mediaId: 'body' }] },
      { id: 'eyes', name: 'Eyes', opacity: 0.5, variants: [{ mediaId: 'night', requires: atNight }, { mediaId: 'day' }] },
    ],
  },
};
const ROOK: Entity = { id: 'rook', name: 'Rook', playerDescription: 'Rook player text.', images: [{ mediaId: 'rig' }] };

const state = (): GameState => ({
  globalStats: [], globalTraits: [], visibleEntities: [], logEntries: [], gameplayText: '', gameTime: 0,
  characterData: null, choices: [], isGameStarted: true, timestamp: '', worldName: null, playerNotes: '',
  previousStateIndex: null, stateVersion: 1, metEntities: ['rook'],
});
const gate = (night: boolean): GateInput => ({
  global: { traits: [MOONLIT], groups: [] }, owners: [], active: scoped(night ? ['moonlit'] : []), stats: scoped({}, {}),
  entities: [{ id: 'rook', name: 'Rook' }], persona: { source: 'none' },
});
const input = (extra: Partial<PlayerViewInput> = {}): PlayerViewInput => ({
  world: { entities: [ROOK], locations: [], traits: [MOONLIT] }, chain: [state()], history: [], persona: null,
  resolve: (text) => text, media: MEDIA, ...extra,
});
const presence = computePresence({
  entities: [ROOK], runtime: [], positions: {}, generics: {}, followers: [], locationId: null, locations: [], connections: [],
  persona: null, met: ['rook'], strangerAliases: {}, turns: [],
}).byId;
const rows = (night: boolean) => mentionCardRows(buildPlayerView(input({ gate: gate(night) })), presence);

/** Each drawn Layer's image and opacity. */
const layersIn = (root: Element) => [...root.querySelectorAll('img[data-layer]')].map((img) => [img.getAttribute('src'), (img as HTMLElement).style.opacity]);

afterEach(cleanup);

describe('mention card with a Layered Image', () => {
  it('draws each Layer’s visible Variant at its opacity, following the rule', () => {
    render(<MentionCard row={rows(false).get('rook')!} />);
    expect(layersIn(screen.getByTestId('mention-card-portrait'))).toEqual([['data:body', '1'], ['data:day', '0.5']]);
    cleanup();
    render(<MentionCard row={rows(true).get('rook')!} />);
    expect(layersIn(screen.getByTestId('mention-card-portrait'))).toEqual([['data:body', '1'], ['data:night', '0.5']]);
  });

  it('draws the stack in the pick list too', () => {
    render(<MentionPickList role="mention" rows={rows(true)} colors={new Map()} current="rook" onPick={() => {}} onBack={() => {}} />);
    const row = screen.getAllByRole('button').find((b) => b.textContent === 'Rook')!;
    expect(layersIn(row)).toEqual([['data:body', '1'], ['data:night', '0.5']]);
  });

  it('never puts the stack in the pages Formaquestion reads', () => {
    expect(playerViewPages(buildPlayerView(input({ gate: gate(true) })))).toEqual(playerViewPages(buildPlayerView(input())));
  });
});
