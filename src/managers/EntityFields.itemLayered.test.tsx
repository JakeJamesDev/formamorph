import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { EntityImageWidget } from './EntityFields';
import { LocationImageField } from './LocationImageField';
import { ImageGallery } from './ImageTagsField';
import { LOCATION_RULE_HOST } from '@/components/editor/ImageRuleCog';
import type { Entity, GameLocation, LayeredMediaEntry, MediaFileEntry, MediaList } from '@/types';

/** An item's image slot is the linked entity widget, the way ItemManager mounts it. */

const BASE: MediaFileEntry = { id: 'base-img', name: 'Lamp Base', kind: 'image', data: 'data:image/webp;base64,QUFB' };
const RIG: LayeredMediaEntry = { id: 'rig', name: 'Lamp Rig', kind: 'layered', layers: [{ id: 'l1', name: 'Base', variants: [{ mediaId: BASE.id }] }] };
const LIST: MediaList = { [BASE.id]: BASE, [RIG.id]: RIG };

vi.mock('@/contexts/GameDataContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/contexts/GameDataContext')>()),
  useGameData: () => ({ worldOverview: { mediaList: LIST }, addMedia: vi.fn(), entities: [], placeholders: [] }),
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
