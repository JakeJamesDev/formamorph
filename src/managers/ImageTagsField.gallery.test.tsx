import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IMAGE_CAPS } from '../lib/imageOptim';
import ImageTagsField from './ImageTagsField';

// The uploader itself is covered by its own tests; here it stands in as a marker carrying the slot's value
// and the id its file input would use, which is what the add tile's label points at.
vi.mock('../lib/UtilityComponents', () => ({
  ImageUpload: ({ value, id, onChange }: { value?: string | null; id: string; onChange: (v: string) => void }) => (
    <div data-testid="slot" data-value={value ?? ''} data-slot-id={id}>
      <button onClick={() => onChange('')}>remove</button>
    </div>
  ),
}));
vi.mock('../components/GenerateImageButton', () => ({ GenerateImageButton: () => <div>generate</div> }));
vi.mock('@/components/AiGenerateButton', () => ({ default: () => <div /> }));
vi.mock('@/lib/useRemoteImage', () => ({ RemoteImg: ({ src }: { src?: string }) => <img src={src} alt="" /> }));

// A batch drop asks once and is answered "keep as-is", so the stored URLs are the dropped ones untouched —
// this test is about which slots get filled, not about re-encoding.
const promptImagesBatch = vi.fn(async () => 'off' as const);
vi.mock('@/lib/useDownscalePrompt', () => ({
  useDownscalePrompt: () => ({ promptImagesBatch, dialog: null }),
}));

const A = 'data:image/webp;base64,AAAA';
const B = 'data:image/webp;base64,BBBB';
const C = 'data:image/webp;base64,CCCC';

const setup = (images: string[], slots = 4) => {
  const onImagesChange = vi.fn();
  render(
    <ImageTagsField
      label="Image"
      images={images}
      onImagesChange={onImagesChange}
      slots={slots}
      imageId="x"
      cap={IMAGE_CAPS.entity}
      kind="character"
      onTagsChange={vi.fn()}
    />,
  );
  return { onImagesChange };
};

/** The wrapper the gallery hides when a slot is not the one being framed. */
const slotWrapper = (value: string) =>
  screen.getAllByTestId('slot').find((n) => n.getAttribute('data-value') === value)!.parentElement!;

const tile = (name: string) => screen.getByRole('button', { name });

describe('ImageTagsField gallery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('frames the primary and puts a tile for every picture beneath it, plus one to add', () => {
    setup([A, B]);

    expect(slotWrapper(A).className).not.toMatch(/hidden/);
    expect(slotWrapper(B).className).toMatch(/hidden/);
    expect(tile('Primary picture')).toBeTruthy();
    expect(tile('Picture 2')).toBeTruthy();
    expect(screen.getByLabelText('Add a picture')).toBeTruthy();
  });

  it('frames the picture whose tile is pressed', () => {
    setup([A, B]);

    fireEvent.click(tile('Picture 2'));

    expect(slotWrapper(B).className).not.toMatch(/hidden/);
    expect(slotWrapper(A).className).toMatch(/hidden/);
  });

  it('offers Make Primary only for a framed picture that is not already primary', () => {
    setup([A, B]);

    expect(screen.queryByText('Make Primary')).toBeNull();
    expect(screen.getByText(/^Primary —/)).toBeTruthy();

    fireEvent.click(tile('Picture 2'));
    expect(screen.getByText('Make Primary')).toBeTruthy();
  });

  it('swaps the framed picture into the primary slot', () => {
    const { onImagesChange } = setup([A, B, C]);

    fireEvent.click(tile('Picture 3'));
    fireEvent.click(screen.getByText('Make Primary'));

    expect(onImagesChange).toHaveBeenCalledWith([C, B, A]);
  });

  it('keeps the frame in range when the pictures behind it are removed', () => {
    const { rerender } = render(
      <ImageTagsField label="Image" images={[A, B, C]} onImagesChange={vi.fn()} slots={4} imageId="x"
        cap={IMAGE_CAPS.entity} kind="character" onTagsChange={vi.fn()} />,
    );
    // Frame the third picture, then drop back to one: the trailing empty slot means index 1 would still be
    // in range, so only a selection past that proves the clamp does anything.
    fireEvent.click(tile('Picture 3'));

    rerender(
      <ImageTagsField label="Image" images={[A]} onImagesChange={vi.fn()} slots={4} imageId="x"
        cap={IMAGE_CAPS.entity} kind="character" onTagsChange={vi.fn()} />,
    );

    // Slot 1 is now the empty add slot; the frame lands on it rather than past the end showing nothing.
    const visible = screen.getAllByTestId('slot').filter((n) => !n.parentElement!.className.includes('hidden'));
    expect(visible).toHaveLength(1);
    expect(visible[0].getAttribute('data-value')).toBe('');
  });

  it('points the add tile at the empty slot\'s file picker', () => {
    setup([A]);

    const emptyId = screen.getAllByTestId('slot')
      .find((n) => !n.getAttribute('data-value'))!.getAttribute('data-slot-id');
    expect(screen.getByLabelText('Add a picture').getAttribute('for')).toBe(`image-upload-${emptyId}`);
  });

  it('fills consecutive slots from files dropped on the add tile, asking once for the batch', async () => {
    const { onImagesChange } = setup([A]);
    const files = [new File(['1'], 'b.png', { type: 'image/png' }), new File(['2'], 'c.png', { type: 'image/png' })];

    fireEvent.drop(screen.getByLabelText('Add a picture'), {
      dataTransfer: { files, types: ['Files'], getData: () => '' },
    });

    await waitFor(() => expect(onImagesChange).toHaveBeenCalled());
    expect(promptImagesBatch).toHaveBeenCalledTimes(1);
    expect(onImagesChange.mock.calls[0][0]).toHaveLength(3);
  });

  it('leaves a single-slot subject as the plain uploader, with no strip', () => {
    setup([A], 1);

    expect(screen.queryByLabelText('Add a picture')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Primary picture' })).toBeNull();
    expect(slotWrapper(A).className).not.toMatch(/hidden/);
  });
});
