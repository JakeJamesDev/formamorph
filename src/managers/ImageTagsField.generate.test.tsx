import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IMAGE_CAPS } from '../lib/imageOptim';
import ImageTagsField from './ImageTagsField';
import { EntityGalleryField } from './EntityFields';
import type { Entity } from '@/types';

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

/** The entity's own widget, holding its images in state so a placed picture shows up in the strip. */
const entitySetup = (images: string[]) => {
  const onImagesChange = vi.fn();
  const Host = () => {
    const [value, setValue] = useState({ id: 'e1', name: 'Ada', images } as Entity);
    return (
      <EntityGalleryField
        value={value}
        onChange={(field, next) => {
          if (field === 'images') onImagesChange(next);
          setValue((prev) => ({ ...prev, [field]: next }));
        }}
      />
    );
  };
  render(<Host />);
  return { onImagesChange };
};

/** A location's background, configured as the Location panel configures it. */
const locationSetup = (images: string[]) => {
  const onImagesChange = vi.fn();
  render(
    <ImageTagsField
      label="Background Image"
      images={images}
      onImagesChange={onImagesChange}
      imageId="loc"
      cap={IMAGE_CAPS.background}
      kind="location"
      onTagsChange={vi.fn()}
    />,
  );
  return { onImagesChange };
};

const generate = () => fireEvent.click(screen.getByRole('button', { name: 'Generate with AI' }));
const picker = () => screen.queryByText('Replace which image?');

describe('ImageTagsField generated-image placement on an entity', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('adds after the primary instead of writing over it', async () => {
    const { onImagesChange } = entitySetup([A]);

    generate();

    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith([A, GENERATED]));
    expect(picker()).toBeNull();
  });

  it('takes the primary slot when the entity has no pictures yet', async () => {
    const { onImagesChange } = entitySetup([]);

    generate();

    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith([GENERATED]));
  });

  it('adds a new image to an entity that already holds two uploads, and asks nothing', async () => {
    const { onImagesChange } = entitySetup([A, B]);

    generate();

    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith([A, B, GENERATED]));
    expect(picker()).toBeNull();
    // The generate dialog is told the picture was kept, so it may close.
    await waitFor(() => expect(placed).toHaveBeenCalledWith(true));
  });

  it('frames the image it adds, not the one on show before', async () => {
    entitySetup([A, B]);
    fireEvent.click(screen.getByRole('button', { name: 'Image 2' }));

    generate();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Image 3' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('button', { name: 'Image 2' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('adds after linked images as well, keeping every one', async () => {
    const { onImagesChange } = entitySetup([A, B, LINK]);

    generate();

    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith([A, B, LINK, GENERATED]));
    expect(picker()).toBeNull();
  });
});

describe('ImageTagsField generated-image placement on a location', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('confirms the overwrite on a filled background rather than replacing it silently', async () => {
    const { onImagesChange } = locationSetup([A]);

    generate();

    expect(await screen.findByText('Replace which image?')).toBeTruthy();
    expect(onImagesChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith([GENERATED]));
    await waitFor(() => expect(placed).toHaveBeenCalledWith(true));
  });

  it('changes nothing and reports the picture unplaced when the pick is canceled', async () => {
    const { onImagesChange } = locationSetup([A]);

    generate();
    await screen.findByText('Replace which image?');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(placed).toHaveBeenCalledWith(false));
    expect(onImagesChange).not.toHaveBeenCalled();
    expect(picker()).toBeNull();
  });

  it('lets a generated picture replace a linked background', async () => {
    const { onImagesChange } = locationSetup([LINK]);

    generate();
    fireEvent.click(await screen.findByRole('button', { name: 'Replace' }));

    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith([GENERATED]));
  });
});
