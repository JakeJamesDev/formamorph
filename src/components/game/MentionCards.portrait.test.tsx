import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Entity, GalleryImage, GameState, Trait } from '@/types';
import { buildPlayerView, type PlayerViewEntity, type PlayerViewInput } from '@/lib/formaquestion/playerView';
import { playerViewPages } from '@/lib/formaquestion/gameWorld';
import { scoped } from '@/lib/scope';
import type { GateInput } from '@/lib/traitGates';
import { computePresence } from '@/lib/presence';
import { visibleImages } from '@/lib/imageVisibility';
import { MentionCard, MentionPickList, mentionCardRows } from './MentionCards';

// Card rows from the real Player View under a real gate input: an image whose rule fails must never reach the card.

const MOONLIT: Trait = { id: 'moonlit', name: 'Moonlit', statChanges: [] };
const atNight: GalleryImage['requires'] = [{ all: [{ kind: 'trait', id: 'moonlit', owner: { kind: 'you' } }] }];

const entity = (id: string, name: string, extra: Partial<Entity> = {}): Entity => ({
  id, name, playerDescription: `${name} player text.`, aiDescription: `${name} AI secret.`, ...extra,
});
const MIRA = entity('mira', 'Mira', { images: [{ data: 'data:mira-plain' }] });
const COURIER = entity('courier', 'Ilan', { strangerName: 'the courier', images: [{ data: 'data:courier-plain' }] });
const WOLF = entity('wolf', 'Wolf', { images: [{ data: 'data:wolf-night', requires: atNight }, { data: 'data:wolf-day' }] });
const SHADE = entity('shade', 'Shade', { images: [{ data: 'data:shade-night', requires: atNight }] });
const KESSA = entity('kessa', 'Kessa');
const HOODED = entity('hooded', 'Corvin', { strangerName: 'a hooded figure', images: [{ data: 'data:hooded-plain' }] });
const CAST = [MIRA, COURIER, WOLF, SHADE, KESSA, HOODED];

const state = (extra: Partial<GameState> = {}): GameState => ({
  globalStats: [], globalTraits: [], visibleEntities: [], logEntries: [], gameplayText: '', gameTime: 0,
  characterData: null, choices: [], isGameStarted: true, timestamp: '', worldName: null, playerNotes: '',
  previousStateIndex: null, stateVersion: 1, ...extra,
});

const gate = (night: boolean): GateInput => ({
  global: { traits: [MOONLIT], groups: [] },
  owners: [],
  active: scoped(night ? ['moonlit'] : []),
  stats: scoped({}, {}),
  entities: CAST.map(({ id, name }) => ({ id, name })),
  persona: { source: 'none' },
});

/** Mira, the wolf, the shade and Kessa met; the courier seen only as "the courier". */
const input = (extra: Partial<PlayerViewInput> = {}): PlayerViewInput => ({
  world: { entities: CAST, locations: [], traits: [MOONLIT] },
  chain: [state({ metEntities: ['mira', 'wolf', 'shade', 'kessa'], visibleEntities: [{ name: 'Ilan', alias: 'the courier', revealed: false }] })],
  history: [], persona: null, resolve: (text) => text, ...extra,
});

const MET = ['mira', 'wolf', 'shade', 'kessa'];
const presence = computePresence({
  entities: CAST, runtime: [], positions: {}, generics: {}, followers: [], locationId: null, locations: [], connections: [],
  persona: null, met: MET, strangerAliases: {}, turns: [],
}).byId;

const rows = (night: boolean) => mentionCardRows(
  buildPlayerView(input({ gate: gate(night) })), presence, { imageOf: (e) => visibleImages(e, gate(night))[0]?.data },
);

/** The portrait the card for `id` shows, or null when it shows the initial. */
function portraitOf(id: string, night: boolean): string | null {
  const row = rows(night).get(id);
  if (!row) throw new Error(`no row for ${id}`);
  render(<MentionCard row={row} />);
  const src = screen.queryByTestId('mention-card-portrait')?.getAttribute('src') ?? null;
  cleanup();
  return src;
}

afterEach(cleanup);

describe('mention card portrait', () => {
  it('shows the image of a met entity, of a stranger seen under an alias, and of one known by its Stranger Name', () => {
    expect(portraitOf('mira', false)).toBe('data:mira-plain');
    expect(portraitOf('courier', false)).toBe('data:courier-plain');
    expect(portraitOf('hooded', false)).toBe('data:hooded-plain');
  });

  it('shows the initial when the entity has no image', () => {
    expect(portraitOf('kessa', false)).toBeNull();
    render(<MentionCard row={rows(false).get('kessa') as PlayerViewEntity} />);
    expect(screen.getByText('K')).toBeTruthy();
  });

  it('never shows an image whose rule fails, and shows it once the rule passes', () => {
    expect(portraitOf('wolf', false)).toBe('data:wolf-day');
    expect(portraitOf('wolf', true)).toBe('data:wolf-night');
    expect(portraitOf('shade', false)).toBeNull();
    expect(portraitOf('shade', true)).toBe('data:shade-night');
    expect(JSON.stringify([...rows(false).values()])).not.toContain('night');
  });
});

describe('pick list portraits (Q62)', () => {
  const pick = (night: boolean) => {
    const shown = rows(night);
    render(<MentionPickList role="mention" rows={shown} colors={new Map()} current="mira" onPick={() => {}} onBack={() => {}} />);
    return [...screen.getAllByRole('button')].slice(1, -1)
      .map((b) => [b.textContent, b.querySelector('img')?.getAttribute('src') ?? null, b.querySelector('img')?.className ?? null]);
  };

  it('shows each image as a square, top-aligned crop, and the initial when there is none', () => {
    const square = 'h-6 w-6 shrink-0 rounded-md object-cover object-top';
    expect(pick(false)).toEqual([
      ['Mira', 'data:mira-plain', square],
      ['the courier', 'data:courier-plain', square],
      ['Wolf', 'data:wolf-day', square],
      ['SShade', null, null],
      ['KKessa', null, null],
      ['a hooded figure', 'data:hooded-plain', square],
    ]);
  });

  it("follows the image's rule, as the card does (Q51)", () => {
    expect(pick(true).slice(2, 4).map(([, src]) => src)).toEqual(['data:wolf-night', 'data:shade-night']);
  });
});

describe('Formaquestion reads of the Player View', () => {
  it('carries no image without a gate', () => {
    expect(buildPlayerView(input()).entities.some((row) => 'image' in row)).toBe(false);
  });

  it('pages the same view with or without images', () => {
    const plain = buildPlayerView(input());
    const pictured = buildPlayerView(input({ gate: gate(true) }));
    expect(pictured.entities.some((row) => row.image)).toBe(true);
    expect(playerViewPages(pictured)).toEqual(playerViewPages(plain));
  });
});
