import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { serializeTurnContent } from '@/lib/turnDigest';
import type { MemoryNote } from '@/lib/memoryOverrides';
import type { TurnTextEdits } from '@/lib/turnTextEdits';
import { layerOf } from '@/test/memoryChanges';
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
  textEdits: {} as TurnTextEdits,
  pins: {} as Record<string, 'keep' | 'drop'>,
}));
const snapshot = vi.hoisted(() => ({ notes: [] as MemoryNote[], textEdits: {} as object, pins: {} as object }));

vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => {
    const [memoryNotes, setMemoryNotes] = useState(seed.notes);
    const [turnTextEdits, setTurnTextEdits] = useState(seed.textEdits);
    const [memoryPins, setMemoryPins] = useState(seed.pins);
    Object.assign(snapshot, { notes: memoryNotes, textEdits: turnTextEdits, pins: memoryPins });
    return {
      fullMessageHistory: history,
      memoryPins, setMemoryPins,
      milestoneSelection: undefined,
      turnTextEdits, setTurnTextEdits,
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
  seed.textEdits = {};
});

const resetButton = () => screen.getByRole('button', { name: 'Reset All My Changes' }) as HTMLButtonElement;

describe('Reset All My Changes in the Memory Manager', () => {
  it('clears edits and pins and keeps the hand-written memories', async () => {
    seed.notes = [{ id: 'n1', text: 'The bridge is out.', anchorTurn: 1 }];
    seed.textEdits = layerOf({ edits: { t1: { text: 'Rewritten dock scene.', source: 'player' } } });
    seed.pins = { t1: 'keep' };
    const user = userEvent.setup();
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    await user.click(resetButton());
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(snapshot.textEdits).toEqual({});
    expect(snapshot.pins).toEqual({});
    expect(snapshot.notes).toEqual([{ id: 'n1', text: 'The bridge is out.', anchorTurn: 1 }]);
  });

  it('stays disabled when only hand-written memories exist', () => {
    seed.notes = [{ id: 'n1', text: 'The bridge is out.', anchorTurn: 1 }];
    seed.textEdits = {};
    seed.pins = {};
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    expect(resetButton().disabled).toBe(true);
  });

  it.each([
    ['an edit', { textEdits: layerOf({ edits: { t1: { text: 'Rewritten dock scene.', source: 'player' } } }), pins: {} }],
    ['a pin', { textEdits: {}, pins: { t1: 'keep' as const } }],
    ['a deletion', { textEdits: layerOf({ deleted: ['t1'] }), pins: {} }],
  ])('enables with only %s', (_, changes) => {
    Object.assign(seed, { notes: [] }, changes);
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    expect(resetButton().disabled).toBe(false);
  });
});
