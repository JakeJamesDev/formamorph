import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { IMAGE_CAPS } from '../lib/imageOptim';
import ImageTagsField from './ImageTagsField';

// Stands in for the uploader as a marker carrying its slot's value, like the gallery tests use.
vi.mock('../lib/UtilityComponents', () => ({
  ImageUpload: ({ value, id }: { value?: string | null; id: string }) => (
    <div data-testid="slot" data-value={value ?? ''} data-slot-id={id} />
  ),
}));
vi.mock('@/components/AiGenerateButton', () => ({ default: () => <div /> }));
vi.mock('@/lib/useRemoteImage', () => ({ RemoteImg: ({ src }: { src?: string }) => <img src={src} alt="" /> }));
vi.mock('@/lib/useDownscalePrompt', () => ({
  useDownscalePrompt: () => ({ promptImagesBatch: vi.fn(), dialog: null }),
}));

// The generate dialog's own behavior is covered by GenerateImageButton.test.tsx; here it is reduced to the
// one thing this field cares about — handing over a finished picture and hearing whether it was kept.
const placed = vi.fn();
vi.mock('../components/GenerateImageButton', () => ({
  GenerateImageButton: ({ onChange }: { onChange: (u: string) => void | boolean | Promise<void | boolean> }) => (
    <button onClick={() => void Promise.resolve(onChange(GENERATED)).then(placed)}>Generate with AI</button>
  ),
}));

const A = 'data:image/webp;base64,AAAA';
const B = 'data:image/webp;base64,BBBB';
const LINK = 'https://files.example/c.png';
const GENERATED = 'data:image/webp;base64,GGGG';

const setup = (images: string[], { slots = 8, embeddedLimit = 2 } = {}) => {
  const onImagesChange = vi.fn();
  render(
    <ImageTagsField
      label="Image"
      images={images}
      onImagesChange={onImagesChange}
      slots={slots}
      embeddedLimit={embeddedLimit}
      imageId="x"
      cap={IMAGE_CAPS.entity}
      kind="character"
      onTagsChange={vi.fn()}
    />,
  );
  return { onImagesChange };
};

const generate = () => fireEvent.click(screen.getByRole('button', { name: 'Generate with AI' }));
const picker = () => screen.queryByText('Replace which image?');
// Scoped, because the strip's own tiles are labelled "Image 2" too — the point of the pick is to name the
// same pictures, so the two sets of labels are meant to read alike.
const inPicker = () => within(screen.getByRole('dialog'));

describe('ImageTagsField generated-image placement', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('fills the first empty slot instead of writing over the primary', async () => {
    const { onImagesChange } = setup([A]);

    generate();

    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith([A, GENERATED]));
    expect(picker()).toBeNull();
  });

  it('takes the primary slot when the subject has no pictures yet', async () => {
    const { onImagesChange } = setup([]);

    generate();

    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith([GENERATED]));
  });

  it('asks which picture to replace once the embedded allowance is spent', async () => {
    const { onImagesChange } = setup([A, B]);

    generate();

    expect(await screen.findByText('Replace which image?')).toBeTruthy();
    // Nothing is written until a slot is chosen.
    expect(onImagesChange).not.toHaveBeenCalled();

    fireEvent.click(inPicker().getByLabelText('Image 2'));
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith([A, GENERATED]));
    // The generate dialog is told the picture was kept, so it may close.
    await waitFor(() => expect(placed).toHaveBeenCalledWith(true));
  });

  it('starts the pick on the picture being framed', async () => {
    setup([A, B]);
    fireEvent.click(screen.getByRole('button', { name: 'Image 2' }));

    generate();

    await screen.findByText('Replace which image?');
    expect(inPicker().getByLabelText('Image 2')).toBeChecked();
  });

  it('leaves out slots holding a link, which bytes may not replace at the limit', async () => {
    setup([A, B, LINK]);

    generate();

    await screen.findByText('Replace which image?');
    // Replacing the link would add a third embedded picture to a subject allowed two.
    expect(inPicker().queryByLabelText('Image 3')).toBeNull();
    expect(inPicker().getByLabelText('Primary')).toBeTruthy();
    expect(inPicker().getByLabelText('Image 2')).toBeTruthy();
  });

  it('changes nothing and reports the picture unplaced when the pick is cancelled', async () => {
    const { onImagesChange } = setup([A, B]);

    generate();
    await screen.findByText('Replace which image?');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(placed).toHaveBeenCalledWith(false));
    expect(onImagesChange).not.toHaveBeenCalled();
    expect(picker()).toBeNull();
  });

  it('confirms the overwrite on a filled single-slot subject rather than replacing it silently', async () => {
    const { onImagesChange } = setup([A], { slots: 1, embeddedLimit: 1 });

    generate();

    expect(await screen.findByText('Replace which image?')).toBeTruthy();
    expect(onImagesChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith([GENERATED]));
  });

  it('offers no generation when every slot holds a link it may not replace', () => {
    setup([LINK], { slots: 1, embeddedLimit: 0 });

    expect(screen.queryByRole('button', { name: 'Generate with AI' })).toBeNull();
  });
});
