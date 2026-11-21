import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EntityImageWidget } from './EntityFields';
import { ImageGallery } from './ImageTagsField';
import { LOCATION_RULE_HOST } from '@/components/editor/ImageRuleCog';
import type { Entity, LayeredMediaEntry, MediaFileEntry, MediaList } from '@/types';

/** An item's image slot is the linked entity widget, the way ItemManager mounts it. */

const BASE: MediaFileEntry = { id: 'base-img', name: 'Lamp Base', kind: 'image', data: 'data:image/webp;base64,QUFB' };
const RIG: LayeredMediaEntry = { id: 'rig', name: 'Lamp Rig', kind: 'layered', layers: [{ id: 'l1', name: 'Base', variants: [{ mediaId: BASE.id }] }] };
const LIST: MediaList = { [BASE.id]: BASE, [RIG.id]: RIG };

vi.mock('@/contexts/GameDataContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/contexts/GameDataContext')>()),
  useGameData: () => ({ worldOverview: { mediaList: LIST }, addMedia: vi.fn() }),
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
