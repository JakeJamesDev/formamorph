import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryManagerModal } from './MemoryManagerModal';
import type { MemoryNote } from '@/lib/memoryOverrides';

const memoryNotes: MemoryNote[] = [
  { id: 'named:t1:nursery', name: 'Nursery', text: 'Ash lives at the nursery.', anchorTurn: 0, revisions: [{ turnId: 't1', text: 'Ash lives at the nursery.', anchorTurn: 0 }] },
  { id: 'n1', text: 'The bridge is out.', anchorTurn: 0 },
];

vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => ({
    fullMessageHistory: [],
    memoryPins: {}, setMemoryPins: vi.fn(),
    milestoneSelection: undefined,
    memoryEdits: {}, setMemoryEdits: vi.fn(),
    memoryDeleted: [], setMemoryDeleted: vi.fn(),
    memoryNotes, setMemoryNotes: vi.fn(),
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

/** The row that holds `text`: the block its text and its badges share. */
const rowOf = (text: string) => screen.getByText(text).parentElement!.parentElement!;

describe('the Memory Manager names', () => {
  it('labels a named Custom row with its name, and an unnamed one with none', () => {
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    expect(rowOf('Ash lives at the nursery.')).toHaveTextContent('Nursery');
    expect(screen.getAllByText('Nursery')).toHaveLength(1);
    expect(rowOf('The bridge is out.')).not.toHaveTextContent('Nursery');
  });
});
