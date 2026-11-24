import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { serializeTurnContent } from '@/lib/turnDigest';
import type { TurnTextEdits } from '@/lib/turnTextEdits';
import { MemoryManagerModal } from './MemoryManagerModal';

const turn = (turnId: string, summary: string) => ({
  role: 'assistant' as const,
  content: serializeTurnContent({ narration: `${turnId} prose.`, choices: [], stat_changes: [], turnId, summary }),
});
const history = [
  { role: 'user' as const, content: 'Go to the dock.' }, turn('t1', 'The party reached the dock.'),
  { role: 'user' as const, content: 'Board.' }, turn('t2', 'The party boarded the ferry.'),
];

const seed = vi.hoisted(() => ({ textEdits: {} as TurnTextEdits }));
const snapshot = vi.hoisted(() => ({ textEdits: {} as TurnTextEdits, pins: {} as Record<string, string> }));

vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => {
    const [turnTextEdits, setTurnTextEdits] = useState(seed.textEdits);
    const [memoryPins, setMemoryPins] = useState({});
    const [memoryNotes, setMemoryNotes] = useState([]);
    Object.assign(snapshot, { textEdits: turnTextEdits, pins: memoryPins });
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

/** The row block that holds `text`, buttons included. */
const blockOf = (text: string) => screen.getByText(text).parentElement!.parentElement!.parentElement!;
const press = (text: string, name: string) => fireEvent.click(within(blockOf(text)).getByRole('button', { name }));

describe('memory changes in the Memory Manager', () => {
  it('saves an edit to the layer, and Revert returns the AI text', () => {
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    press('The party boarded the ferry.', 'Edit This Memory');
    fireEvent.change(screen.getByDisplayValue('The party boarded the ferry.'), { target: { value: 'We boarded at dusk.' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(snapshot.textEdits).toEqual({ t2: { memory: { text: 'We boarded at dusk.', source: 'player' } } });
    expect(snapshot.pins).toEqual({ t2: 'keep' });

    press('We boarded at dusk.', 'Revert to the Original');
    expect(snapshot.textEdits).toEqual({});
    expect(snapshot.pins).toEqual({});
    expect(screen.getByText('The party boarded the ferry.')).toBeInTheDocument();
  });

  it('deletes a memory onto the layer, and Restore brings it back', () => {
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    press('The party boarded the ferry.', 'Delete This Memory');
    expect(snapshot.textEdits).toEqual({ t2: { memory: { source: 'player', deleted: true } } });

    fireEvent.click(screen.getByRole('button', { name: /^Deleted/ }));
    press('The party boarded the ferry.', 'Restore This Memory');
    expect(snapshot.textEdits).toEqual({});
  });

  it('restores a deleted rewrite with the player’s text', () => {
    seed.textEdits = { t2: { memory: { text: 'We boarded at dusk.', source: 'player', deleted: true } } };
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Deleted/ }));
    press('We boarded at dusk.', 'Restore This Memory');
    expect(snapshot.textEdits).toEqual({ t2: { memory: { text: 'We boarded at dusk.', source: 'player' } } });
  });
});
