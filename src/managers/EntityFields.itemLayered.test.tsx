import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { EntityImageWidget } from './EntityFields';
import { LocationImageField } from './LocationImageField';
import { ImageGallery } from './ImageTagsField';
import { LOCATION_RULE_HOST } from '@/components/editor/ImageRuleCog';
import { RuleSourceContext } from '@/contexts/RuleSourceContext';
import { libraryGateInput } from '@/lib/libraryGateInput';
import type { MediaItem } from '@/lib/mediaIndex';
import { MediaActionRow } from './MediaActionRow';
import { MediaThumb } from './MediaGallery';
import type { Entity, GameLocation, LayeredMediaEntry, MediaFileEntry, MediaList, Stat } from '@/types';

/** An item's image slot is the linked entity widget, the way ItemManager mounts it. */

const BASE: MediaFileEntry = { id: 'base-img', name: 'Lamp Base', kind: 'image', data: 'data:image/webp;base64,QUFB' };
const RIG: LayeredMediaEntry = { id: 'rig', name: 'Lamp Rig', kind: 'layered', layers: [{ id: 'l1', name: 'Base', variants: [{ mediaId: BASE.id }] }] };
const SMILE: MediaFileEntry = { id: 'smile-img', name: 'Smile', kind: 'image', data: 'data:image/webp;base64,U01J' };
const FROWN: MediaFileEntry = { id: 'frown-img', name: 'Frown', kind: 'image', data: 'data:image/webp;base64,RlJP' };
// Smile shows while Mood is over 5, else Frown.
const FACE: LayeredMediaEntry = {
  id: 'face', name: 'Face Rig', kind: 'layered', layers: [{
    id: 'l-face', name: 'Face', variants: [
      { mediaId: SMILE.id, requires: [{ all: [{ kind: 'stat', id: 'mood', operator: '>', value: 5, unit: 'raw' }] }] },
      { mediaId: FROWN.id },
    ],
  }],
};
const LIST: MediaList = { [BASE.id]: BASE, [RIG.id]: RIG, [SMILE.id]: SMILE, [FROWN.id]: FROWN, [FACE.id]: FACE };

vi.mock('@/contexts/GameDataContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/contexts/GameDataContext')>()),
  useGameData: () => ({ worldOverview: { mediaList: LIST }, addMedia: vi.fn(), entities: [{ id: 'keeper', name: 'Keeper' }], placeholders: [] }),
  useGameDataOptional: () => ({ worldOverview: { mediaList: LIST } }),
}));
vi.mock('@/lib/useDownscalePrompt', () => ({
  useDownscalePrompt: () => ({ promptImage: async (url: string) => url, promptImagesBatch: async () => 'off', dialog: null, promptWorld: vi.fn() }),
}));
vi.mock('@/lib/useRemoteImage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/useRemoteImage')>()),
  useRemoteImage: (url: string) => ({ src: url || '', status: 'embedded' }),
  RemoteImg: ({ src }: { src?: string }) => <img src={src} alt="" />,
}));
vi.mock('../components/GenerateImageButton', () => ({ GenerateImageButton: () => <div /> }));
vi.mock('@/components/AiGenerateButton', () => ({ default: () => <div /> }));

const item = { id: 'lamp', name: 'Lamp', images: [{ mediaId: BASE.id }] } as unknown as Entity;

describe('an item image slot', () => {
  it('lists the Layered Image in Choose and links it', () => {
    const onChange = vi.fn();
    render(
      <EntityImageWidget value={item} onChange={onChange} ruleHost={LOCATION_RULE_HOST} imageId="item-image-lamp" linked>
        <ImageGallery />
      </EntityImageWidget>,
    );
    fireEvent.click(screen.getByLabelText('Add an Image'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    const entries = [...document.querySelectorAll<HTMLElement>('[data-media-entry]')];
    expect(entries.map((b) => b.textContent)).toContain('Lamp Rig');

    fireEvent.click(entries.find((b) => b.textContent === 'Lamp Rig')!);
    expect(onChange).toHaveBeenCalledWith('images', [{ mediaId: BASE.id }, { mediaId: 'rig' }]);
  });
});

/** Each slot's box: the gallery renders every slot and hides all but the framed one. */
const slotBox = (id: string) => document.querySelector<HTMLElement>(`[data-media-entry-bar="${id}"]`)!.parentElement!;

describe('an item image field', () => {
  const lamp = { id: 'lamp', name: 'Lamp', images: [{ mediaId: BASE.id }, { mediaId: RIG.id }] } as unknown as Entity;

  it('titles a Layered Image slot with its name and offers Edit Layers that opens that rig; a flat image gets none', () => {
    render(
      <EntityImageWidget value={lamp} onChange={vi.fn()} ruleHost={LOCATION_RULE_HOST} imageId="item-image-lamp" linked>
        <ImageGallery />
      </EntityImageWidget>,
    );
    expect(slotBox(BASE.id).querySelector('[data-edit-layers]')).toBeNull();
    expect(within(slotBox(RIG.id)).getByDisplayValue('Lamp Rig')).toBeInTheDocument();
    const edit = slotBox(RIG.id).querySelector<HTMLElement>(`[data-edit-layers="${RIG.id}"]`)!;
    expect(edit.closest('[data-slot-frame]')).not.toBeNull();
    expect(edit).toHaveAccessibleName('Edit Layers');
    expect(edit).toHaveTextContent(/^$/);
    fireEvent.click(edit);
    expect(screen.getByRole('dialog')).toHaveTextContent('Lamp Rig');
  });
});

describe('a location image field', () => {
  const room = { id: 'room', name: 'Room', images: [{ mediaId: BASE.id }, { mediaId: RIG.id }] } as unknown as GameLocation;

  it('titles a Layered Image slot with its name and offers Edit Layers that opens that rig; a flat image gets none', () => {
    render(<LocationImageField location={room} onChange={vi.fn()} placeholders={[]} />);
    expect(slotBox(BASE.id).querySelector('[data-edit-layers]')).toBeNull();
    expect(within(slotBox(RIG.id)).getByDisplayValue('Lamp Rig')).toBeInTheDocument();
    const edit = slotBox(RIG.id).querySelector<HTMLElement>(`[data-edit-layers="${RIG.id}"]`)!;
    expect(edit.closest('[data-slot-frame]')).not.toBeNull();
    expect(edit).toHaveAccessibleName('Edit Layers');
    expect(edit).toHaveTextContent(/^$/);
    fireEvent.click(edit);
    expect(screen.getByRole('dialog')).toHaveTextContent('Lamp Rig');
  });
});

describe('an entity editor gallery slot', () => {
  const keeper = { id: 'keeper', name: 'Keeper', images: [{ mediaId: BASE.id }, { mediaId: RIG.id }] } as unknown as Entity;
  const slotOf = slotBox;

  it('offers Edit Layers as an icon on the frame of a Layered Image slot only, and it opens that rig', () => {
    render(
      <EntityImageWidget value={keeper} onChange={vi.fn()} imageId="entity-image-keeper" linked>
        <ImageGallery />
      </EntityImageWidget>,
    );
    expect(slotOf(BASE.id).querySelector('[data-edit-layers]')).toBeNull();
    const edit = slotOf(RIG.id).querySelector<HTMLElement>(`[data-edit-layers="${RIG.id}"]`)!;
    expect(edit.closest('[data-slot-frame]')).not.toBeNull();
    expect(edit).toHaveAccessibleName('Edit Layers');
    expect(edit).toHaveTextContent(/^$/);

    fireEvent.click(edit);
    expect(screen.getByRole('dialog')).toHaveTextContent('Lamp Rig');
    // The editor previews the picture as the entity whose slot opened it.
    expect(within(screen.getByRole('dialog')).getByRole('combobox', { name: 'Preview As' })).toHaveTextContent('Keeper');
  });
});

describe('a gallery’s name row', () => {
  const keeper = { id: 'keeper', name: 'Keeper', images: [{ mediaId: BASE.id }, { mediaId: RIG.id }] } as unknown as Entity;

  it('stays on every slot, disabled on the open one, so stepping between slots keeps the row', () => {
    render(
      <EntityImageWidget value={keeper} onChange={vi.fn()} imageId="entity-image-keeper" linked>
        <ImageGallery />
      </EntityImageWidget>,
    );
    // Two filled slots and the open one, each with its row.
    expect(document.querySelectorAll('[data-media-entry-bar]')).toHaveLength(3);

    fireEvent.click(screen.getByLabelText('Add an Image'));
    const open = document.querySelector<HTMLElement>('[data-media-entry-bar=""]')!;
    expect(within(open).getByPlaceholderText('Empty Slot')).toBeDisabled();
    expect(within(open).getByRole('button', { name: 'Remove From Slot' })).toBeDisabled();
    expect(within(open).getByRole('button', { name: 'Delete From World' })).toBeDisabled();
    expect(open.parentElement!.querySelector('[data-edit-layers]')).toBeNull();
  });
});

describe("an entity's Layered Image outside the editor", () => {
  const glum = { id: 'keeper', name: 'Keeper', stats: [{ id: 'mood', name: 'Mood', min: 0, max: 10, value: 2 } as Stat], images: [{ mediaId: FACE.id }] } as Entity;
  const source = () => ({ gateInput: libraryGateInput(glum, null), placeholders: [], offWorld: true });
  const shown = (root: ParentNode) => [...root.querySelectorAll('[data-layer] img')].map((img) => img.getAttribute('src'));
  const item = {
    id: 'entity:keeper:image:0', key: 'image:0', kind: 'layered', parent: { kind: 'entity', id: 'keeper', name: 'Keeper' },
    slot: 'Image 1', value: '', mediaId: FACE.id, bytes: 0, linked: false, overBudget: false,
  } as unknown as MediaItem;

  it("frames the picture under the entity's starting values", () => {
    render(
      <RuleSourceContext.Provider value={source}>
        <EntityImageWidget value={glum} onChange={vi.fn()} imageId="entity-image-keeper" linked><ImageGallery /></EntityImageWidget>
      </RuleSourceContext.Provider>,
    );
    const frame = slotBox(FACE.id).querySelector<HTMLElement>('[data-slot-frame]')!;
    expect(shown(frame)).toContain(FROWN.data);
    expect(shown(frame)).not.toContain(SMILE.data);
  });

  it("frames an embedded rig under the entity's starting values, as the library editor holds it", () => {
    const layered = { name: FACE.name, layers: [{ id: 'l-face', name: 'Face', variants: [{ data: SMILE.data, requires: FACE.layers[0].variants[0].requires }, { data: FROWN.data }] }] };
    const carried = { ...glum, images: [{ layered }] } as Entity;
    const { container } = render(
      <RuleSourceContext.Provider value={() => ({ gateInput: libraryGateInput(carried, null), placeholders: [], offWorld: true })}>
        <EntityImageWidget value={carried} onChange={vi.fn()} imageId="entity-image-keeper"><ImageGallery /></EntityImageWidget>
      </RuleSourceContext.Provider>,
    );
    const frame = container.querySelector<HTMLElement>('[data-slot-frame]')!;
    expect(shown(frame)).toEqual([FROWN.data]);
  });

  it("keeps each Layer's first Variant in an item's slot", () => {
    const lamp = { id: 'lamp', name: 'Lamp', images: [{ mediaId: FACE.id }] } as unknown as Entity;
    render(
      <RuleSourceContext.Provider value={source}>
        <EntityImageWidget value={lamp} onChange={vi.fn()} ruleHost={{ kind: 'item', id: 'lamp' }} imageId="item-image-lamp" linked><ImageGallery /></EntityImageWidget>
      </RuleSourceContext.Provider>,
    );
    expect(shown(slotBox(FACE.id).querySelector('[data-slot-frame]')!)).toEqual([SMILE.data]);
  });

  it("shows the Media tab's thumbnail under the entity's starting values", () => {
    const { container } = render(<RuleSourceContext.Provider value={source}><MediaThumb item={item} /></RuleSourceContext.Provider>);
    expect(shown(container)).toEqual([FROWN.data]);
  });

  it("opens Edit Layers from the Media tab previewing as the entity", () => {
    render(<MediaActionRow item={item} placeholders={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Layers' }));
    expect(within(screen.getByRole('dialog')).getByRole('combobox', { name: 'Preview As' })).toHaveTextContent('Keeper');
  });
});
