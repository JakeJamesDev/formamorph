import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import EntityStorageService from '@/services/EntityStorageService';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import EntityEditorModal from './EntityEditorModal';
import DictionaryEditorModal from './DictionaryEditorModal';

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

describe('library author editing', () => {
  it.each(['entity', 'dictionary'] as const)('loads and saves %s credit without writing it into world content', async (kind) => {
    const id = `author-${kind}`;
    const libraryDetails = { author: 'River Quill' };
    const onPublish = vi.fn();
    if (kind === 'entity') {
      await EntityStorageService.storeEntity({ id, name: 'Guide', data: { id, name: 'Guide' }, libraryDetails });
      render(<SettingsProvider><EntityEditorModal entityId={id} onClose={vi.fn()} onPublish={onPublish} /></SettingsProvider>);
    } else {
      await DictionaryStorageService.storeDictionary({ id, name: 'Lore', data: { id, name: 'Lore', entries: [], enabled: false }, libraryDetails });
      render(<SettingsProvider><DictionaryEditorModal dictionaryId={id} initialTab="overview" onClose={vi.fn()} onPublish={onPublish} /></SettingsProvider>);
    }
    const field = await screen.findByRole('textbox', { name: 'Author' });
    expect(field).toHaveValue('River Quill');
    expect(field.compareDocumentPosition(screen.getByText('Tags')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(field, { target: { value: 'Fen Writer' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    const metadata = async () => kind === 'entity'
      ? (await EntityStorageService.getEntityMetadata()).find((row) => row.id === id)
      : (await DictionaryStorageService.getDictionaryMetadata()).find((row) => row.id === id);
    await waitFor(async () => expect((await metadata())?.author).toBe('Fen Writer'));
    const content = kind === 'entity'
      ? await EntityStorageService.getEntityData(id)
      : await DictionaryStorageService.getDictionaryData(id);
    expect(content).not.toHaveProperty('author');
    if (kind === 'dictionary') {
      expect(screen.queryByRole('checkbox', { name: /Enabled/ })).toBeNull();
      expect(content).toMatchObject({ enabled: false });
    }
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    await waitFor(async () => expect((await metadata())?.author).toBe(''));
  });
});
