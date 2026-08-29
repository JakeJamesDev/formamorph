import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IMAGE_CAPS } from '../lib/imageOptim';
import ImageTagsField from './ImageTagsField';

// The uploader itself is covered by its own tests; here it stands in as a marker carrying the slot's value
// and the id its file input would use, which is what the add tile's label points at.
vi.mock('../lib/UtilityComponents', async () => {
  const { useRef } = await import('react');
  let seq = 0;
  return {
    ImageUpload: ({ value, id, onChange }: { value?: string | null; id: string; onChange: (v: string) => void }) => {
      // A number minted once per mounted uploader, so a test can tell a moved slot from a rewritten one.
      const instance = useRef<number>(0);
      if (!instance.current) instance.current = ++seq;
      return (
        <div data-testid="slot" data-value={value ?? ''} data-slot-id={id} data-instance={String(instance.current)}>
          <button onClick={() => onChange('')}>remove</button>
        </div>
      );
    },
  };
});
vi.mock('../components/GenerateImageButton', () => ({ GenerateImageButton: () => <div>generate</div> }));
vi.mock('@/components/AiGenerateButton', () => ({ default: () => <div /> }));
vi.mock('@/lib/useRemoteImage', () => ({ RemoteImg: ({ src }: { src?: string }) => <img src={src} alt="" /> }));

// Answered "keep as-is" by default, so the stored URLs are the dropped ones untouched — most of these tests
// are about which slots get filled, not about re-encoding. The conversion tests choose a real mode.
const promptImagesBatch = vi.fn(async () => 'off' as unknown as 'off' | 'downscale');
vi.mock('@/lib/useDownscalePrompt', () => ({
  useDownscalePrompt: () => ({ promptImagesBatch, dialog: null }),
}));

// Gate the encode so the overlay can be inspected mid-run.
const applyImageOptimize = vi.fn(async (url: string) => url);
vi.mock('@/lib/imageOptim', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/imageOptim')>()),
  applyImageOptimize: (url: string) => applyImageOptimize(url),
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
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks leaves implementations in place, so the held-open encode is put back per test.
    applyImageOptimize.mockImplementation(async (url: string) => url);
  });

  it('frames the primary and puts a tile for every picture beneath it, plus one to add', () => {
    setup([A, B]);

    expect(slotWrapper(A).className).not.toMatch(/hidden/);
    expect(slotWrapper(B).className).toMatch(/hidden/);
    expect(tile('Primary image')).toBeTruthy();
    expect(tile('Image 2')).toBeTruthy();
    expect(screen.getByLabelText('Add an image')).toBeTruthy();
  });

  it('frames the picture whose tile is pressed', () => {
    setup([A, B]);

    fireEvent.click(tile('Image 2'));

    expect(slotWrapper(B).className).not.toMatch(/hidden/);
    expect(slotWrapper(A).className).toMatch(/hidden/);
  });

  it('marks the first picture as the one that stands in, and offers no promote button', () => {
    setup([A, B, C]);

    // Order is the whole mechanism now: position 0 is the stand-in, so there is nothing to press.
    expect(screen.queryByText(/Make Primary/)).toBeNull();
    expect(tile('Primary image').querySelector('svg')).toBeTruthy();
    expect(tile('Image 2').querySelector('svg')).toBeNull();
  });

  it('says a tile can be dragged, and lets a press through as a plain click', async () => {
    setup([A, B]);

    await userEvent.hover(tile('Primary image'));
    expect(await screen.findByText(/Drag to reorder/)).toBeVisible();
    // The 5px activation constraint is what keeps this working; a tap must still frame the picture.
    fireEvent.click(tile('Image 2'));
    expect(slotWrapper(B).className).not.toMatch(/hidden/);
  });

  it('moves a reordered slot rather than handing it a different image', () => {
    const instances = () => Object.fromEntries(
      screen.getAllByTestId('slot')
        .filter((n) => n.getAttribute('data-value'))
        .map((n) => [n.getAttribute('data-value'), n.getAttribute('data-instance')]),
    );
    const { rerender } = render(
      <ImageTagsField label="Image" images={[A, B, C]} onImagesChange={vi.fn()} slots={4} imageId="x"
        cap={IMAGE_CAPS.entity} kind="character" onTagsChange={vi.fn()} />,
    );
    const before = instances();

    // The reorder a drag produces.
    rerender(
      <ImageTagsField label="Image" images={[C, A, B]} onImagesChange={vi.fn()} slots={4} imageId="x"
        cap={IMAGE_CAPS.entity} kind="character" onTagsChange={vi.fn()} />,
    );

    // Each image stays with the uploader it was already in. Keyed by position they would swap uploaders,
    // and an uploader's resolved src lags its value by a render — which is the flicker on drop.
    expect(instances()).toEqual(before);
  });

  it('keeps the frame in range when the pictures behind it are removed', () => {
    const { rerender } = render(
      <ImageTagsField label="Image" images={[A, B, C]} onImagesChange={vi.fn()} slots={4} imageId="x"
        cap={IMAGE_CAPS.entity} kind="character" onTagsChange={vi.fn()} />,
    );
    // Frame the third picture, then drop back to one: the trailing empty slot means index 1 would still be
    // in range, so only a selection past that proves the clamp does anything.
    fireEvent.click(tile('Image 3'));

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
    expect(screen.getByLabelText('Add an image').getAttribute('for')).toBe(`image-upload-${emptyId}`);
  });

  it('fills consecutive slots from files dropped on the add tile, asking once for the batch', async () => {
    const { onImagesChange } = setup([A]);
    const files = [new File(['1'], 'b.png', { type: 'image/png' }), new File(['2'], 'c.png', { type: 'image/png' })];

    fireEvent.drop(screen.getByLabelText('Add an image'), {
      dataTransfer: { files, types: ['Files'], getData: () => '' },
    });

    await waitFor(() => expect(onImagesChange).toHaveBeenCalled());
    expect(promptImagesBatch).toHaveBeenCalledTimes(1);
    expect(onImagesChange.mock.calls[0][0]).toHaveLength(3);
  });

  it('brings the open slot into the frame when a drag arrives over a filled one', () => {
    setup([A, B]);
    const pane = slotWrapper(A).parentElement!;
    expect(slotWrapper(A).className).not.toMatch(/hidden/);

    fireEvent.dragOver(pane, { dataTransfer: { files: [], types: ['Files'], getData: () => '' } });

    // The empty slot is framed, so the drop's destination is what's on screen rather than a picture it was
    // never going to replace.
    const visible = screen.getAllByTestId('slot').filter((n) => !n.parentElement!.className.includes('hidden'));
    expect(visible.map((n) => n.getAttribute('data-value'))).toEqual(['']);
    // Marked on this first event, which is the one that swaps: the slot it swapped to won't hear about the
    // drag until the next one, and an unmarked frame in between reads as nothing having happened.
    expect(pane.className).toMatch(/ring-primary/);

    fireEvent.dragLeave(pane);
    expect(pane.className).not.toMatch(/ring-primary/);
  });

  it('drops onto the open slot when the drag never reaches a slot of its own', async () => {
    const { onImagesChange } = setup([A, B]);
    const pane = slotWrapper(A).parentElement!;

    fireEvent.drop(pane, {
      dataTransfer: { files: [], types: ['text/uri-list'], getData: (t: string) => (t === 'text/uri-list' ? 'https://files.example/c.png' : '') },
    });

    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith([A, B, 'https://files.example/c.png']));
  });

  it('takes no drop once every slot is full', () => {
    const { onImagesChange } = setup([A, B, C], 3);
    const pane = slotWrapper(A).parentElement!;

    fireEvent.drop(pane, {
      dataTransfer: { files: [], types: ['text/uri-list'], getData: (t: string) => (t === 'text/uri-list' ? 'https://files.example/d.png' : '') },
    });

    expect(onImagesChange).not.toHaveBeenCalled();
  });

  it('frames the slot being filled when the drop lands on the add tile', async () => {
    // One picture, framed as the primary — the state where converting over the top of it is most obviously
    // wrong, because the picture under the bar is not the picture being converted.
    promptImagesBatch.mockResolvedValueOnce('downscale');
    const release: Array<() => void> = [];
    applyImageOptimize.mockImplementation((url: string) =>
      new Promise<string>((resolve) => { release.push(() => resolve(url)); }));
    setup([A]);
    expect(slotWrapper(A).className).not.toMatch(/hidden/);

    fireEvent.drop(screen.getByLabelText('Add an image'), {
      dataTransfer: { files: [new File(['1'], 'b.png', { type: 'image/png' })], types: ['Files'], getData: () => '' },
    });

    await screen.findByRole('status', { name: 'Converting image' });
    // The empty slot is framed, so the bar covers the picture actually being worked on.
    expect(slotWrapper(A).className).toMatch(/hidden/);
    const visible = screen.getAllByTestId('slot').filter((n) => !n.parentElement!.className.includes('hidden'));
    expect(visible.map((n) => n.getAttribute('data-value'))).toEqual(['']);

    release[0]();
    await waitFor(() => expect(screen.queryByRole('status', { name: /^Converting/ })).toBeNull());
  });

  it('counts the batch over the frame while it converts, and freezes the strip', async () => {
    promptImagesBatch.mockResolvedValueOnce('downscale');
    // Both encodes are held, so the counter has to actually advance between them — releasing only the first
    // would let a counter stuck at 0 pass, since the run would finish before the second could be read.
    const release: Array<() => void> = [];
    applyImageOptimize.mockImplementation((url: string) =>
      new Promise<string>((resolve) => { release.push(() => resolve(url)); }));
    setup([A]);
    const files = [new File(['1'], 'b.png', { type: 'image/png' }), new File(['2'], 'c.png', { type: 'image/png' })];

    fireEvent.drop(screen.getByLabelText('Add an image'), {
      dataTransfer: { files, types: ['Files'], getData: () => '' },
    });

    expect(await screen.findByRole('status', { name: 'Converting image 1 of 2' })).toBeTruthy();
    expect(tile('Primary image').closest('div')!.className).toMatch(/pointer-events-none/);
    // From the dropped file, not the data URL it encodes to — a base64 string that size blocks the main
    // thread for long enough that this overlay never reaches the screen while the work is happening.
    const src = screen.getByRole('status', { name: /^Converting/ }).querySelector('img')!.getAttribute('src')!;
    expect(src.startsWith('data:')).toBe(false);
    expect(src.startsWith('blob:')).toBe(true);

    release[0]();
    expect(await screen.findByRole('status', { name: 'Converting image 2 of 2' })).toBeTruthy();

    release[1]();
    await waitFor(() => expect(screen.queryByRole('status', { name: /^Converting/ })).toBeNull());
    expect(tile('Primary image').closest('div')!.className).not.toMatch(/pointer-events-none/);
  });

  it('shows no bar when the batch is kept at full size — nothing is being converted', async () => {
    const { onImagesChange } = setup([A]);
    const files = [new File(['1'], 'b.png', { type: 'image/png' })];

    fireEvent.drop(screen.getByLabelText('Add an image'), {
      dataTransfer: { files, types: ['Files'], getData: () => '' },
    });

    await waitFor(() => expect(onImagesChange).toHaveBeenCalled());
    expect(screen.queryByRole('status', { name: /^Converting/ })).toBeNull();
    expect(applyImageOptimize).not.toHaveBeenCalled();
  });

  it('leaves a single-slot subject as the plain uploader, with no strip', () => {
    setup([A], 1);

    expect(screen.queryByLabelText('Add an image')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Primary image' })).toBeNull();
    expect(slotWrapper(A).className).not.toMatch(/hidden/);
  });
});
