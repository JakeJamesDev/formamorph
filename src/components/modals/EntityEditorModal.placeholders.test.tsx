import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityEditorModal from './EntityEditorModal';
import { phValues } from '@/test/placeholderValues';
import type { Entity } from '@/types';

vi.mock('@/services/EntityStorageService', () => ({
  default: { getEntityData: vi.fn(), storeEntity: vi.fn() },
}));
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));
// The Character tab's fields reach into settings and image generation; the tab under test is the other one.
vi.mock('@/managers/EntityFields', () => ({ default: () => null }));

const draft: Entity = {
  id: 'e1',
  name: 'Maren',
  placeholders: [{ id: 'town', name: 'Town', values: phValues(['Sedge', 'Marrow']) }],
} as unknown as Entity;

describe('EntityEditorModal — the Placeholders tab', () => {
  it('shows the placeholder palette over the placeholder editor', async () => {
    render(<EntityEditorModal entityId={null} draft={draft} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Placeholders' }));
    // The strip's own header, and the one chip the character carries.
    expect(screen.getByRole('button', { name: /^Placeholders/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Town' })).toBeInTheDocument();
    // And the editor beneath it, ready to select the same placeholder.
    expect(screen.getByRole('button', { name: 'Add Placeholder' })).toBeInTheDocument();
  });
});
