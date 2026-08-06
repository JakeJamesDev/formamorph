import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IMAGE_CAPS } from '../lib/imageOptim';
import ImageTagsField from './ImageTagsField';

// Stub the heavy leaf children; the upload stub exposes a button that fires the embedded-prompt handshake,
// and reports the slot's own `allowUpload` so the byte allowance can be asserted per row.
vi.mock('../lib/UtilityComponents', () => ({
  ImageUpload: ({ onPromptExtracted, value, allowUpload }: { onPromptExtracted?: (p: string) => void; value?: string | null; allowUpload?: boolean }) => (
    <div data-testid="slot" data-value={value ?? ''} data-allow-upload={String(allowUpload ?? true)}>
      <button onClick={() => onPromptExtracted?.('extracted, tags')}>extract-prompt</button>
    </div>
  ),
}));
vi.mock('../components/GenerateImageButton', () => ({ GenerateImageButton: () => <div>generate</div> }));
vi.mock('@/components/AiFieldToolbar', () => ({ default: () => <div /> }));
vi.mock('@/components/TagAutocomplete', () => ({ TagAutocomplete: () => <div /> }));

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

describe('ImageTagsField embedded allowance', () => {
  const DATA_A = 'data:image/webp;base64,AAAA';
  const DATA_B = 'data:image/webp;base64,BBBB';
  const LINK_A = 'https://example.com/a.webp';
  const LINK_B = 'https://example.com/b.webp';

  /** An entity-shaped gallery: unbounded slots, two pictures' worth of bytes. */
  const gallery = (images: string[]) =>
    render(
      <ImageTagsField
        label="Image"
        images={images}
        onImagesChange={() => {}}
        slots={Infinity}
        embeddedLimit={2}
        imageId="x"
        cap={IMAGE_CAPS.entity}
        kind="character"
        onTagsChange={() => {}}
      />,
    );

  /** The trailing empty row — the one an author adds through. */
  const emptyRow = () => screen.getAllByTestId('slot').find((s) => !s.getAttribute('data-value'));

  it('offers the file picker while the byte allowance is unspent', () => {
    gallery([DATA_A]);
    expect(emptyRow()?.getAttribute('data-allow-upload')).toBe('true');
  });

  it('withholds the file picker once two pictures carry their own bytes', () => {
    gallery([DATA_A, DATA_B]);
    // Still a row to add through — links are what it is for.
    expect(emptyRow()).toBeTruthy();
    expect(emptyRow()?.getAttribute('data-allow-upload')).toBe('false');
  });

  it('never counts links against the allowance', () => {
    gallery([LINK_A, LINK_B, DATA_A, LINK_A]);
    expect(emptyRow()?.getAttribute('data-allow-upload')).toBe('true');
  });

  it('keeps growing by link past the point uploads stop', () => {
    gallery([DATA_A, DATA_B, LINK_A, LINK_B]);
    // Four pictures held, a fifth row offered, and no truncation of what is already there.
    expect(screen.getAllByTestId('slot')).toHaveLength(5);
    expect(emptyRow()?.getAttribute('data-allow-upload')).toBe('false');
  });

  it('keeps every picture of an import that already exceeds the allowance', () => {
    // Import deliberately does not truncate, so the editor has to show what it was handed rather than
    // silently dropping the tail — it just refuses to add more bytes on top.
    const DATA_C = 'data:image/webp;base64,CCCC';
    gallery([DATA_A, DATA_B, DATA_C, LINK_A]);
    expect(screen.getAllByTestId('slot').filter((s) => s.getAttribute('data-value'))).toHaveLength(4);
    expect(emptyRow()?.getAttribute('data-allow-upload')).toBe('false');
  });

  it('withdraws Generate when it would spend an allowance that is gone', () => {
    // Primary is a link, so generating would add a third set of bytes rather than replace one.
    gallery([LINK_A, DATA_A, DATA_B]);
    expect(screen.queryByText('generate')).toBeNull();
  });

  it('keeps Generate when it would only overwrite the primary’s own bytes', () => {
    gallery([DATA_A, DATA_B]);
    expect(screen.getByText('generate')).toBeTruthy();
  });

  it('leaves a single-slot field (a location background) alone', () => {
    render(
      <ImageTagsField
        label="Background Image"
        images={[]}
        onImagesChange={() => {}}
        imageId="loc"
        cap={IMAGE_CAPS.background}
        kind="location"
        onTagsChange={() => {}}
      />,
    );
    expect(screen.getAllByTestId('slot')).toHaveLength(1);
    expect(emptyRow()?.getAttribute('data-allow-upload')).toBe('true');
  });
});
