import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryManagerModal } from './MemoryManagerModal';

vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => ({
    fullMessageHistory: [],
    memoryPins: {}, setMemoryPins: vi.fn(),
    milestoneSelection: undefined,
    memoryEdits: {}, setMemoryEdits: vi.fn(),
    memoryDeleted: [], setMemoryDeleted: vi.fn(),
    memoryNotes: [], setMemoryNotes: vi.fn(),
    isWaitingForAI: false,
    gameTime: 0, calendar: undefined,
    contextMemoryIds: [], rehydratedMemoryIds: [],
  }),
}));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ memoryDigests: true, narrationVerbatimTurns: 2, aiClock: false }),
}));
vi.mock('@/components/HelpButton', () => ({ HelpButton: () => null }));

afterEach(cleanup);

describe('the Memory Manager search', () => {
  it('empties the box and keeps the cursor in it when the X is selected', async () => {
    const user = userEvent.setup();
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    const box = screen.getByPlaceholderText('Search memories…');
    await user.type(box, 'harbor');

    await user.click(screen.getByRole('button', { name: 'Clear Search' }));

    expect(box).toHaveValue('');
    expect(box).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear Search' })).not.toBeInTheDocument();
  });
});
