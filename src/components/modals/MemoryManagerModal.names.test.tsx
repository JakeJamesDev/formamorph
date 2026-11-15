import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryManagerModal } from './MemoryManagerModal';
import type { MemoryNote } from '@/lib/memoryOverrides';
import { pruneNamedMemories } from '@/lib/namedMemories';

const nursery: MemoryNote = {
  id: 'named:t1:nursery', name: 'Nursery', text: 'Ash lives at the nursery.', anchorTurn: 0,
  revisions: [{ turnId: 't1', text: 'Ash lives at the nursery.', anchorTurn: 0 }],
};
const bridge: MemoryNote = { id: 'n1', text: 'The bridge is out.', anchorTurn: 0 };

/** The save fields the modal reads, and what its setters last wrote. */
const state = { notes: [] as MemoryNote[], deleted: [] as string[] };
const apply = <T,>(prev: T, next: T | ((at: T) => T)): T => (typeof next === 'function' ? (next as (at: T) => T)(prev) : next);

vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => ({
    fullMessageHistory: [],
    memoryPins: {}, setMemoryPins: vi.fn(),
    milestoneSelection: undefined,
    memoryEdits: {}, setMemoryEdits: vi.fn(),
    memoryDeleted: state.deleted, setMemoryDeleted: (next: string[] | ((at: string[]) => string[])) => { state.deleted = apply(state.deleted, next); },
    memoryNotes: state.notes, setMemoryNotes: (next: MemoryNote[] | ((at: MemoryNote[]) => MemoryNote[])) => { state.notes = apply(state.notes, next); },
    isWaitingForAI: false,
    gameTime: 0, calendar: undefined,
    contextMemoryIds: [], rehydratedMemoryIds: [],
  }),
}));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ memoryDigests: true, narrationVerbatimTurns: 2, aiClock: false }),
}));
vi.mock('@/components/HelpButton', () => ({ HelpButton: () => null }));

beforeEach(() => {
  state.notes = [nursery, bridge];
  state.deleted = [];
});
afterEach(cleanup);

/** The row that holds `text`: the block its text and its badges share. */
const rowOf = (text: string) => screen.getByText(text).parentElement!.parentElement!;
/** The row's whole block, buttons included. */
const blockOf = (text: string) => rowOf(text).parentElement!;

describe('the Memory Manager names', () => {
  it('labels a named Custom row with its name, and an unnamed one with none', () => {
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    expect(rowOf('Ash lives at the nursery.')).toHaveTextContent('Nursery');
    expect(screen.getAllByText('Nursery')).toHaveLength(1);
    expect(rowOf('The bridge is out.')).not.toHaveTextContent('Nursery');
  });

  it('saves an edit of a named memory as a player revision that a rewind keeps (Q8)', () => {
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    fireEvent.click(within(blockOf('Ash lives at the nursery.')).getByRole('button', { name: 'Edit This Memory' }));
    fireEvent.change(screen.getByDisplayValue('Ash lives at the nursery.'), { target: { value: 'Ash, my favorite.' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(state.notes[0].text).toBe('Ash, my favorite.');
    // A later script write's turn left the history; the player's revision stays.
    const withLater = [{ ...state.notes[0], revisions: [...state.notes[0].revisions ?? [], { turnId: 't2', text: 'Bree.', anchorTurn: 2 }] }];
    expect(pruneNamedMemories(withLater, [
      { role: 'user', content: 'go' },
      { role: 'assistant', content: JSON.stringify({ narration: 'One.', choices: [], stat_changes: [], turnId: 't1' }) },
    ])[0].text).toBe('Ash, my favorite.');
  });

  it('restores a deleted named memory unnamed while another memory holds its name (Q7)', () => {
    const fresh: MemoryNote = { ...nursery, id: 'named:t2:nursery', text: 'Bree lives at the nursery.', revisions: [{ turnId: 't2', text: 'Bree lives at the nursery.', anchorTurn: 0 }] };
    state.notes = [nursery, fresh];
    state.deleted = [nursery.id];
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Deleted/ }));
    fireEvent.click(within(blockOf('Ash lives at the nursery.')).getByRole('button', { name: 'Restore This Memory' }));
    expect(state.deleted).toEqual([]);
    expect(state.notes[0]).toEqual({ id: nursery.id, text: 'Ash lives at the nursery.', anchorTurn: 0 });
    expect(state.notes[1]).toBe(fresh);
  });
});
