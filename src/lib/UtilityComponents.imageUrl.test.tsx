import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageUpload } from './UtilityComponents';
import { IMAGE_CAPS } from './imageOptim';

// The downscale prompt owns a canvas encode; a pasted link must never reach it, which is what the
// "no downscale" test below proves.
const promptImage = vi.fn(async (url: string) => url);
vi.mock('./useDownscalePrompt', () => ({
  useDownscalePrompt: () => ({ promptImage: (url: string) => promptImage(url), dialog: null, promptWorld: vi.fn() }),
}));
vi.mock('./useRemoteImage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useRemoteImage')>()),
  // Bypass the IndexedDB cache: these tests are about the authoring UI, not the cache.
  useRemoteImage: (url: string) => url || '',
  RemoteImg: ({ src, ...rest }: { src?: string }) => <img src={src} {...rest} />,
}));

beforeEach(() => { promptImage.mockClear(); });

const urlBox = () => screen.getByLabelText('Image URL');

describe('ImageUpload URL entry', () => {
  it('stores a pasted link verbatim', () => {
    const onChange = vi.fn();
    render(<ImageUpload id="t" onChange={onChange} cap={IMAGE_CAPS.entity} />);

    fireEvent.change(urlBox(), { target: { value: 'https://files.example/a.png' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));

    expect(onChange).toHaveBeenCalledWith('https://files.example/a.png');
  });

  it('accepts Enter as well as the button', () => {
    const onChange = vi.fn();
    render(<ImageUpload id="t" onChange={onChange} cap={IMAGE_CAPS.entity} />);

    fireEvent.change(urlBox(), { target: { value: 'https://files.example/a.png' } });
    fireEvent.keyDown(urlBox(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('https://files.example/a.png');
  });

  it('never runs the downscale pass on a link — a remote image costs the payload nothing', () => {
    render(<ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);

    fireEvent.change(urlBox(), { target: { value: 'https://files.example/a.png' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));

    expect(promptImage).not.toHaveBeenCalled();
  });

  it('rejects something that is not a link, and stores nothing', async () => {
    const onChange = vi.fn();
    render(<ImageUpload id="t" onChange={onChange} cap={IMAGE_CAPS.entity} />);

    fireEvent.change(urlBox(), { target: { value: 'mara.png' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));

    expect(await screen.findByText(/starting with http/i)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers the box only on an empty slot — a filled one is replaced by removing it first', () => {
    render(<ImageUpload id="t" value="https://files.example/a.png" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);

    expect(screen.queryByLabelText('Image URL')).toBeNull();
  });

  it('marks a filled slot as linked so an author can tell it apart from an uploaded one', () => {
    const { rerender } = render(
      <ImageUpload id="t" value="https://files.example/a.png" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />,
    );
    expect(screen.getByLabelText('Linked image')).toBeTruthy();

    rerender(<ImageUpload id="t" value="data:image/webp;base64,AAAA" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);
    expect(screen.queryByLabelText('Linked image')).toBeNull();
  });

  it('shows a dead link as broken at authoring time instead of leaving it to surface in play', async () => {
    render(<ImageUpload id="t" value="https://files.example/gone.png" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);

    fireEvent.error(screen.getByAltText('Uploaded'));

    await waitFor(() => expect(screen.getByText(/Couldn't load this image/i)).toBeTruthy());
  });

  it('gives a replacement value a fresh chance to load', async () => {
    const { rerender } = render(
      <ImageUpload id="t" value="https://files.example/gone.png" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />,
    );
    fireEvent.error(screen.getByAltText('Uploaded'));
    await waitFor(() => expect(screen.getByText(/Couldn't load this image/i)).toBeTruthy());

    rerender(<ImageUpload id="t" value="https://files.example/good.png" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);

    await waitFor(() => expect(screen.queryByText(/Couldn't load this image/i)).toBeNull());
  });
});
