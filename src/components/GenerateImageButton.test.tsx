import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
// The prompt field is a Lexical chip editor that pulls a tag dictionary these assertions don't need, and
// whose caret jsdom cannot drive. Its own behavior is covered by prompt/TagChipField.test.tsx.
vi.mock('@/components/prompt/TagChipField', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
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
    expect(screen.getByLabelText('Prompt')).toBeInTheDocument();
  });

  it('shows a busy indicator for providers that report no progress', async () => {
    generateImage.mockImplementation(() => new Promise(() => {}));
    render(<GenerateImageButton {...props} tags="1girl" />);
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }));
    expect(await screen.findByText(/Generating…/)).toBeInTheDocument();
  });
});

describe('GenerateImageButton preview pane', () => {
  beforeEach(() => { generateImage.mockReset(); });

  it('opens on an empty frame rather than nothing, so the dialog is already its final size', () => {
    render(<GenerateImageButton {...props} tags="1girl" />);
    openDialog();
    expect(screen.getByText('The image appears here.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows the provider’s in-progress frames in the pane, then the finished picture', async () => {
    let report: ((p: { progress: number; preview?: string }) => void) | undefined;
    let finish: ((url: string) => void) | undefined;
    generateImage.mockImplementation((_p: unknown, _params: unknown, opts: { onProgress: (p: { progress: number; preview?: string }) => void }) => {
      report = opts.onProgress;
      return new Promise<string>((resolve) => { finish = resolve; });
    });

    render(<GenerateImageButton {...props} tags="1girl" />);
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }));

    await waitFor(() => expect(report).toBeDefined());
    act(() => report!({ progress: 0.4, preview: 'data:image/webp;base64,MID' }));

    // The half-done frame is in the pane, and the bar reports on it there rather than beside the controls.
    const mid = screen.getByAltText('Generating…');
    expect(mid).toHaveAttribute('src', 'data:image/webp;base64,MID');
    expect(screen.getByText('40%')).toBeInTheDocument();
    // Out of flow and fitted to the pane: a latent preview is a couple of hundred pixels, so at its own
    // size it is a stamp — and in flow a large one would grow the row and shift the dialog as it landed.
    expect(mid.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['absolute', 'inset-0', 'h-full', 'w-full', 'object-contain']),
    );

    act(() => finish!('data:image/webp;base64,DONE'));

    const done = await screen.findByAltText('Generated preview');
    expect(done).toHaveAttribute('src', 'data:image/webp;base64,DONE');
    // Still zoomable: the pane is bigger than the old thumbnail but no substitute for full size.
    expect(done.className).toMatch(/cursor-zoom-in/);
    // Sized by the pane exactly as the frames were, so the finished picture replacing them moves nothing.
    expect(done.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['absolute', 'inset-0', 'h-full', 'w-full', 'object-contain']),
    );
    expect(screen.queryByText('The image appears here.')).toBeNull();
  });
});
