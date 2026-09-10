import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { IMAGE_CAPS } from '../lib/imageOptim';
import ImageTagsField from './ImageTagsField';
import { EntityGalleryField } from './EntityFields';
import type { Entity } from '@/types';

// Stub the heavy leaf children; the upload stub exposes a button that fires the embedded-prompt handshake,
// and carries its slot's value and input id, which is what the add tile's label points at.
vi.mock('../lib/UtilityComponents', () => ({
  ImageUpload: ({ onPromptExtracted, value, id }: { onPromptExtracted?: (p: string) => void; value?: string | null; id: string }) => (
    <div data-testid="slot" data-value={value ?? ''} data-slot-id={id}>
      <button onClick={() => onPromptExtracted?.('extracted, tags')}>extract-prompt</button>
    </div>
  ),
}));
vi.mock('../components/GenerateImageButton', () => ({ GenerateImageButton: () => <div>generate</div> }));
vi.mock('@/components/AiGenerateButton', () => ({ default: () => <div /> }));
vi.mock('@/components/TagAutocomplete', () => ({ TagAutocomplete: () => <div /> }));
// Kept at full size, so the stored images are the dropped files as read.
vi.mock('@/lib/useDownscalePrompt', () => ({
  useDownscalePrompt: () => ({ promptImagesBatch: vi.fn(async () => 'off'), dialog: null }),
}));

const setup = () => {
  const onTagsChange = vi.fn();
  render(
    <ImageTagsField
      label="Image"
      images={[]}
      onImagesChange={() => {}}
      imageId="x"
      cap={IMAGE_CAPS.entity}
      kind="character"
      onTagsChange={onTagsChange}
    />,
  );
  return { onTagsChange };
};

describe('ImageTagsField embedded-prompt handshake', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies the extracted prompt as tags on Confirm, then closes', async () => {
    const { onTagsChange } = setup();
    fireEvent.click(screen.getByText('extract-prompt'));
    expect(await screen.findByText('Confirm')).toBeTruthy();
    fireEvent.click(screen.getByText('Confirm'));
    expect(onTagsChange).toHaveBeenCalledWith('extracted, tags');
    // Cleared on confirm — the dialog is gone and no stale prompt lingers.
    await vi.waitFor(() => expect(screen.queryByText('Confirm')).toBeNull());
  });

  it('leaves tags untouched on Cancel', async () => {
    const { onTagsChange } = setup();
    fireEvent.click(screen.getByText('extract-prompt'));
    fireEvent.click(await screen.findByText('Cancel'));
    expect(onTagsChange).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(screen.queryByText('Cancel')).toBeNull());
  });
});

describe('ImageTagsField uploads on an entity', () => {
  const DATA_A = 'data:image/webp;base64,AAAA';
  const DATA_B = 'data:image/webp;base64,BBBB';
  const DATA_C = 'data:image/webp;base64,CCCC';
  const LINK_A = 'https://example.com/a.webp';

  /** The entity's own widget, as the Entity panel configures it. */
  const gallery = (images: string[]) => {
    const onChange = vi.fn();
    render(<EntityGalleryField value={{ id: 'e1', name: 'Ada', images } as Entity} onChange={onChange} />);
    return { onChange };
  };

  /** The trailing empty row — the one an author adds through. */
  const emptyRow = () => screen.getAllByTestId('slot').find((s) => !s.getAttribute('data-value'));
  const addTile = () => screen.getByLabelText('Add an Image');

  it('points the add tile at the open slot’s file picker on an entity with two uploads', () => {
    gallery([DATA_A, DATA_B]);
    expect(addTile().getAttribute('for')).toBe(`image-upload-${emptyRow()?.getAttribute('data-slot-id')}`);
  });

  it('takes every file of a three-file drop onto an entity with two images', async () => {
    const { onChange } = gallery([DATA_A, DATA_B]);
    const files = ['c.png', 'd.png', 'e.png'].map((name) => new File(['x'], name, { type: 'image/png' }));

    fireEvent.drop(addTile(), { dataTransfer: { files, types: ['Files'], getData: () => '' } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('images', expect.any(Array)));
    const [, images] = onChange.mock.calls[0] as [string, string[]];
    expect(images).toHaveLength(5);
    expect(images.slice(0, 2)).toEqual([DATA_A, DATA_B]);
  });

  it('keeps every picture of an import with more than two uploads, and still offers the picker', () => {
    // Import does not truncate, so the editor shows every picture it was handed.
    gallery([DATA_A, DATA_B, DATA_C, LINK_A]);
    expect(screen.getAllByTestId('slot').filter((s) => s.getAttribute('data-value'))).toHaveLength(4);
    expect(addTile().getAttribute('for')).toBe(`image-upload-${emptyRow()?.getAttribute('data-slot-id')}`);
  });

  it('keeps a location to one background slot, filled or empty', () => {
    const location = (images: string[]) => render(
      <ImageTagsField
        label="Background Image"
        images={images}
        onImagesChange={() => {}}
        imageId="loc"
        cap={IMAGE_CAPS.background}
        kind="location"
        onTagsChange={() => {}}
      />,
    );
    location([]);
    expect(screen.getAllByTestId('slot')).toHaveLength(1);
    cleanup();

    location([DATA_A]);
    expect(screen.getAllByTestId('slot')).toHaveLength(1);
    expect(screen.queryByLabelText('Add an Image')).toBeNull();
  });
});
