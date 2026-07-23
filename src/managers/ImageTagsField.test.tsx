import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IMAGE_CAPS } from '../lib/imageOptim';
import ImageTagsField from './ImageTagsField';

// Stub the heavy leaf children; the upload stub exposes a button that fires the embedded-prompt handshake.
vi.mock('../lib/UtilityComponents', () => ({
  ImageUpload: ({ onPromptExtracted }: { onPromptExtracted?: (p: string) => void }) => (
    <button onClick={() => onPromptExtracted?.('extracted, tags')}>extract-prompt</button>
  ),
}));
vi.mock('../components/GenerateImageButton', () => ({ GenerateImageButton: () => <div /> }));
vi.mock('@/components/AiFieldToolbar', () => ({ default: () => <div /> }));
vi.mock('@/components/TagAutocomplete', () => ({ TagAutocomplete: () => <div /> }));

const setup = () => {
  const onTagsChange = vi.fn();
  render(
    <ImageTagsField
      label="Image"
      onImageChange={() => {}}
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
