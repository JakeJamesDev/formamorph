import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TraitGroup } from '@/types';
import GroupManager from './GroupManager';

const data = vi.hoisted(() => ({ placeholders: [], updateTraitGroup: vi.fn() }));
// Both readers of the one context, as the real module has: a placeholder field reads the optional one.
vi.mock('@/contexts/GameDataContext', () => ({ useGameData: () => data, useGameDataOptional: () => data }));
// Radix Select never opens its listbox in jsdom, so the count picker stands in as a native select with the
// same value and onValueChange.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <select aria-label="Pick Count" value={value} onChange={(e) => onValueChange(e.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
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

  describe('pick count', () => {
    const written = () => data.updateTraitGroup.mock.lastCall?.[0];
    const pick = (value: string) => fireEvent.change(screen.getByLabelText('Pick Count'), { target: { value } });

    it('shows the preset the stored counts match', () => {
      render(<GroupManager group={{ ...group, minPicks: 1, maxPicks: 1 }} />);
      expect(screen.getByLabelText('Pick Count')).toHaveValue('exactlyOne');
      expect(screen.queryByLabelText('At Least')).toBeNull();
    });

    it('writes both counts for a preset', () => {
      render(<GroupManager group={{ ...group, minPicks: 2, maxPicks: 3 }} />);
      pick('upToOne');
      expect(written()).toMatchObject({ minPicks: undefined, maxPicks: 1 });
      pick('any');
      expect(written()).toMatchObject({ minPicks: undefined, maxPicks: undefined });
    });

    it('shows the two fields for Custom, and blank At Most means no limit', () => {
      render(<GroupManager group={{ ...group, maxPicks: 1 }} />);
      pick('custom');
      expect(screen.getByLabelText('Pick Count')).toHaveValue('custom');
      fireEvent.change(screen.getByLabelText('At Least'), { target: { value: '2' } });
      expect(written()).toMatchObject({ minPicks: 2, maxPicks: 1 });
      fireEvent.change(screen.getByLabelText('At Most'), { target: { value: '' } });
      expect(written()).toMatchObject({ minPicks: 2, maxPicks: undefined });
    });
  });
});
