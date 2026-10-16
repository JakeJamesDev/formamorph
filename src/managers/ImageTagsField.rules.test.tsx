import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { IMAGE_CAPS } from '../lib/imageOptim';
import ImageTagsField from './ImageTagsField';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TraitStoreContext, type TraitStore } from '@/contexts/TraitStoreContext';
import { editorGateInput } from '@/lib/owners';
import { startingGateStats } from '@/lib/gateStats';
import type { Entity, GalleryImage, Stat, Trait, TraitRequirementRow } from '@/types';

vi.mock('../lib/UtilityComponents', () => ({
  ImageUpload: ({ value, id }: { value?: string | null; id: string }) => <div data-testid="slot" data-value={value ?? ''} data-slot-id={id} />,
}));
vi.mock('../components/GenerateImageButton', () => ({ GenerateImageButton: () => <div>generate</div> }));
vi.mock('@/components/AiGenerateButton', () => ({ default: () => <div /> }));
vi.mock('@/lib/useRemoteImage', () => ({ RemoteImg: ({ src }: { src?: string }) => <img src={src} alt="" /> }));
vi.mock('@/lib/useDownscalePrompt', () => ({ useDownscalePrompt: () => ({ promptImagesBatch: vi.fn(), dialog: null }) }));

const A = 'data:image/webp;base64,AAAA';
const B = 'data:image/webp;base64,BBBB';
const C = 'data:image/webp;base64,CCCC';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, starting: 10, regen: 0, descriptors: [], ...extra });
const healed: Trait = { id: 'healed', name: 'Healed', statChanges: [] };
const wren: Entity = { id: 'wren', name: 'Wren', traits: [healed], stats: [stat('health', 'Health')] };

const lowHealth: TraitRequirementRow[] = [{ all: [{ kind: 'stat', id: 'health', operator: '<', value: 20, unit: 'percent' }] }];
const notHealed: TraitRequirementRow[] = [{ all: [{ kind: 'trait', id: 'healed', not: true }] }];

/** The gallery over Wren in a world of her own, as the World Editor's entity panel mounts it. */
function Harness({ initial, inDialog = false }: { initial: GalleryImage[]; inDialog?: boolean }) {
  const [images, setImages] = useState(initial);
  const world = { traits: [], traitGroups: [], entities: [wren] };
  const store = {
    ...world, placeholders: [], stats: [],
    gateInput: editorGateInput(world, startingGateStats({ stats: [], statGroups: [], entities: [wren] })),
    pinWorld: null,
  } as unknown as TraitStore;
  const gallery = (
    <ImageTagsField
      label="Image"
      images={images}
      onImagesChange={setImages}
      slots={4}
      imageId="x"
      cap={IMAGE_CAPS.entity}
      kind="character"
      onTagsChange={vi.fn()}
      ruleOwnerId="wren"
    />
  );
  return (
    <TooltipProvider>
      <TraitStoreContext.Provider value={store}>
        {inDialog ? <Dialog open><DialogContent><DialogTitle>Wren</DialogTitle>{gallery}</DialogContent></Dialog> : gallery}
        <output data-testid="images">{JSON.stringify(images)}</output>
      </TraitStoreContext.Provider>
    </TooltipProvider>
  );
}

const stored = (): GalleryImage[] => JSON.parse(screen.getByTestId('images').textContent!);
const tile = (name: string | RegExp) => screen.getByRole('button', { name });
/** The tile's wrapper, which holds its cog beside the button. */
const tileBox = (name: string | RegExp) => tile(name).parentElement!;
const cogOf = (name: string | RegExp) => within(tileBox(name)).getByRole('button', { name: 'Visibility Rule' });

describe('Gallery Visibility rules', () => {
  it('opens the rows editor from a tile’s cog and stores the rule on that image only', async () => {
    render(<Harness initial={[{ data: A }, { data: B }, { data: C }]} />);
    fireEvent.click(cogOf('Image 2'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Requirement' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Health/ }));

    expect(stored()).toEqual([
      { data: A },
      { data: B, requires: [{ all: [{ kind: 'stat', id: 'health', operator: '>=', value: 50, unit: 'raw' }] }] },
      { data: C },
    ]);
  });

  it('drops the field when the last row is removed', async () => {
    render(<Harness initial={[{ data: A }, { data: B, requires: lowHealth }]} />);
    fireEvent.click(cogOf(/^Image 2/));
    fireEvent.click(await screen.findByRole('button', { name: /^Remove row/ }));

    expect(stored()).toEqual([{ data: A }, { data: B }]);
    expect(stored()[1]).not.toHaveProperty('requires');
  });

  it('badges a conditioned thumbnail and not a plain one', () => {
    render(<Harness initial={[{ data: A }, { data: B, requires: lowHealth }]} />);
    expect(tileBox('Primary image').querySelector('[data-image-rule-badge]')).toBeNull();
    expect(tileBox(/^Image 2/).querySelector('[data-image-rule-badge]')).not.toBeNull();
    expect(tile('Image 2, has a Visibility rule')).toBeInTheDocument();
  });

  it('reads a stat Condition under the framed thumbnail', () => {
    render(<Harness initial={[{ data: A }, { data: B, requires: lowHealth }]} />);
    expect(document.querySelector('[data-image-rule-summary]')).toBeNull();
    fireEvent.click(tile(/^Image 2/));
    expect(document.querySelector('[data-image-rule-summary]')).toHaveTextContent('Shown while Health < 20%');
  });

  it('reads a trait Condition, and Not', () => {
    render(<Harness initial={[{ data: A }, { data: B, requires: notHealed }]} />);
    fireEvent.click(tile(/^Image 2/));
    expect(document.querySelector('[data-image-rule-summary]')).toHaveTextContent('Shown while not Healed');
  });

  it('warns only while the primary image carries a rule', () => {
    const { unmount } = render(<Harness initial={[{ data: A }, { data: B, requires: lowHealth }]} />);
    expect(document.querySelector('[data-image-rule-cover-warning]')).toBeNull();
    unmount();

    render(<Harness initial={[{ data: A, requires: lowHealth }, { data: B }]} />);
    expect(document.querySelector('[data-image-rule-cover-warning]')).toHaveTextContent('The primary image ignores its rule outside play');
  });

  it('keeps the entity editor dialog open while the popover is used', async () => {
    render(<Harness initial={[{ data: A }, { data: B }]} inDialog />);
    fireEvent.click(cogOf('Image 2'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Requirement' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Health/ }));

    expect(screen.getByRole('dialog', { name: 'Wren' })).toBeInTheDocument();
    expect(stored()[1].requires).toHaveLength(1);
  });

  it('draws no cog for a location, which has no rule', () => {
    render(
      <TooltipProvider>
        <ImageTagsField label="Background Image" images={[{ data: A }, { data: B }]} onImagesChange={vi.fn()} slots={4}
          imageId="y" cap={IMAGE_CAPS.entity} kind="location" onTagsChange={vi.fn()} />
      </TooltipProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Visibility Rule' })).toBeNull();
  });

  it('draws no cog where nothing can supply a rule’s targets', () => {
    render(
      <TooltipProvider>
        <ImageTagsField label="Image" images={[{ data: A }, { data: B }]} onImagesChange={vi.fn()} slots={4}
          imageId="z" cap={IMAGE_CAPS.entity} kind="character" onTagsChange={vi.fn()} ruleOwnerId="wren" />
      </TooltipProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Visibility Rule' })).toBeNull();
  });
});
