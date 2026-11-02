// Must load before the providers: their services open IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameDataProvider } from '@/contexts/GameDataContext';
import type { CharacterData, ModelMetadata } from '@/types';
import CharacterCustomization from './CharacterCustomization';

// Vitest serves the build's define as a global, so the real modules read this value as a `none` build would.
vi.hoisted(() => { (globalThis as Record<string, unknown>).__AVATAR_SET__ = 'none'; });

vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef<HTMLDivElement, { modelUrl?: string }>(({ modelUrl }, ref) => <div ref={ref} data-testid="preview" data-url={modelUrl ?? 'none'} />) };
});

const meta = (id: string, name: string): ModelMetadata =>
  ({ id, name, type: 'model/vrm', size: 1, createdAt: '2026-01-01', thumbnail: 'data:,', hasFileThumbnail: false });

const library = vi.hoisted(() => ({ models: [] as ModelMetadata[] }));
vi.mock('@/services/ModelStorageService', () => ({
  default: {
    seedBundledAvatars: vi.fn(async () => {}),
    getModelMetadata: vi.fn(async () => [...library.models]),
    getModelData: vi.fn(async () => ({ blob: new Blob(['vrm']) })),
    addModel: vi.fn(async (file: File) => {
      const added = meta('added', file.name);
      library.models.push(added);
      return added;
    }),
  },
}));

beforeEach(() => {
  library.models = [];
  localStorage.clear();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:avatar', revokeObjectURL: () => undefined }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const mount = (props: Partial<React.ComponentProps<typeof CharacterCustomization>> = {}) => {
  const onCharacterCustomized = vi.fn<(data: CharacterData) => void>();
  render(<GameDataProvider><CharacterCustomization onCharacterCustomized={onCharacterCustomized} onAbort={() => undefined} {...props} /></GameDataProvider>);
  return onCharacterCustomized;
};

describe('Avatar Customization with no Avatar in the library', () => {
  it('shows the empty state, and finalizes with no Avatar', async () => {
    const done = mount();
    await screen.findByText(/No Avatars yet/);
    expect(screen.queryByTestId('preview')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Finalize Avatar' }));
    expect(done).toHaveBeenCalledOnce();
    expect(done.mock.calls[0][0].chosenVrm).toBeNull();
  });

  it("opens the file picker from the empty state's Import Avatar, and shows the preview once one is added", async () => {
    mount();
    await screen.findByText(/No Avatars yet/);
    const input = document.getElementById('model-upload') as HTMLInputElement;
    const open = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Import Avatar' }));
    expect(open).toHaveBeenCalledOnce();

    fireEvent.change(input, { target: { files: [new File(['vrm'], 'Wren.vrm')] } });
    await waitFor(() => expect(screen.queryByText(/No Avatars yet/)).toBeNull());
    expect((await screen.findByTestId('preview')).dataset.url).toBe('blob:avatar');
  });

  it('keeps the Player Avatar dropdown disabled until an Avatar is added, with Add .vrm beside it', async () => {
    mount();
    await screen.findByText(/No Avatars yet/);
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByText('Add .vrm')).toBeInTheDocument();

    fireEvent.change(document.getElementById('model-upload') as HTMLInputElement, { target: { files: [new File(['vrm'], 'Wren.vrm')] } });
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
  });
});

describe("a locked world pick on a build with no bundled Avatar", () => {
  const hint = /This world.s Avatar isn.t available/;

  it('says so when the picked Avatar is not in the library', async () => {
    library.models = [meta('heron', 'Heron')];
    mount({ vrm: { kind: 'library', id: 'gone' } });
    await screen.findByText(hint);
    expect(screen.queryByTestId('preview')).toBeNull();
  });

  it('shows the Avatar, with no hint, when it is in the library', async () => {
    library.models = [meta('heron', 'Heron')];
    mount({ vrm: { kind: 'library', id: 'heron' } });
    await waitFor(() => expect(screen.getByTestId('preview').dataset.url).toBe('blob:avatar'));
    expect(screen.queryByText(hint)).toBeNull();
  });
});
