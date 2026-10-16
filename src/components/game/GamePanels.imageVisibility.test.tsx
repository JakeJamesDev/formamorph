import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeftPanel } from './GamePanels';
import { PersonaRow } from './PersonaRow';
import { EntityModal } from '@/components/modals/EntityModal';
import { defaultSystemPrompt } from './GamePrompts';
import { renderInGame, statFixture, type TurnFixture } from '@/test/gamePanels';
import type { Entity, EntityStatValues, GalleryImage, SceneEntity, StatRequirement } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
// WebGL has no jsdom twin.
vi.mock('@/views/ModelViewer', () => ({ default: () => <div data-testid="model-viewer" /> }));

const WOUNDED = 'data:image/png;base64,d291bmRlZA';
const CALM = 'data:image/png;base64,Y2FsbQ';
const ARMORED = 'data:image/png;base64,YXJtb3JlZA';
const MODEL = { name: 'ash.glb', type: 'model/gltf-binary', data: 'data:model/gltf-binary;base64,AAAA' };

const health = statFixture('Health', 50);
const hurt: StatRequirement = { kind: 'stat', id: 'health', operator: '<', value: 20, unit: 'percent' };
const whenHurt = (data: string): GalleryImage => ({ data, requires: [{ all: [hurt] }] });
/** Wounded leads while Ash is hurt; calm is the fallback; armored never shows here. */
const gallery: GalleryImage[] = [
  whenHurt(WOUNDED),
  { data: CALM },
  { data: ARMORED, requires: [{ all: [{ kind: 'trait', id: 'knight', name: 'Knight' }] }] },
];
const ash: Entity = { id: 'ash', name: 'Ash', stats: [health], images: gallery };

const at = (value: number): EntityStatValues => ({ ash: [{ ...health, value }] });
const scene: SceneEntity[] = [{ name: 'Ash', revealed: true }];
const turns: TurnFixture[] = [
  { narration: 'Ash rests.', turnId: 't1', scene, entityStats: at(90) },
  { narration: 'Ash takes a blow.', turnId: 't2', scene, entityStats: at(10) },
];
const stage = (entity: Entity, page?: number, live = 10) => ({
  world: { entities: [entity] } as never, turns, page,
  seed: (g: { setEntityStats: (v: EntityStatValues) => void; setVisibleEntities: (v: SceneEntity[]) => void }) => {
    g.setEntityStats(at(live));
    g.setVisibleEntities(scene);
  },
});

const showPanel = (entity: Entity, page?: number, live?: number) => renderInGame(
  <LeftPanel entities={[entity]} onEntityClick={vi.fn()} narrationPrompt={defaultSystemPrompt} />,
  stage(entity, page, live),
);
const picturesOf = (root: HTMLElement) => [...root.querySelectorAll('img')].map((img) => img.getAttribute('src'));
const counterIn = (root: HTMLElement) => within(root).queryByText(/^\d+\/\d+$/)?.textContent;

describe('the entity panel in play', () => {
  it('shows the visible primary and pages the visible list only', () => {
    const { container } = showPanel(ash);
    expect(picturesOf(container)).toEqual([WOUNDED]);
    expect(counterIn(container)).toBe('1/2');
  });

  it('follows the turn on screen when paged back', () => {
    const { container } = showPanel(ash, 1);
    expect(picturesOf(container)).toEqual([CALM]);
    expect(counterIn(container)).toBeUndefined();
  });

  it('opens the zoom viewer on the same visible list', async () => {
    showPanel(ash);
    await userEvent.click(screen.getByRole('img', { name: 'Ash' }));
    const zoom = await screen.findByRole('dialog');
    expect(picturesOf(zoom)).toEqual([WOUNDED]);
    expect(counterIn(zoom)).toBe('1/2');
  });

  it('shows the model when every image hides', () => {
    const { container } = showPanel({ ...ash, images: [whenHurt(WOUNDED)], model: MODEL }, undefined, 90);
    expect(picturesOf(container)).toEqual([]);
    expect(screen.getByTestId('model-viewer')).toBeTruthy();
  });

  it('shows the model when every image hides, even when the player set the image as the default', () => {
    const golem = { ...ash, images: [whenHurt(WOUNDED)], model: MODEL };
    const { container } = renderInGame(
      <LeftPanel entities={[golem]} onEntityClick={vi.fn()} narrationPrompt={defaultSystemPrompt} />,
      {
        world: { entities: [golem] } as never, turns,
        seed: (g) => { g.setEntityStats(at(90)); g.setVisibleEntities(scene); g.setEntityVisualPreference({ ash: 'image' }); },
      },
    );
    expect(picturesOf(container)).toEqual([]);
    expect(screen.getByTestId('model-viewer')).toBeTruthy();
  });

  it('shows an empty frame when every image hides and there is no model', () => {
    const { container } = showPanel({ ...ash, images: [whenHurt(WOUNDED)] }, undefined, 90);
    expect(picturesOf(container)).toEqual([]);
    expect(screen.queryByTestId('model-viewer')).toBeNull();
  });
});

describe('the entity card in play', () => {
  it('shows the same visible list as the panel', () => {
    renderInGame(<EntityModal entity={ash} isOpen onOpenChange={vi.fn()} />, stage(ash));
    const card = screen.getByRole('dialog');
    expect(picturesOf(card)).toEqual([WOUNDED]);
    expect(counterIn(card)).toBe('1/2');
  });
});

describe('the persona row in play', () => {
  const hp = statFixture('HP', 10);
  const warden: Entity = {
    id: 'w-warden', name: 'Harbor Warden', persona: true,
    // The persona's rule reads the player's stats: the persona is the player.
    images: [{ data: WOUNDED, requires: [{ all: [{ ...hurt, id: 'hp' }] }] }, { data: CALM }],
  };
  const row = (value: number) => {
    renderInGame(<PersonaRow onChange={vi.fn()} />, {
      world: { entities: [warden] } as never,
      stats: [{ ...hp, value }],
      seed: (g) => g.setPersonaRef({ source: 'world', entityId: 'w-warden' }),
    });
    return screen.getByTestId('persona-row');
  };

  it('shows the visible primary', () => {
    expect(picturesOf(row(10))).toEqual([WOUNDED]);
  });

  it('skips a hidden slot 0', () => {
    expect(picturesOf(row(90))).toEqual([CALM]);
  });
});
