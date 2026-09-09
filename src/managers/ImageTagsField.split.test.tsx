import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { IMAGE_CAPS } from '../lib/imageOptim';
import { EditorModeContext, type EditorMode } from '@/lib/editorMode';
import { ImageWidget, ImageGallery, ImageTags } from './ImageTagsField';

// The uploader stands in as a marker that can fire the embedded-prompt handshake, as the gallery suite does.
vi.mock('../lib/UtilityComponents', () => ({
  ImageUpload: ({ onPromptExtracted }: { onPromptExtracted?: (p: string) => void }) => (
    <div data-testid="slot">
      <button onClick={() => onPromptExtracted?.('extracted, tags')}>extract-prompt</button>
    </div>
  ),
}));
// The generate dialog is covered by its own suite; here it only writes the tags it came back with.
vi.mock('../components/GenerateImageButton', () => ({
  GenerateImageButton: ({ onTagsChange }: { onTagsChange: (v: string) => void }) => (
    <button onClick={() => onTagsChange('generated, tags')}>Generate with AI</button>
  ),
}));
vi.mock('@/components/AiGenerateButton', () => ({ default: () => <div /> }));
vi.mock('@/lib/danbooruTags', () => ({ loadDanbooruTags: vi.fn(async () => []) }));

/** The entity Profile layout: the gallery in one column, the tags field in another box entirely. */
const Split = () => {
  const [tags, setTags] = useState('');
  return (
    <ImageWidget
      label="Image"
      images={[]}
      onImagesChange={() => {}}
      slots={Infinity}
      embeddedLimit={2}
      imageId="x"
      cap={IMAGE_CAPS.entity}
      kind="character"
      tags={tags}
      onTagsChange={setTags}
    >
      <div data-testid="left"><ImageGallery /></div>
      <div data-testid="right"><ImageTags /></div>
    </ImageWidget>
  );
};

const inMode = (mode: EditorMode) => render(
  <EditorModeContext.Provider value={{ mode, advanced: mode === 'advanced', setMode: () => {} }}>
    <Split />
  </EditorModeContext.Provider>,
);

const left = () => within(screen.getByTestId('left'));
const right = () => within(screen.getByTestId('right'));
const tagsValue = () => screen.getByLabelText('Image Tags').textContent;

describe('ImageTagsField placed as two pieces', () => {
  beforeEach(() => vi.clearAllMocks());

  it('draws the tags field outside the gallery box and keeps Generate inside it', () => {
    render(<Split />);

    expect(right().getByLabelText('Image Tags')).toBeTruthy();
    expect(left().queryByLabelText('Image Tags')).toBeNull();
    expect(left().getByRole('button', { name: 'Generate with AI' })).toBeTruthy();
  });

  it('fills the separately placed field when the author adopts an image’s embedded prompt', async () => {
    render(<Split />);

    fireEvent.click(left().getByText('extract-prompt'));
    fireEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(tagsValue()).toBe('extracted, tags'));
  });

  it('lands generated tags in the separately placed field', async () => {
    render(<Split />);

    fireEvent.click(left().getByRole('button', { name: 'Generate with AI' }));

    await waitFor(() => expect(tagsValue()).toBe('generated, tags'));
  });

  // The tags are Advanced-only, the picture is not. Split apart, the two pieces answer the mode separately,
  // so Simple mode is where a wrong gate on either would show.
  it('keeps Generate in Simple mode and draws no tags field', () => {
    inMode('simple');

    expect(left().getByRole('button', { name: 'Generate with AI' })).toBeTruthy();
    expect(screen.queryByLabelText('Image Tags')).toBeNull();
  });

  it('draws the tags field in Advanced mode', () => {
    inMode('advanced');

    expect(right().getByLabelText('Image Tags')).toBeTruthy();
  });
});
