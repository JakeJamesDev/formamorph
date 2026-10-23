import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeftPanel } from './GamePanels';
import { EntityModal } from '@/components/modals/EntityModal';
import { defaultSystemPrompt } from './GamePrompts';
import { renderInGame, statFixture, type TurnFixture } from '@/test/gamePanels';
import type { EntityStatValues, SceneEntity } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
// WebGL has no jsdom twin; the stub shows the morphs each viewer was handed.
vi.mock('@/views/ModelViewer', () => ({
  default: ({ morphValues }: { morphValues?: Record<string, number> }) => (
    <div data-testid="model-viewer" data-morphs={JSON.stringify(morphValues ?? {})} />
  ),
}));

const MODEL = { name: 'golem.glb', data: 'data:model/gltf-binary;base64,AAAA' };
const PICTURE = 'data:image/png;base64,AAAA';
const wounds = statFixture('Wounds', 0, { morphBindings: ['Cracks'] });
const mood = statFixture('Mood', 0, { morphBindings: ['Frown'], enabled: false });
const golem = { id: 'golem', name: 'Golem', model: MODEL, stats: [wounds, mood] };

const at = (value: number): EntityStatValues => ({
  golem: [{ ...wounds, value }, { ...mood, value: 80 }],
});
const scene: SceneEntity[] = [{ name: 'Golem', revealed: true }];
const turns: TurnFixture[] = [
  { narration: 'The golem wakes.', turnId: 't1', scene, entityStats: at(20) },
  { narration: 'The golem takes a blow.', turnId: 't2', scene, entityStats: at(60) },
];

const show = (entity: object, page?: number, preferImage = false) => renderInGame(
  <LeftPanel entities={[entity] as never} onEntityClick={vi.fn()} narrationPrompt={defaultSystemPrompt} />,
  {
    world: { entities: [entity] } as never, turns, page,
    seed: (g) => {
      g.setEntityStats(at(60));
      g.setVisibleEntities(scene);
      if (preferImage) g.setEntityVisualPreference({ golem: 'image' });
    },
  },
);
const morphsOf = (viewer: HTMLElement) => JSON.parse(viewer.dataset.morphs!) as Record<string, number>;

describe('LeftPanel — entity stat morphs', () => {
  it("drives the entity view's model from the entity's live stats", () => {
    show(golem);
    expect(morphsOf(screen.getByTestId('model-viewer'))).toEqual({ Cracks: 0.6 });
  });

  it('shows the paged-back turn’s stats on a past page', () => {
    show(golem, 1);
    expect(morphsOf(screen.getByTestId('model-viewer'))).toEqual({ Cracks: 0.2 });
  });

  it("drives the model dialog from the same stats when a picture leads the view", async () => {
    show({ ...golem, image: PICTURE }, undefined, true);
    await userEvent.click(screen.getByRole('button', { name: 'View 3D Model' }));
    const viewers = await screen.findAllByTestId('model-viewer');
    expect(viewers.map(morphsOf)).toEqual([{ Cracks: 0.6 }]);
  });
});

describe('EntityModal — entity stat morphs', () => {
  it("drives the card's model from the entity's stats for the turn on screen", () => {
    renderInGame(<EntityModal entity={golem as never} isOpen onOpenChange={vi.fn()} />, {
      world: { entities: [golem] } as never, turns, page: 1,
      seed: (g) => { g.setEntityStats(at(60)); g.setVisibleEntities(scene); },
    });
    expect(morphsOf(screen.getByTestId('model-viewer'))).toEqual({ Cracks: 0.2 });
  });
});
