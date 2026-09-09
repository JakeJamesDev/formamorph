import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TraitGroup } from '@/types';
import GroupManager from './GroupManager';

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({ placeholders: [], updateTraitGroup: vi.fn() }),
}));
// Keep Streamdown out of jsdom; the field's real Lexical editor still mounts.
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const group: TraitGroup = { id: 'g1', name: 'Origin', parentId: null, order: 0, playerDescription: 'Where you came from.' };

describe('GroupManager', () => {
  it('gives the player-facing description a markdown toolbar and keeps the AI description plain', () => {
    render(<GroupManager group={group} />);
    // One toolbar in the panel, and it belongs to the field labeled for the player.
    const bold = screen.getByLabelText('Bold');
    const playerLabel = screen.getByText('Player-Facing Description');
    const aiLabel = screen.getByText('AI-Facing Description');
    expect(playerLabel.compareDocumentPosition(bold) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bold.compareDocumentPosition(aiLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
