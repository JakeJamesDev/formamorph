import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GenerateImageButton } from './GenerateImageButton';

// The dialog reads the whole image-gen settings block; only the endpoint/provider fields matter here.
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    imageProvider: 'a1111', imageEndpoint: 'http://x', imageApiToken: '', imageModel: '',
    imagePositivePrompt: '', imageNegativePrompt: '', imageSteps: 20, imageCfg: 7, imageSampler: 'Euler a',
    imagePortraitWidth: 512, imagePortraitHeight: 768, imageLandscapeWidth: 768, imageLandscapeHeight: 512,
    imageAdetailer: false, imageWorkflow: '', imageInvokeEncoder: '', imageInvokeVae: '', imageInvokeBoard: '',
    imageEndpointPresets: [{ id: 'p1', name: 'Local' }], activeImageEndpointPresetId: 'p1',
    selectImageEndpointPreset: vi.fn(), imageGenDisabled: false, requestSettings: vi.fn(),
    activeEndpointUrl: 'http://x', activeApiToken: '', activeModelName: 'm', imageTagPrompt: 'p',
  }),
}));
vi.mock('@/lib/useDownscalePrompt', () => ({
  useDownscalePrompt: () => ({ promptImage: async (url: string) => url, dialog: null }),
}));
// The autocomplete pulls a tag dictionary it doesn't need for these assertions.
vi.mock('@/components/TagAutocomplete', () => ({
  TagAutocomplete: ({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) => (
    <textarea id={id} aria-label="prompt" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const generateImage = vi.hoisted(() => vi.fn());
// Only the network call is stubbed: buildImageRequest stays real, so the dialog is tested against the
// same request assembly the game uses.
vi.mock('@/lib/imageGen', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/imageGen')>()),
  generateImage,
}));

const props = {
  subject: { name: 'Sedge', description: 'a fisher', kind: 'character' as const },
  cap: { maxWidth: 512, maxHeight: 512 } as never,
  onChange: vi.fn(),
};

const openDialog = () => fireEvent.click(screen.getByRole('button', { name: /Generate with AI/ }));

describe('GenerateImageButton cancel', () => {
  // Braces matter: a value returned from beforeEach is treated as a cleanup callback, and mockReset()
  // returns the mock — vitest would then call it with no arguments at teardown.
  beforeEach(() => { generateImage.mockReset(); });

  it('swaps Generate for Stop while a run is in flight and aborts the provider signal', async () => {
    let seen: AbortSignal | undefined;
    // Never settles on its own: only the Stop click can end this run.
    generateImage.mockImplementation((_p: unknown, _params: unknown, opts: { signal?: AbortSignal }) => {
      seen = opts.signal;
      return new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    });

    render(<GenerateImageButton {...props} tags="1girl, dock" />);
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }));

    const stop = await screen.findByRole('button', { name: /Stop/ });
    expect(screen.queryByRole('button', { name: /^Generate$/ })).toBeNull();
    expect(seen?.aborted).toBe(false);

    fireEvent.click(stop);
    expect(seen?.aborted).toBe(true);
    // The dialog stays open and offers a retry rather than closing out from under the user.
    await waitFor(() => expect(screen.getByRole('button', { name: /^Generate$/ })).toBeEnabled());
    expect(screen.getByLabelText('prompt')).toBeInTheDocument();
  });

  it('shows a busy indicator for providers that report no progress', async () => {
    generateImage.mockImplementation(() => new Promise(() => {}));
    render(<GenerateImageButton {...props} tags="1girl" />);
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }));
    expect(await screen.findByText(/Generating…/)).toBeInTheDocument();
  });
});
