import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { serializeTurnContent } from '@/lib/turnDigest';
import type { MemoryNote } from '@/lib/memoryOverrides';
import { MemoryManagerModal } from './MemoryManagerModal';

const history = [
  { role: 'user' as const, content: 'Go to the dock.' },
  {
    role: 'assistant' as const,
    content: serializeTurnContent({
      narration: 'Gulls wheel over the dock.', choices: [], stat_changes: [], turnId: 't1', summary: 'The party reached the dock.',
    }),
  },
];

const seed = vi.hoisted(() => ({
  notes: [] as MemoryNote[],
  edits: {} as Record<string, { text: string; source: 'player' }>,
  pins: {} as Record<string, 'keep' | 'drop'>,
  deleted: [] as string[],
}));
const snapshot = vi.hoisted(() => ({ notes: [] as MemoryNote[], edits: {} as object, pins: {} as object }));

vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => {
    const [memoryNotes, setMemoryNotes] = useState(seed.notes);
    const [memoryEdits, setMemoryEdits] = useState(seed.edits);
    const [memoryPins, setMemoryPins] = useState(seed.pins);
    const [memoryDeleted, setMemoryDeleted] = useState(seed.deleted);
    Object.assign(snapshot, { notes: memoryNotes, edits: memoryEdits, pins: memoryPins });
    return {
      fullMessageHistory: history,
      memoryPins, setMemoryPins,
      milestoneSelection: undefined,
      memoryEdits, setMemoryEdits,
      memoryDeleted, setMemoryDeleted,
      memoryNotes, setMemoryNotes,
      gameTime: 0, calendar: undefined,
      contextMemoryIds: [], rehydratedMemoryIds: [],
    };
  },
}));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ memoryDigests: true, narrationVerbatimTurns: 0, aiClock: false }),
}));
vi.mock('@/components/HelpButton', () => ({ HelpButton: () => null }));

afterEach(() => {
  cleanup();
  seed.deleted = [];
});

const resetButton = () => screen.getByRole('button', { name: 'Reset All My Changes' }) as HTMLButtonElement;

describe('Reset All My Changes in the Memory Manager', () => {
  it('clears edits and pins and keeps the hand-written memories', async () => {
    seed.notes = [{ id: 'n1', text: 'The bridge is out.', anchorTurn: 1 }];
    seed.edits = { t1: { text: 'Rewritten dock scene.', source: 'player' } };
    seed.pins = { t1: 'keep' };
    const user = userEvent.setup();
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    await user.click(resetButton());
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(snapshot.edits).toEqual({});
    expect(snapshot.pins).toEqual({});
    expect(snapshot.notes).toEqual([{ id: 'n1', text: 'The bridge is out.', anchorTurn: 1 }]);
  });

  it('stays disabled when only hand-written memories exist', () => {
    seed.notes = [{ id: 'n1', text: 'The bridge is out.', anchorTurn: 1 }];
    seed.edits = {};
    seed.pins = {};
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    expect(resetButton().disabled).toBe(true);
  });

  it.each([
    ['an edit', { edits: { t1: { text: 'Rewritten dock scene.', source: 'player' as const } }, pins: {}, deleted: [] }],
    ['a pin', { edits: {}, pins: { t1: 'keep' as const }, deleted: [] }],
    ['a deletion', { edits: {}, pins: {}, deleted: ['t1'] }],
  ])('enables with only %s', (_, changes) => {
    Object.assign(seed, { notes: [] }, changes);
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    expect(resetButton().disabled).toBe(false);
  });
});
